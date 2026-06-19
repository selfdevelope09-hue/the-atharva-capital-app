const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { json, readBody, applyApiCors, handleCorsPreflight } = require('../../_lib/http');
const { getFirestore } = require('../../_lib/firebaseAdmin');

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const decoded = await verifyBearer(req);
    const body = readBody(req);
    const online = !!body.online;
    const uid = decoded.uid;
    const now = new Date();

    try {
      const dbFs = getFirestore();
      await dbFs
        .collection('users')
        .doc(uid)
        .set(
          {
            presenceOnline: online,
            lastSeenAt: now
          },
          { merge: true }
        );
    } catch {
      /* Firestore optional if env missing */
    }

    try {
      const supa = getSupabaseAdmin();
      const up = await supa
        .from('users')
        .update({
          presence_online: online,
          last_seen_at: now.toISOString()
        })
        .eq('uid', uid);
      if (up.error) throw up.error;
    } catch {
      /* Supabase optional */
    }

    return json(res, 200, { ok: true });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
