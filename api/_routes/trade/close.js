const { tradeViaDigitalOcean, proxyJsonToDigitalOcean } = require('../../_lib/proxyToDigitalOcean.cjs');
const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { json, readBody, applyApiCors, handleCorsPreflight } = require('../../_lib/http');
const {
  grossPnlUsdt,
  quantityFromNotional,
  findFirestorePositionIndex,
  genPositionId,
  nextLifetimeRealizedPnl
} = require('../../_lib/virtualPerps.cjs');
const { scheduleSyncTradeToFirestore } = require('../../_lib/syncTradeToFirestore.cjs');
const { ensureSupabaseUser } = require('../../_lib/ensureSupabaseUser.cjs');
const { ensureTradingSchema, isMissingTradingColumnError } = require('../../_lib/ensureTradingSchema.cjs');
const { supabaseConfigured } = require('../../_lib/supabaseConfigured.cjs');
const { hasSupabaseTradingColumns } = require('../../_lib/checkSupabaseTradingSchema.cjs');

module.exports = async (req, res) => {
  if (tradeViaDigitalOcean()) {
    return proxyJsonToDigitalOcean(req, res, '/api/trade/close');
  }
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  let decoded;
  let body;
  try {
    decoded = await verifyBearer(req);
    body = readBody(req);
    const enriched = body.enriched;
    const uiIndex = Number(body.uiIndex);
    const closeReason = ['LIQUIDATED', 'TP', 'SL'].includes(body.closeReason) ? body.closeReason : 'MANUAL';
    if (!enriched || typeof enriched !== 'object') {
      return json(res, 400, { ok: false, error: 'Missing enriched position' });
    }

    if (!supabaseConfigured()) {
      return json(res, 503, {
        ok: false,
        error: 'Trading backend unavailable. DigitalOcean/Postgres env is not configured.'
      });
    }
    const colsOk = await hasSupabaseTradingColumns();
    if (!colsOk) {
      await ensureTradingSchema();
      const colsOk2 = await hasSupabaseTradingColumns();
      if (!colsOk2) {
        return json(res, 503, {
          ok: false,
          error: 'Trading backend unavailable. Missing required Postgres trade columns.'
        });
      }
    }

    const supa = getSupabaseAdmin();
    const uid = decoded.uid;
    await ensureSupabaseUser(supa, decoded);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: row, error: rErr } = await supa
        .from('users')
        .select(
          'virtual_balance,positions,closed_positions,lifetime_realized_pnl,daily_trades_date,daily_trades_count,daily_ad_trade_bonus,daily_twelve_reward_claimed_date'
        )
        .eq('uid', uid)
        .maybeSingle();
      if (rErr) throw rErr;
      if (!row) {
        await ensureSupabaseUser(supa, decoded);
        continue;
      }
      const vbal = Number(row.virtual_balance);
      let currentPositions = row.positions;
      if (!Array.isArray(currentPositions)) currentPositions = [];
      const matchIdx = findFirestorePositionIndex(currentPositions, enriched, uiIndex);
      if (matchIdx < 0) return json(res, 400, { ok: false, error: 'Position not found' });
      const closedRow = currentPositions[matchIdx];
      const entry = parseFloat(closedRow.entryPrice);
      const exitPx = Number.isFinite(parseFloat(String(enriched.currentPrice)))
        ? parseFloat(String(enriched.currentPrice))
        : entry;
      const qty =
        Number.isFinite(parseFloat(closedRow.quantity)) && parseFloat(closedRow.quantity) > 0
          ? parseFloat(closedRow.quantity)
          : quantityFromNotional(parseFloat(closedRow.totalSize), entry);
      const gross = grossPnlUsdt(closedRow.type, entry, exitPx, qty);
      const storedOpen = Number.isFinite(parseFloat(closedRow.openFee))
        ? Math.max(0, parseFloat(closedRow.openFee))
        : 0;
      const margin = parseFloat(closedRow.margin) || 0;
      const finalPnl = closeReason === 'LIQUIDATED' ? -Math.max(0, margin) : gross;
      const balanceCredit =
        closeReason === 'LIQUIDATED' ? margin + finalPnl : margin + finalPnl + storedOpen;
      const newPositions = currentPositions.filter((_, i) => i !== matchIdx);
      let closedPositions = row.closed_positions;
      if (!Array.isArray(closedPositions)) closedPositions = [];
      const closedPosition = {
        ...closedRow,
        exitPrice: exitPx,
        grossPnl: gross,
        openFee: 0,
        closeFee: 0,
        realizedPnl: finalPnl,
        closedAt: new Date().toISOString(),
        status: closeReason,
        closeReason,
        closeId: genPositionId()
      };
      const nextClosed = [...closedPositions, closedPosition];
      const nextBal = vbal + balanceCredit;
      const lifetimeRealized = nextLifetimeRealizedPnl(row.lifetime_realized_pnl, nextClosed, finalPnl);

      const up = await supa
        .from('users')
        .update({
          virtual_balance: nextBal,
          positions: newPositions,
          closed_positions: nextClosed,
          lifetime_realized_pnl: lifetimeRealized
        })
        .eq('uid', uid)
        .eq('virtual_balance', vbal)
        .select(
          'virtual_balance,positions,closed_positions,lifetime_realized_pnl,daily_trades_date,daily_trades_count,daily_ad_trade_bonus,daily_twelve_reward_claimed_date'
        )
        .maybeSingle();
      if (up.error) throw up.error;
      if (up.data) {
        scheduleSyncTradeToFirestore(uid, {
          virtual_balance: nextBal,
          positions: newPositions,
          closed_positions: nextClosed,
          lifetime_realized_pnl: lifetimeRealized,
          daily_trades_date: row.daily_trades_date,
          daily_trades_count: row.daily_trades_count,
          daily_ad_trade_bonus: row.daily_ad_trade_bonus,
          daily_twelve_reward_claimed_date: row.daily_twelve_reward_claimed_date
        });
        return json(res, 200, { ok: true, finalPnl, openF: 0, closeF: 0 });
      }
      await new Promise((r) => setTimeout(r, 80 * (attempt + 1)));
    }
    return json(res, 409, { ok: false, error: 'Close conflict. Try again.' });
  } catch (e) {
    if (isMissingTradingColumnError(e)) {
      await ensureTradingSchema();
    }
    const st = e.status || 500;
    const raw = String(e?.message || e || '');
    let msg = raw || 'error';
    if (/Missing SUPABASE_URL/i.test(raw)) {
      msg = 'Trading server not configured (Supabase env on Vercel). Contact support.';
    } else if (isMissingTradingColumnError(e)) {
      msg =
        'Supabase users table is missing trade columns. Fix: Supabase → SQL Editor → paste & run file supabase/trading_columns_migration.sql (or add DATABASE_URL on Vercel and retry).';
    } else if (/JSON object requested, multiple|no rows|0 rows/i.test(raw)) {
      msg = 'Trading account syncing — refresh the page and try again in a few seconds.';
    }
    return json(res, st, { ok: false, error: msg });
  }
};
