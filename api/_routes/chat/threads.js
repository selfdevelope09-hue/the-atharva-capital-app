const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { threadRowToClient } = require('../../_lib/userRowMap');
const { json, applyApiCors, handleCorsPreflight } = require('../../_lib/http');

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const decoded = await verifyBearer(req);
    const supa = getSupabaseAdmin();
    const { data: rows, error } = await supa
      .from('dm_threads')
      .select('*')
      .contains('participants', [decoded.uid])
      .order('updated_at', { ascending: false });
    if (error) throw error;
    const threads = (rows || []).map(threadRowToClient);
    return json(res, 200, { ok: true, threads });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
