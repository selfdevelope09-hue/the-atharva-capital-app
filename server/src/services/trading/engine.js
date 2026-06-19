const {
  openFeeUsdt,
  quantityFromNotional,
  genPositionId,
  findPositionIndex,
  grossPnlUsdt,
  sumClosedRealizedPnl,
  nextLifetimeRealizedPnl,
  FEE_TAKER,
  FEE_MAKER
} = require('../../lib/tradingMath');
const {
  tradingDayKey,
  MAX_DAILY_OPENS,
  MAX_AD_TRADE_BONUS_SLOTS,
  DAILY_OPENS_FOR_USD_BONUS,
  USD_BONUS_ON_TWELVE_OPENS,
  getBaseDailyOpens
} = require('../../lib/tradingDay');
const { getPool } = require('../../db/pool');
const { ensureUserFromFirebase, getUserByUid, updateUserOptimistic } = require('../../db/usersRepo');
const { rowToAppUser } = require('../../lib/userNormalize');
const { isShowcaseTradeUid } = require('../../lib/tradeActor');

function coercePositions(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return Object.values(v);
  return [];
}

async function openTrade(uid, decoded, body) {
  if (!isShowcaseTradeUid(uid)) {
    await ensureUserFromFirebase(decoded);
  }

  const symbol = String(body.symbol || '').trim().toUpperCase();
  const side = String(body.side || '').toUpperCase();
  const leverage = Math.max(1, parseInt(body.leverage, 10) || 1);
  const amount = Number(body.amount);
  const execPrice = Number(body.execPrice);
  const orderType = String(body.orderType || 'Market');

  if (!symbol || !['BUY', 'SELL'].includes(side) || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Invalid trade parameters' };
  }
  if (!Number.isFinite(execPrice) || execPrice <= 0) {
    return { ok: false, error: 'Invalid price' };
  }

  const isMarket = orderType === 'Market';
  const feeRate = isMarket ? FEE_TAKER : FEE_MAKER;
  const openFee = openFeeUsdt(amount, isMarket);
  const marginReq = amount / leverage;
  const totalDebit = marginReq + openFee;
  const qtyOpen = quantityFromNotional(amount, execPrice);
  const dayKey = tradingDayKey();

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

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = await getUserByUid(uid);
    if (!row) {
      if (isShowcaseTradeUid(uid)) {
        return { ok: false, error: 'Showcase profile not found' };
      }
      await ensureUserFromFirebase(decoded);
      continue;
    }

    const vbal = Number(row.virtual_balance);
    if (totalDebit > vbal) return { ok: false, error: 'Insufficient balance' };

    const isShowcase = isShowcaseTradeUid(uid) || row.is_showcase_profile === true;

    let dCount = Number(row.daily_trades_count) || 0;
    let adBonus = Number(row.daily_ad_trade_bonus) || 0;
    let claimDate =
      row.daily_twelve_reward_claimed_date != null
        ? String(row.daily_twelve_reward_claimed_date).slice(0, 10)
        : '';
    const dSaved = row.daily_trades_date != null ? String(row.daily_trades_date).slice(0, 10) : '';

    if (!isShowcase) {
      if (dSaved !== dayKey) {
        dCount = 0;
        adBonus = 0;
        claimDate = '';
      } else if (!require('../../lib/paidPlan').isPaidRow(row)) {
        adBonus = Math.min(MAX_AD_TRADE_BONUS_SLOTS, Math.max(0, adBonus));
      } else {
        adBonus = 0;
      }

      const baseOpens = getBaseDailyOpens(row);
      const allowedOpens = baseOpens + adBonus;
      if (dCount >= allowedOpens) {
        const paidNote = require('../../lib/paidPlan').isPaidRow(row)
          ? ` (${row.paid_plan_type || 'paid'} plan)`
          : ` — base ${MAX_DAILY_OPENS} + ${adBonus} from ads`;
        return {
          ok: false,
          error: `Daily trade limit reached (${allowedOpens} opens this IST day${paidNote}).`
        };
      }
    }

    const newCount = isShowcase ? dCount : dCount + 1;
    const claimedForToday = claimDate === dayKey;
    let twelveBonus = 0;
    let nextClaimDate = claimDate || null;
    if (!isShowcase && newCount >= DAILY_OPENS_FOR_USD_BONUS && !claimedForToday) {
      twelveBonus = USD_BONUS_ON_TWELVE_OPENS;
      nextClaimDate = dayKey;
    }

    const positions = coercePositions(row.positions);
    const nextPositions = [...positions, newPosition];

    const updateFields = {
      virtual_balance: vbal - totalDebit + twelveBonus,
      positions: nextPositions
    };
    if (!isShowcase) {
      updateFields.daily_trades_date = dayKey;
      updateFields.daily_trades_count = newCount;
      updateFields.daily_ad_trade_bonus = adBonus;
      updateFields.daily_twelve_reward_claimed_date = nextClaimDate;
    }

    const updated = await updateUserOptimistic(uid, vbal, updateFields);

    if (updated) {
      return {
        ok: true,
        user: rowToAppUser(updated),
        twelveTradeBonusUsd: twelveBonus || undefined,
        dailyOpensToday: newCount
      };
    }
    await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
  }

  return { ok: false, error: 'Order could not be placed. Try again.' };
}

