/** Duplicated from src/tradingEngine.js + src/utils/positionUtils.js for CommonJS API routes. */

const crypto = require('crypto');

const FEE_TAKER = 0;
const FEE_MAKER = 0;

function quantityFromNotional(notionalUsdt, entryPrice) {
  const e = Number(entryPrice);
  if (!Number.isFinite(e) || e <= 0) return 0;
  return Number(notionalUsdt) / e;
}

function grossPnlUsdt(type, entryPrice, markPrice, quantity) {
  const e = Number(entryPrice);
  const m = Number(markPrice);
  const q = Number(quantity);
  if (!Number.isFinite(e) || !Number.isFinite(m) || !Number.isFinite(q)) return 0;
  if (type === 'LONG') return (m - e) * q;
  if (type === 'SHORT') return (e - m) * q;
  return 0;
}

function feeUsdt(notionalUsdt, feeRate) {
  return Number(notionalUsdt) * Number(feeRate);
}

function openFeeUsdt(positionSizeUsdt, isMarketOrder) {
  return feeUsdt(positionSizeUsdt, isMarketOrder ? FEE_TAKER : FEE_MAKER);
}

function closingFeeTakerUsdt(quantity, exitPrice) {
  return Number(quantity) * Number(exitPrice) * FEE_TAKER;
}

function netPnlAfterFees(grossPnl, openFee, closeFee) {
  return Number(grossPnl) - Number(openFee) - Number(closeFee);
}

function genPositionId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function positionDedupeKey(p) {
  if (!p || typeof p !== 'object') return '';
  if (p.positionId) return String(p.positionId);
  return `${String(p.symbol || '').toUpperCase()}|${Number(p.entryPrice)}|${p.type}|${p.time || ''}|${Number(p.margin)}`;
}

function findFirestorePositionIndex(currentPositions, enrichedPos, uiIndex) {
  const arr = Array.isArray(currentPositions) ? currentPositions : [];
  const targetKey = positionDedupeKey(enrichedPos);
  if (targetKey) {
    const byKey = arr.findIndex((x) => positionDedupeKey(x) === targetKey);
    if (byKey >= 0) return byKey;
  }
  if (enrichedPos?.positionId) {
    const byId = arr.findIndex((x) => x && x.positionId === enrichedPos.positionId);
    if (byId >= 0) return byId;
  }
  if (uiIndex >= 0 && uiIndex < arr.length) {
    const c = arr[uiIndex];
    if (
      c &&
      String(c.symbol || '').toUpperCase() === String(enrichedPos.symbol || '').toUpperCase() &&
      Math.abs(Number(c.entryPrice) - Number(enrichedPos.entryPrice)) < 1e-7 &&
      c.type === enrichedPos.type
    ) {
      return uiIndex;
    }
  }
  return arr.findIndex(
    (c) =>
      c &&
      String(c.symbol || '').toUpperCase() === String(enrichedPos.symbol || '').toUpperCase() &&
      Math.abs(Number(c.entryPrice) - Number(enrichedPos.entryPrice)) < 1e-7 &&
      c.type === enrichedPos.type &&
      Math.abs(Number(c.margin) - Number(enrichedPos.margin)) < 1e-4 &&
      Math.abs(Number(c.totalSize) - Number(enrichedPos.totalSize)) < 1e-4
  );
}

function sumClosedRealizedPnl(closedPositions) {
  const arr = Array.isArray(closedPositions) ? closedPositions : [];
  return arr.reduce((s, p) => {
    const v = p?.realizedPnl ?? p?.realized_pnl ?? p?.grossPnl ?? p?.gross_pnl ?? 0;
    const n = Number(v);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function nextLifetimeRealizedPnl(prevStored, nextClosedPositions, deltaPnl) {
  const fromSum = sumClosedRealizedPnl(nextClosedPositions);
  const prev = Number(prevStored);
  const delta = Number(deltaPnl);
  if (Number.isFinite(prev) && Number.isFinite(delta)) {
    return Math.max(fromSum, prev + delta);
  }
  return fromSum;
}

module.exports = {
  FEE_TAKER,
  FEE_MAKER,
  quantityFromNotional,
  grossPnlUsdt,
  openFeeUsdt,
  closingFeeTakerUsdt,
  netPnlAfterFees,
  genPositionId,
  findFirestorePositionIndex,
  sumClosedRealizedPnl,
  nextLifetimeRealizedPnl
};
