const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { rowToClient } = require('../../_lib/userRowMap');
const { json, readBody, applyApiCors, handleCorsPreflight } = require('../../_lib/http');
const { getBlockedUidSet } = require('../../_lib/blockedUsers.cjs');
const { isUidRemoved } = require('../../_lib/removedUsers.cjs');

const { ensureSupabaseUser } = require('../../_lib/ensureSupabaseUser.cjs');

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  try {
    const decoded = await verifyBearer(req);
    const supa = getSupabaseAdmin();
    const uid = decoded.uid;

    const blocked = await getBlockedUidSet();
    if (blocked.has(uid)) {
      return json(res, 403, { ok: false, error: 'Account restricted', platformBlocked: true });
    }
    if (await isUidRemoved(uid)) {
      return json(res, 403, {
        ok: false,
        error: 'Account removed',
        accountRemoved: true,
        platformBlocked: true
      });
    }

    if (req.method === 'GET') {
      const row = await ensureSupabaseUser(supa, decoded);
      return json(res, 200, { ok: true, user: rowToClient(row) });
    }

    if (req.method === 'PATCH') {
      const body = readBody(req);
      const patch = {};
      if (typeof body.name === 'string') patch.name = body.name;
      if (typeof body.bio === 'string') patch.bio = body.bio;
      if (typeof body.photoURL === 'string') patch.photo_url = body.photoURL;
      if (Array.isArray(body.watchlist)) patch.watchlist = body.watchlist.map(String);
      if (Object.keys(patch).length === 0) {
        return json(res, 400, { ok: false, error: 'No valid fields' });
      }
      const up = await supa.from('users').update(patch).eq('uid', uid).select('*').single();
      if (up.error) throw up.error;
      return json(res, 200, { ok: true, user: rowToClient(up.data) });
    }

    return json(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
