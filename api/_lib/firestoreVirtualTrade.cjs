const { getFirestore } = require('./firebaseAdmin');
const {
  openFeeUsdt,
  quantityFromNotional,
  genPositionId,
  FEE_TAKER,
  FEE_MAKER
} = require('./virtualPerps.cjs');
const { tradingDayKey, MAX_DAILY_OPENS, MAX_AD_TRADE_BONUS_SLOTS } = require('./tradingDay.cjs');

const DAILY_OPENS_FOR_USD_BONUS = 8;
const USD_BONUS_ON_TWELVE_OPENS = 1000;

async function openVirtualTradeFirestore(uid, body) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error('Firebase admin not configured on server');
  }
  const symbol = String(body.symbol || '').trim();
  const side = String(body.side || '').toUpperCase();
  const leverage = Math.max(1, parseInt(body.leverage, 10) || 1);
  const amount = Number(body.amount);
  const execPrice = Number(body.execPrice);
  const orderType = String(body.orderType || 'Market');
  const isMarket = orderType === 'Market';
  const feeRate = isMarket ? FEE_TAKER : FEE_MAKER;
  const openFee = openFeeUsdt(amount, isMarket);
  const marginReq = amount / leverage;
  const totalDebit = marginReq + openFee;
  const qtyOpen = quantityFromNotional(amount, execPrice);
  const dayKey = tradingDayKey();

  const db = getFirestore();
  const ref = db.collection('users').doc(String(uid));

  let twelveBonus = 0;
  let dailyOpensToday = 0;

  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) throw new Error('User does not exist');
    const raw = snap.data() || {};
    let dCount = Number(raw.dailyTradesCount) || 0;
    let adB = Number(raw.dailyAdTradeBonus) || 0;
    const dSaved = raw.dailyTradesDate != null ? String(raw.dailyTradesDate).slice(0, 10) : '';
    if (dSaved !== dayKey) {
      dCount = 0;
      adB = 0;
    } else {
      adB = Math.min(MAX_AD_TRADE_BONUS_SLOTS, Math.max(0, adB));
    }
    const allowed = MAX_DAILY_OPENS + adB;
    if (dCount >= allowed) throw new Error('Daily trade limit reached');
    const vbal = Number(raw.virtualBalance);
    if (totalDebit > vbal) throw new Error('Insufficient balance');
    let claimDate =
      raw.dailyTwelveRewardClaimedDate != null ? String(raw.dailyTwelveRewardClaimedDate).slice(0, 10) : '';
    if (dSaved !== dayKey) claimDate = '';
    const newCount = dCount + 1;
    dailyOpensToday = newCount;
    const claimedForToday = claimDate === dayKey;
    let nextClaim = claimDate || '';
    if (newCount >= DAILY_OPENS_FOR_USD_BONUS && !claimedForToday) {
      twelveBonus = USD_BONUS_ON_TWELVE_OPENS;
      nextClaim = dayKey;
    }
    const positions = Array.isArray(raw.positions) ? raw.positions : [];
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
    t.update(ref, {
      virtualBalance: vbal - totalDebit + twelveBonus,
      positions: [...positions, newPosition],
      dailyTradesDate: dayKey,
      dailyTradesCount: newCount,
      dailyAdTradeBonus: adB,
      dailyTwelveRewardClaimedDate: nextClaim
    });
  });

  return {
    twelveTradeBonusUsd: twelveBonus || undefined,
    dailyOpensToday,
    via: 'firestore'
  };
}

async function closeVirtualTradeFirestore(uid, body) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error('Firebase admin not configured on server');
  }
  const enriched = body.enriched;
  const uiIndex = Number(body.uiIndex);
  const closeReason = body.closeReason === 'LIQUIDATED' ? 'LIQUIDATED' : 'MANUAL';
  const {
    grossPnlUsdt,
    quantityFromNotional: qtyFromNotional,
    findFirestorePositionIndex,
    sumClosedRealizedPnl,
    nextLifetimeRealizedPnl
  } = require('./virtualPerps.cjs');

  const db = getFirestore();
  const ref = db.collection('users').doc(String(uid));
  let finalPnl = 0;

  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) throw new Error('User doc missing');
    const d = snap.data() || {};
    const currentPositions = Array.isArray(d.positions) ? d.positions : [];
    const matchIdx = findFirestorePositionIndex(currentPositions, enriched, uiIndex);
    if (matchIdx < 0) throw new Error('Position not found');
    const closedRow = currentPositions[matchIdx];
    const entry = parseFloat(closedRow.entryPrice);
    const exitPx = Number.isFinite(parseFloat(String(enriched.currentPrice)))
      ? parseFloat(String(enriched.currentPrice))
      : entry;
    const qty =
      Number.isFinite(parseFloat(closedRow.quantity)) && parseFloat(closedRow.quantity) > 0
        ? parseFloat(closedRow.quantity)
        : qtyFromNotional(parseFloat(closedRow.totalSize), entry);
    const gross = grossPnlUsdt(closedRow.type, entry, exitPx, qty);
    const storedOpen = Number.isFinite(parseFloat(closedRow.openFee))
      ? Math.max(0, parseFloat(closedRow.openFee))
      : 0;
    const margin = parseFloat(closedRow.margin) || 0;
    finalPnl = closeReason === 'LIQUIDATED' ? -Math.max(0, margin) : gross;
    const balanceCredit =
      closeReason === 'LIQUIDATED' ? margin + finalPnl : margin + finalPnl + storedOpen;
    const newPositions = currentPositions.filter((_, i) => i !== matchIdx);
    const closedPositions = Array.isArray(d.closedPositions) ? d.closedPositions : [];
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
    const nextBal = Number(d.virtualBalance) + balanceCredit;
    const lifetimeRealized = nextLifetimeRealizedPnl(d.lifetimeRealizedPnl, nextClosed, finalPnl);
    t.update(ref, {
      virtualBalance: nextBal,
      positions: newPositions,
      closedPositions: nextClosed,
      lifetimeRealizedPnl: lifetimeRealized
    });
  });

  return { finalPnl, openF: 0, closeF: 0, via: 'firestore' };
}

module.exports = { openVirtualTradeFirestore, closeVirtualTradeFirestore };
