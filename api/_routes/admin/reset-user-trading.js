const { getFirestore, getAuth } = require('../../_lib/firebaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { isPlatformAdminUid } = require('../../_lib/platformAdmin.cjs');
const { json, readBody, applyApiCors, handleCorsPreflight } = require('../../_lib/http');

const RESET_START_BALANCE = 10000;

const FS_RESET = {
  virtualBalance: RESET_START_BALANCE,
  positions: [],
  closedPositions: [],
  lifetimeRealizedPnl: 0,
  portfolio: [],
  dailyTradesDate: null,
  dailyTradesCount: 0,
  dailyAdTradeBonus: 0,
  dailyTwelveRewardClaimedDate: null
};

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const decoded = await verifyBearer(req);
    const ok = await isPlatformAdminUid(decoded.uid);
    if (!ok) return json(res, 403, { ok: false, error: 'Admin only' });

    if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      return json(res, 500, { ok: false, error: 'Firebase admin not configured on server' });
    }

    const body = readBody(req);
    const targetUid = String(body.targetUid || body.uid || '').trim();
    if (!targetUid) return json(res, 400, { ok: false, error: 'Missing targetUid' });
    if (targetUid.startsWith('showcase__')) {
      return json(res, 400, { ok: false, error: 'Showcase accounts cannot be reset here — use stock-tip leaderboard tools.' });
    }

    const nowIso = new Date().toISOString();
    const db = getFirestore();
    const ref = db.collection('users').doc(targetUid);
    const snap = await ref.get();

    let name = 'Trader';
    let email = '';

    if (snap.exists) {
      const d = snap.data() || {};
      name = d.name || 'Trader';
      email = d.email || '';
    } else {
      try {
        const au = await getAuth().getUser(targetUid);
        name = au.displayName || au.email?.split('@')[0] || 'Trader';
        email = au.email || '';
      } catch {
        return json(res, 404, { ok: false, error: 'User not found in Firebase' });
      }
    }

    await ref.set(
      {
        uid: targetUid,
        email,
        name,
        ...FS_RESET,
        adminUserResetAt: nowIso,
        adminUserResetBy: decoded.uid
      },
      { merge: true }
    );

    return json(res, 200, {
      ok: true,
      targetUid,
      name,
      email,
      virtualBalance: RESET_START_BALANCE,
      lifetimeRealizedPnl: 0,
      source: 'firestore',
      message: 'Firebase account reset — $10k balance, trades cleared, leaderboard P/L zero.'
    });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
