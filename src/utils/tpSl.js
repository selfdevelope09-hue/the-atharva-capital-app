/** Take-profit / stop-loss helpers for open positions. */

export function normalizeTpSl(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @returns {'TP'|'SL'|null}
 */
export function tpSlTriggerReason(position, markPrice) {
  const mark = Number(markPrice);
  if (!Number.isFinite(mark) || mark <= 0 || !position) return null;
  const tp = normalizeTpSl(position.tp);
  const sl = normalizeTpSl(position.sl);
  const isLong = String(position.type || '').toUpperCase() === 'LONG';
  if (tp != null) {
    if (isLong && mark >= tp) return 'TP';
    if (!isLong && mark <= tp) return 'TP';
  }
  if (sl != null) {
    if (isLong && mark <= sl) return 'SL';
    if (!isLong && mark >= sl) return 'SL';
  }
  return null;
}

/**
 * @returns {string|null} Error message, or null if valid.
 */
export function validateTpSlForPosition({ type, entryPrice, tp, sl }) {
  const entry = Number(entryPrice);
  if (!Number.isFinite(entry) || entry <= 0) return 'Invalid entry price.';
  const isLong = String(type || '').toUpperCase() === 'LONG';
  const tpN = normalizeTpSl(tp);
  const slN = normalizeTpSl(sl);
  if (tpN == null && slN == null) return 'Set at least take profit or stop loss.';
  if (tpN != null) {
    if (isLong && tpN <= entry) return 'Take profit must be above entry for LONG.';
    if (!isLong && tpN >= entry) return 'Take profit must be below entry for SHORT.';
  }
  if (slN != null) {
    if (isLong && slN >= entry) return 'Stop loss must be below entry for LONG.';
    if (!isLong && slN <= entry) return 'Stop loss must be above entry for SHORT.';
  }
  if (tpN != null && slN != null) {
    if (isLong && slN >= tpN) return 'Stop loss must be below take profit for LONG.';
    if (!isLong && slN <= tpN) return 'Stop loss must be above take profit for SHORT.';
  }
  return null;
}

export function formatTpSlLabel(v) {
  const n = normalizeTpSl(v);
  if (n == null) return '—';
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 8 })}`;
}
