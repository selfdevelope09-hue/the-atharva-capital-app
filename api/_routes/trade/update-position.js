const { tradeViaDigitalOcean, proxyJsonToDigitalOcean } = require('../../_lib/proxyToDigitalOcean.cjs');
const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { json, readBody, applyApiCors, handleCorsPreflight } = require('../../_lib/http');
const { findFirestorePositionIndex } = require('../../_lib/virtualPerps.cjs');
const { scheduleSyncTradeToFirestore } = require('../../_lib/syncTradeToFirestore.cjs');
const { ensureSupabaseUser } = require('../../_lib/ensureSupabaseUser.cjs');
const { supabaseConfigured } = require('../../_lib/supabaseConfigured.cjs');

function parseLevel(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function validateLevels(enriched, tp, sl) {
  const entry = Number(enriched.entryPrice);
  if (!Number.isFinite(entry) || entry <= 0) return 'Invalid entry price';
  const isLong = String(enriched.type).toUpperCase() === 'LONG';
  if (tp == null && sl == null) return null;
  if (tp != null) {
    if (isLong && tp <= entry) return 'TP must be above entry for LONG';
    if (!isLong && tp >= entry) return 'TP must be below entry for SHORT';
  }
  if (sl != null) {
    if (isLong && sl >= entry) return 'SL must be below entry for LONG';
    if (!isLong && sl <= entry) return 'SL must be above entry for SHORT';
  }
  return null;
}

module.exports = async (req, res) => {
  if (tradeViaDigitalOcean()) {
    return proxyJsonToDigitalOcean(req, res, '/api/trade/update-position');
  }
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const decoded = await verifyBearer(req);
    const body = readBody(req);
    const enriched = body.enriched;
    const uiIndex = Number(body.uiIndex);
    if (!enriched || typeof enriched !== 'object') {
      return json(res, 400, { ok: false, error: 'Missing position' });
    }
    const tp = parseLevel(body.tp);
    const sl = parseLevel(body.sl);
    const errMsg = validateLevels(enriched, tp, sl);
    if (errMsg) return json(res, 400, { ok: false, error: errMsg });

    if (!supabaseConfigured()) {
      return json(res, 503, { ok: false, error: 'Trading backend unavailable.' });
    }

    const supa = getSupabaseAdmin();
    const uid = decoded.uid;
    await ensureSupabaseUser(supa, decoded);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: row, error: rErr } = await supa
        .from('users')
        .select('virtual_balance,positions')
        .eq('uid', uid)
        .maybeSingle();
      if (rErr) throw rErr;
      if (!row) {
        await ensureSupabaseUser(supa, decoded);
        continue;
      }
      const vbal = Number(row.virtual_balance);
      let positions = row.positions;
      if (!Array.isArray(positions)) positions = [];
      const matchIdx = findFirestorePositionIndex(positions, enriched, uiIndex);
      if (matchIdx < 0) return json(res, 400, { ok: false, error: 'Position not found' });
      const nextPositions = positions.map((p, i) => (i === matchIdx ? { ...p, tp, sl } : p));
      const up = await supa
        .from('users')
        .update({ positions: nextPositions })
        .eq('uid', uid)
        .eq('virtual_balance', vbal)
        .select('virtual_balance,positions,closed_positions,lifetime_realized_pnl')
        .maybeSingle();
      if (up.error) throw up.error;
      if (up.data) {
        scheduleSyncTradeToFirestore(uid, up.data);
        return json(res, 200, { ok: true });
      }
      await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
    }
    return json(res, 409, { ok: false, error: 'Could not update position. Try again.' });
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message || 'Update failed' });
  }
};
