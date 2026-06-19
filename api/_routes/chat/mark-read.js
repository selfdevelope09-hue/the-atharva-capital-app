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
    const threadId = String(body.threadId || '').trim();
    if (!threadId) return json(res, 400, { ok: false, error: 'Missing threadId' });
    const supa = getSupabaseAdmin();
    const { data: t, error: te } = await supa.from('dm_threads').select('*').eq('id', threadId).maybeSingle();
    if (te) throw te;
    if (!t?.participants?.includes(decoded.uid)) return json(res, 403, { ok: false, error: 'Forbidden' });
    const uid = decoded.uid;
    const unread = { ...(t.unread_by_user || {}) };
    unread[uid] = 0;
    const lastSeen = { ...(t.last_seen_at || {}) };
    lastSeen[uid] = new Date().toISOString();
    const up = await supa
      .from('dm_threads')
      .update({
        unread_by_user: unread,
        last_seen_at: lastSeen,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId);
    if (up.error) throw up.error;
    return json(res, 200, { ok: true });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
