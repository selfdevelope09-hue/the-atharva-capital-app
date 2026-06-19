const admin = require('firebase-admin');
const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { getFirestore } = require('../../_lib/firebaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { isPlatformAdminUid } = require('../../_lib/platformAdmin.cjs');
const { json, applyApiCors, handleCorsPreflight } = require('../../_lib/http');

const RESET_START_BALANCE = 10000;

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const decoded = await verifyBearer(req);
    const ok = await isPlatformAdminUid(decoded.uid);
    if (!ok) return json(res, 403, { ok: false, error: 'Admin only' });

    const supa = getSupabaseAdmin();
    const patch = {
      virtual_balance: RESET_START_BALANCE,
      positions: [],
      closed_positions: [],
      lifetime_realized_pnl: 0,
      portfolio: [],
      last_processed_reset_payment_id: null,
      reset_at: new Date().toISOString(),
      daily_trades_date: null,
      daily_trades_count: 0,
      daily_ad_trade_bonus: 0,
      daily_twelve_reward_claimed_date: null,
      updated_at: new Date().toISOString()
    };

    let updated = 0;
    let lastUid = '';
    const page = 200;
    for (;;) {
      let q = supa.from('users').select('uid').order('uid', { ascending: true }).limit(page);
      if (lastUid) q = q.gt('uid', lastUid);
      const { data: rows, error } = await q;
      if (error) throw error;
      if (!rows || rows.length === 0) break;
      const uids = rows.map((r) => r.uid).filter(Boolean);
      if (uids.length) {
        const up = await supa.from('users').update(patch).in('uid', uids);
        if (up.error) throw up.error;
        updated += uids.length;
      }
      lastUid = rows[rows.length - 1].uid;
      if (rows.length < page) break;
    }

    const db = getFirestore();
    let lastDoc = null;
    let fsTotal = 0;
    for (;;) {
      let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(400);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((docSnap) => {
        batch.set(
          docSnap.ref,
          {
            virtualBalance: RESET_START_BALANCE,
            positions: [],
            closedPositions: [],
            lifetimeRealizedPnl: 0,
            portfolio: [],
            dailyTradesDate: null,
            dailyTradesCount: 0,
            dailyAdTradeBonus: 0,
            dailyTwelveRewardClaimedDate: null,
            adminMassResetAt: new Date().toISOString()
          },
          { merge: true }
        );
      });
      await batch.commit();
      fsTotal += snap.docs.length;
      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < 400) break;
    }

    await supa
      .from('app_settings')
      .update({
        leaderboard_frozen: false,
        frozen_month_ist: null,
        leaderboard_snapshot: null,
        frozen_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', 'global');

    try {
      await db.collection('config').doc('leaderboardFreeze').set({
        frozen: false,
        monthIst: null,
        snapshot: null,
        message: null,
        updatedAt: new Date().toISOString()
      });
    } catch (_) {
      /* optional mirror for Firestore-only clients */
    }

    return json(res, 200, {
      ok: true,
      supabaseUsersUpdated: updated,
      firestoreUsersUpdated: fsTotal,
      leaderboardUnfrozen: true,
      clearLeaderboardClientCache: true
    });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
