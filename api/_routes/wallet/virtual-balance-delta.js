const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { json, readBody, applyApiCors, handleCorsPreflight } = require('../../_lib/http');
const { syncTradeToFirestore } = require('../../_lib/syncTradeToFirestore.cjs');

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const decoded = await verifyBearer(req);
    const body = readBody(req);
    const delta = Number(body.delta);
    if (!Number.isFinite(delta)) return json(res, 400, { ok: false, error: 'Invalid delta' });
    const supa = getSupabaseAdmin();
    const uid = decoded.uid;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: row, error: rErr } = await supa.from('users').select('virtual_balance').eq('uid', uid).single();
      if (rErr) throw rErr;
      const vbal = Number(row.virtual_balance);
      const next = vbal + delta;
      if (next < 0) return json(res, 400, { ok: false, error: 'Balance would go negative' });
      const up = await supa
        .from('users')
        .update({ virtual_balance: next })
        .eq('uid', uid)
        .eq('virtual_balance', vbal)
        .select('virtual_balance')
        .maybeSingle();
      if (up.error) throw up.error;
      if (up.data) {
        await syncTradeToFirestore(uid, { virtual_balance: up.data.virtual_balance });
        return json(res, 200, { ok: true, virtualBalance: Number(up.data.virtual_balance) });
      }
      await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
    }
    return json(res, 409, { ok: false, error: 'Could not apply balance change. Try again.' });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