async function updatePositionTpSl(uid, decoded, body) {
  if (!isShowcaseTradeUid(uid)) {
    await ensureUserFromFirebase(decoded);
  }

  const enriched = body.enriched;
  const uiIndex = Number(body.uiIndex);
  if (!enriched || typeof enriched !== 'object') {
    return { ok: false, error: 'Missing position' };
  }

  const tpRaw = body.tp;
  const slRaw = body.sl;
  const tp = tpRaw != null && tpRaw !== '' ? Number(tpRaw) : null;
  const sl = slRaw != null && slRaw !== '' ? Number(slRaw) : null;
  if (tp != null && (!Number.isFinite(tp) || tp <= 0)) return { ok: false, error: 'Invalid take profit' };
  if (sl != null && (!Number.isFinite(sl) || sl <= 0)) return { ok: false, error: 'Invalid stop loss' };

  const entry = Number(enriched.entryPrice);
  const type = enriched.type;
  const isLong = String(type).toUpperCase() === 'LONG';
  if (tp != null) {
    if (isLong && tp <= entry) return { ok: false, error: 'TP must be above entry for LONG' };
    if (!isLong && tp >= entry) return { ok: false, error: 'TP must be below entry for SHORT' };
  }
  if (sl != null) {
    if (isLong && sl >= entry) return { ok: false, error: 'SL must be below entry for LONG' };
    if (!isLong && sl <= entry) return { ok: false, error: 'SL must be above entry for SHORT' };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = await getUserByUid(uid);
    if (!row) {
      if (isShowcaseTradeUid(uid)) return { ok: false, error: 'Showcase profile not found' };
      await ensureUserFromFirebase(decoded);
      continue;
    }

    const vbal = Number(row.virtual_balance);
    let currentPositions = coercePositions(row.positions);
    const matchIdx = findPositionIndex(currentPositions, enriched, uiIndex);
    if (matchIdx < 0) return { ok: false, error: 'Position not found' };

    const nextPositions = currentPositions.map((p, i) =>
      i === matchIdx ? { ...p, tp, sl } : p
    );

    const updated = await updateUserOptimistic(uid, vbal, { positions: nextPositions });
    if (updated) {
      return { ok: true, user: rowToAppUser(updated) };
    }
    await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
  }

  return { ok: false, error: 'Could not update position. Try again.' };
}

async function closeTrade(uid, decoded, body) {
  if (!isShowcaseTradeUid(uid)) {
    await ensureUserFromFirebase(decoded);
  }

  const enriched = body.enriched;
  const uiIndex = Number(body.uiIndex);
  const closeReason = ['LIQUIDATED', 'TP', 'SL'].includes(body.closeReason) ? body.closeReason : 'MANUAL';

  if (!enriched || typeof enriched !== 'object') {
    return { ok: false, error: 'Missing enriched position' };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = await getUserByUid(uid);
    if (!row) {
      if (isShowcaseTradeUid(uid)) {
        return { ok: false, error: 'Showcase profile not found' };
      }
      await ensureUserFromFirebase(decoded);
      continue;
    }

    const vbal = Number(row.virtual_balance);
    let currentPositions = coercePositions(row.positions);
    const matchIdx = findPositionIndex(currentPositions, enriched, uiIndex);
    if (matchIdx < 0) return { ok: false, error: 'Position not found' };

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
    let closedPositions = coercePositions(row.closed_positions);
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

    const updated = await updateUserOptimistic(uid, vbal, {
      virtual_balance: nextBal,
      positions: newPositions,
      closed_positions: nextClosed,
      lifetime_realized_pnl: lifetimeRealized
    });

    if (updated) {
      if (closeReason === 'LIQUIDATED') {
        getPool()
          .query(
            `update users set creds_liquidations_count = coalesce(creds_liquidations_count, 0) + 1, updated_at = now() where uid = $1`,
            [uid]
          )
          .catch(() => {});
      }
      return {
        ok: true,
        user: rowToAppUser(updated),
        finalPnl,
        openF: 0,
        closeF: 0
      };
    }
    await new Promise((r) => setTimeout(r, 80 * (attempt + 1)));
  }

  return { ok: false, error: 'Close conflict. Try again.' };
}

module.exports = { openTrade, closeTrade, updatePositionTpSl };
