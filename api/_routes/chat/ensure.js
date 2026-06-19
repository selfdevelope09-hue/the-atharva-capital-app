const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { json, readBody, applyApiCors, handleCorsPreflight } = require('../../_lib/http');
const { dmChannelId } = require('../../_lib/dmChannel');

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const decoded = await verifyBearer(req);
    const body = readBody(req);
    const otherUid = String(body.otherUid || '').trim();
    const meName = String(body.meName || 'Trader');
    const otherName = String(body.otherName || 'Trader');
    if (!otherUid || otherUid === decoded.uid) {
      return json(res, 400, { ok: false, error: 'Invalid otherUid' });
    }
    const id = dmChannelId(decoded.uid, otherUid);
    const supa = getSupabaseAdmin();
    const { data: prev } = await supa.from('dm_threads').select('*').eq('id', id).maybeSingle();
    const prevNames = (prev && prev.names) || {};
    const unreadByUser = { ...(prev?.unread_by_user || {}) };
    unreadByUser[decoded.uid] = unreadByUser[decoded.uid] ?? 0;
    unreadByUser[otherUid] = unreadByUser[otherUid] ?? 0;
    const lastSeenAt = { ...(prev?.last_seen_at || {}) };
    const row = {
      id,
      participants: [decoded.uid, otherUid].sort(),
      names: {
        ...prevNames,
        [decoded.uid]: meName,
        [otherUid]: otherName
      },
      unread_by_user: unreadByUser,
      last_seen_at: lastSeenAt,
      updated_at: new Date().toISOString()
    };
    const up = await supa.from('dm_threads').upsert(row, { onConflict: 'id' });
    if (up.error) throw up.error;
    return json(res, 200, { ok: true, threadId: id });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
