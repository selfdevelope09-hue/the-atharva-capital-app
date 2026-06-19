const admin = require('firebase-admin');
const { getFirestore } = require('../../_lib/firebaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { isPlatformAdminUid } = require('../../_lib/platformAdmin.cjs');
const { json, readBody, applyApiCors, handleCorsPreflight } = require('../../_lib/http');

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const decoded = await verifyBearer(req);
    const ok = await isPlatformAdminUid(decoded.uid);
    if (!ok) return json(res, 403, { ok: false, error: 'Admin only' });

    const body = readBody(req);
    const profileUid = String(body.profileUid || '').trim();
    const entryId = String(body.entryId || '').trim();
    const online = body.online === true || body.online === 'true';

    if (!profileUid.startsWith('showcase__')) {
      return json(res, 400, { ok: false, error: 'profileUid must be showcase__*' });
    }
    if (!entryId) return json(res, 400, { ok: false, error: 'Missing entryId' });

    const db = getFirestore();
    const userRef = db.collection('users').doc(profileUid);
    const entryRef = db.collection('leaderboardShowcase').doc(entryId);

    const userPatch = {
      showcasePresenceOnline: online,
      showcasePresenceOfflineAt: online ? admin.firestore.FieldValue.delete() : admin.firestore.FieldValue.serverTimestamp()
    };

    await userRef.set(userPatch, { merge: true });
    await entryRef.set(
      {
        ...userPatch,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    return json(res, 200, { ok: true, profileUid, entryId, online });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
