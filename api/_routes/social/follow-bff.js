const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { json, readBody, applyApiCors, handleCorsPreflight } = require('../../_lib/http');

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const decoded = await verifyBearer(req);
    const body = readBody(req);
    const targetUid = String(body.targetUid || '').trim();
    const action = String(body.action || '').toLowerCase();
    if (!targetUid) return json(res, 400, { ok: false, error: 'Missing targetUid' });
    if (!['follow', 'unfollow'].includes(action)) return json(res, 400, { ok: false, error: 'Invalid action' });
    const uid = decoded.uid;
    if (uid === targetUid) return json(res, 400, { ok: false, error: 'Invalid target' });

    const supa = getSupabaseAdmin();
    const { data: me, error: meErr } = await supa.from('users').select('following,followers').eq('uid', uid).single();
    if (meErr) throw meErr;
    const { data: them, error: thErr } = await supa
      .from('users')
      .select('following,followers')
      .eq('uid', targetUid)
      .single();
    if (thErr) throw thErr;

    let myFollowing = Array.isArray(me.following) ? [...me.following] : [];
    let theirFollowers = Array.isArray(them.followers) ? [...them.followers] : [];

    if (action === 'follow') {
      if (!myFollowing.includes(targetUid)) myFollowing.push(targetUid);
      if (!theirFollowers.includes(uid)) theirFollowers.push(uid);
    } else {
      myFollowing = myFollowing.filter((x) => x !== targetUid);
      theirFollowers = theirFollowers.filter((x) => x !== uid);
    }

    const [u1, u2] = await Promise.all([
      supa.from('users').update({ following: myFollowing }).eq('uid', uid),
      supa.from('users').update({ followers: theirFollowers }).eq('uid', targetUid)
    ]);
    if (u1.error) throw u1.error;
    if (u2.error) throw u2.error;
    return json(res, 200, { ok: true });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
