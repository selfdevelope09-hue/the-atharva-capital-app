const { tradeViaDigitalOcean, proxyJsonToDigitalOcean } = require('../../_lib/proxyToDigitalOcean.cjs');
const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { json, readBody, applyApiCors, handleCorsPreflight } = require('../../_lib/http');
const {
  openFeeUsdt,
  quantityFromNotional,
  genPositionId,
  FEE_TAKER,
  FEE_MAKER
} = require('../../_lib/virtualPerps.cjs');
const { tradingDayKey, MAX_DAILY_OPENS, MAX_AD_TRADE_BONUS_SLOTS } = require('../../_lib/tradingDay.cjs');
const { getBlockedUidSet } = require('../../_lib/blockedUsers.cjs');
const { isUidRemoved } = require('../../_lib/removedUsers.cjs');
const { scheduleSyncTradeToFirestore } = require('../../_lib/syncTradeToFirestore.cjs');
const { ensureSupabaseUser } = require('../../_lib/ensureSupabaseUser.cjs');
const { ensureTradingSchema, isMissingTradingColumnError } = require('../../_lib/ensureTradingSchema.cjs');
const { supabaseConfigured } = require('../../_lib/supabaseConfigured.cjs');
const { hasSupabaseTradingColumns } = require('../../_lib/checkSupabaseTradingSchema.cjs');
/** Keep in sync with src/utils/rewardConstants.js DAILY_OPENS_TARGET_FOR_USD_BONUS */
const DAILY_OPENS_FOR_USD_BONUS = 8;
const USD_BONUS_ON_TWELVE_OPENS = 1000;

module.exports = async (req, res) => {
  if (tradeViaDigitalOcean()) {
    return proxyJsonToDigitalOcean(req, res, '/api/trade/open');
  }
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  let decoded;
  let body;
  try {
    decoded = await verifyBearer(req);
    const blocked = await getBlockedUidSet();
    if (blocked.has(decoded.uid)) {
      return json(res, 403, { ok: false, error: 'Account restricted', platformBlocked: true });
    }
    if (await isUidRemoved(decoded.uid)) {
      return json(res, 403, {
        ok: false,
        error: 'Account removed',
        accountRemoved: true,
        platformBlocked: true
      });
    }
    body = readBody(req);
    const symbol = String(body.symbol || '').trim();
    const side = String(body.side || '').toUpperCase();
    const leverage = Math.max(1, parseInt(body.leverage, 10) || 1);
    const amount = Number(body.amount);
    const execPrice = Number(body.execPrice);
    const orderType = String(body.orderType || 'Market');
    if (!symbol || !['BUY', 'SELL'].includes(side) || !Number.isFinite(amount) || amount <= 0) {
      return json(res, 400, { ok: false, error: 'Invalid trade parameters' });
    }
    if (!Number.isFinite(execPrice) || execPrice <= 0) {
      return json(res, 400, { ok: false, error: 'Invalid price' });
    }

    const isMarket = orderType === 'Market';
    const feeRate = isMarket ? FEE_TAKER : FEE_MAKER;
    const openFee = openFeeUsdt(amount, isMarket);
    const marginReq = amount / leverage;
    const totalDebit = marginReq + openFee;
    const qtyOpen = quantityFromNotional(amount, execPrice);

    const newPosition = {
      positionId: genPositionId(),
      symbol,
      type: side === 'BUY' ? 'LONG' : 'SHORT',
      entryPrice: execPrice,
      leverage,
      margin: marginReq,
      totalSize: amount,
      quantity: qtyOpen,
      openFee,
      feeRate,
      tp: body.tp != null && body.tp !== '' ? Number(body.tp) : null,
      sl: body.sl != null && body.sl !== '' ? Number(body.sl) : null,
      status: 'OPEN',
      time: new Date().toISOString()
    };

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
    const dayKey = tradingDayKey();
    await ensureSupabaseUser(supa, decoded);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: row, error: rErr } = await supa
        .from('users')
        .select(
          'virtual_balance,positions,daily_trades_date,daily_trades_count,daily_ad_trade_bonus,daily_twelve_reward_claimed_date'
        )
        .eq('uid', uid)
        .maybeSingle();
      if (rErr) throw rErr;
      if (!row) {
        await ensureSupabaseUser(supa, decoded);
        continue;
      }
      const vbal = Number(row.virtual_balance);
      if (totalDebit > vbal) return json(res, 400, { ok: false, error: 'Insufficient balance' });
      let dCount = Number(row.daily_trades_count) || 0;
      let adBonus = Number(row.daily_ad_trade_bonus) || 0;
      let claimDate =
        row.daily_twelve_reward_claimed_date != null
          ? String(row.daily_twelve_reward_claimed_date).slice(0, 10)
          : '';
      const dSaved = row.daily_trades_date != null ? String(row.daily_trades_date).slice(0, 10) : '';
      if (dSaved !== dayKey) {
        dCount = 0;
        adBonus = 0;
        claimDate = '';
      } else {
        adBonus = Math.min(MAX_AD_TRADE_BONUS_SLOTS, Math.max(0, adBonus));
      }
      const allowedOpens = MAX_DAILY_OPENS + adBonus;
      if (dCount >= allowedOpens) {
        return json(res, 400, {
          ok: false,
          error: `Daily trade limit reached (${allowedOpens} opens this IST day — base ${MAX_DAILY_OPENS} + ${adBonus} from ads). Watch ads in Wallet for up to ${MAX_AD_TRADE_BONUS_SLOTS} extra.`
        });
      }
      const newCount = dCount + 1;
      const claimedForToday = claimDate === dayKey;
      let twelveBonus = 0;
      let nextClaimDate = claimDate || null;
      if (newCount >= DAILY_OPENS_FOR_USD_BONUS && !claimedForToday) {
        twelveBonus = USD_BONUS_ON_TWELVE_OPENS;
        nextClaimDate = dayKey;
      }
      let positions = row.positions;
      if (!Array.isArray(positions)) positions = [];
      const nextPositions = [...positions, newPosition];
      const up = await supa
        .from('users')
        .update({
          virtual_balance: vbal - totalDebit + twelveBonus,
          positions: nextPositions,
          daily_trades_date: dayKey,
          daily_trades_count: newCount,
          daily_ad_trade_bonus: adBonus,
          daily_twelve_reward_claimed_date: nextClaimDate
        })
        .eq('uid', uid)
        .eq('virtual_balance', vbal)
        .select(
          'virtual_balance,positions,closed_positions,lifetime_realized_pnl,daily_trades_date,daily_trades_count,daily_ad_trade_bonus,daily_twelve_reward_claimed_date'
        )
        .maybeSingle();
      if (up.error) throw up.error;
      if (up.data) {
        scheduleSyncTradeToFirestore(uid, up.data);
        return json(res, 200, {
          ok: true,
          twelveTradeBonusUsd: twelveBonus || undefined,
          dailyOpensToday: newCount
        });
      }
      await new Promise((r) => setTimeout(r, 60 * (attempt + 1)));
    }
    return json(res, 409, { ok: false, error: 'Order could not be placed. Try again.' });
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
