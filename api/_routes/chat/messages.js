const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { messageRowToClient } = require('../../_lib/userRowMap');
const { json, applyApiCors, handleCorsPreflight } = require('../../_lib/http');

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const decoded = await verifyBearer(req);
    const threadId = String(req.query?.threadId || '').trim();
    if (!threadId) return json(res, 400, { ok: false, error: 'Missing threadId' });
    const supa = getSupabaseAdmin();
    const { data: t, error: te } = await supa.from('dm_threads').select('participants').eq('id', threadId).maybeSingle();
    if (te) throw te;
    if (!t?.participants?.includes(decoded.uid)) return json(res, 403, { ok: false, error: 'Forbidden' });
    const lim = Math.min(200, Math.max(1, parseInt(String(req.query?.limit || '45'), 10) || 45));
    const beforeRaw = String(req.query?.before || '').trim();
    let q = supa
      .from('dm_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(lim);
    if (beforeRaw) {
      q = q.lt('created_at', beforeRaw);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    const chronological = (rows || []).slice().reverse();
    const messages = chronological.map(messageRowToClient);
    const hasMore = chronological.length >= lim;
    return json(res, 200, { ok: true, messages, hasMore });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
