/**
 * Virtual perps simulator — formulas per product spec.
 * Margin = Position Size / Leverage; Position Size = Margin × Leverage.
 */

export const MAINTENANCE_MARGIN_RATE = 0.005;
export const FEE_TAKER = 0;
export const FEE_MAKER = 0;

/** Notional position size (USDT) from margin and leverage. */
export function positionSizeFromMargin(marginUsdt, leverage) {
  return Number(marginUsdt) * Number(leverage);
}

/** Margin required for a given notional (USDT). */
export function marginFromNotional(notionalUsdt, leverage) {
  const lev = Number(leverage) || 1;
  if (lev <= 0) return 0;
  return Number(notionalUsdt) / lev;
}

/** Base-asset quantity: notional / entry. */
export function quantityFromNotional(notionalUsdt, entryPrice) {
  const e = Number(entryPrice);
  if (!Number.isFinite(e) || e <= 0) return 0;
  return Number(notionalUsdt) / e;
}

export function grossPnlUsdt(type, entryPrice, markPrice, quantity) {
  const e = Number(entryPrice);
  const m = Number(markPrice);
  const q = Number(quantity);
  if (!Number.isFinite(e) || !Number.isFinite(m) || !Number.isFinite(q)) return 0;
  if (type === 'LONG') return (m - e) * q;
  if (type === 'SHORT') return (e - m) * q;
  return 0;
}

/** PnL % = ((price move) / entry) × leverage × 100 */
export function pnlPctLev(type, entryPrice, markPrice, leverage) {
  const e = Number(entryPrice);
  const mk = Number(markPrice);
  const lev = Number(leverage) || 1;
  if (!Number.isFinite(e) || e <= 0 || !Number.isFinite(mk)) return 0;
  if (type === 'LONG') return ((mk - e) / e) * lev * 100;
  if (type === 'SHORT') return ((e - mk) / e) * lev * 100;
  return 0;
}

/** ROE % = gross PnL / margin × 100 */
export function roePct(grossPnlUsdtValue, marginUsdt) {
  const margin = Number(marginUsdt);
  if (!Number.isFinite(margin) || margin <= 0) return 0;
  return (Number(grossPnlUsdtValue) / margin) * 100;
}

export function liquidationPrice(type, entryPrice, leverage) {
  const entry = Number(entryPrice);
  const lev = Math.max(1, Number(leverage) || 1);
  if (!Number.isFinite(entry) || entry <= 0) return NaN;
  const imr = 1 / lev;
  const mmr = MAINTENANCE_MARGIN_RATE;
  if (type === 'LONG') return (entry * (1 - imr)) / (1 - mmr);
  if (type === 'SHORT') return (entry * (1 + imr)) / (1 + mmr);
  return NaN;
}

/** Price move % from entry to liquidation (always positive). */
export function liquidationMovePct(type, entryPrice, leverage) {
  const entry = Number(entryPrice);
  const liq = liquidationPrice(type, entryPrice, leverage);
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(liq)) return NaN;
  if (type === 'LONG') return ((entry - liq) / entry) * 100;
  if (type === 'SHORT') return ((liq - entry) / entry) * 100;
  return NaN;
}

export function feeUsdt(notionalUsdt, feeRate) {
  return Number(notionalUsdt) * Number(feeRate);
}

export function openFeeUsdt(positionSizeUsdt, isMarketOrder) {
  return feeUsdt(positionSizeUsdt, isMarketOrder ? FEE_TAKER : FEE_MAKER);
}

/** Close fee on exit notional (taker for market close). */
export function closingFeeTakerUsdt(quantity, exitPrice) {
  return Number(quantity) * Number(exitPrice) * FEE_TAKER;
}

export function netPnlAfterFees(grossPnl, openFee, closeFee) {
  return Number(grossPnl) - Number(openFee) - Number(closeFee);
}

/**
 * ACTIVE | LIQUIDATED — loss >= margin or mark at/beyond liq price.
 */
export function enginePositionStatus(type, markPrice, liqPrice, grossPnl, marginUsdt) {
  const g = Number(grossPnl);
  const m = Number(marginUsdt);
  const mk = Number(markPrice);
  const liq = Number(liqPrice);
  if (Number.isFinite(g) && Number.isFinite(m) && g <= -m) return 'LIQUIDATED';
  if (type === 'LONG' && Number.isFinite(mk) && Number.isFinite(liq) && mk <= liq) return 'LIQUIDATED';
  if (type === 'SHORT' && Number.isFinite(mk) && Number.isFinite(liq) && mk >= liq) return 'LIQUIDATED';
  return 'ACTIVE';
}
