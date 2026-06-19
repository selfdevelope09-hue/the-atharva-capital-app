const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { rowToClient } = require('../../_lib/userRowMap');
const { json, applyApiCors, handleCorsPreflight } = require('../../_lib/http');
const { getFirestore } = require('../../_lib/firebaseAdmin');

function firestorePublicUser(uid, d) {
  if (!d) return null;
  const off = d.showcasePresenceOfflineAt;
  let iso = null;
  if (off && typeof off.toDate === 'function') iso = off.toDate().toISOString();
  return {
    uid,
    name: d.name || 'Trader',
    photoURL: d.photoURL || '',
    bio: d.bio || '',
    presenceOnline: d.presenceOnline === true,
    showcasePresenceOnline: d.showcasePresenceOnline === true,
    showcasePresenceExplicitOffline: d.showcasePresenceOnline === false,
    showcasePresenceOfflineAt: iso,
    lastSeenAt: d.lastSeenAt || null
  };
}

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    await verifyBearer(req);
    const uid = String(req.query?.uid || '').trim();
    if (!uid) return json(res, 400, { ok: false, error: 'Missing uid' });

    let user = null;

    try {
      const dbFs = getFirestore();
      const fs = await dbFs.collection('users').doc(uid).get();
      if (fs.exists) user = firestorePublicUser(uid, fs.data());
    } catch {
      /* Firestore optional */
    }

    if (!user) {
      try {
        const supa = getSupabaseAdmin();
        const { data: row, error } = await supa.from('users').select('*').eq('uid', uid).maybeSingle();
        if (error) throw error;
        if (row) user = rowToClient(row);
      } catch {
        /* Supabase optional */
      }
    }

    if (!user) return json(res, 404, { ok: false, error: 'Not found' });
    return json(res, 200, { ok: true, user });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
