/** Coerce legacy / partial Firestore position rows for UI + close transactions. */
export function normalizeOpenPosition(raw) {
  if (!raw || typeof raw !== 'object') return null;
  let type = String(raw.type || '').toUpperCase();
  if (type === 'BUY') type = 'LONG';
  if (type === 'SELL') type = 'SHORT';
  if (type !== 'LONG' && type !== 'SHORT') type = 'LONG';

  const entry = Number(raw.entryPrice ?? raw.entry_price ?? raw.price);
  const leverage = Number(raw.leverage);
  const lev = Number.isFinite(leverage) && leverage > 0 ? leverage : 1;
  let totalSize = Number(raw.totalSize ?? raw.notional ?? raw.size);
  let margin = Number(raw.margin);
  if (!Number.isFinite(totalSize) || totalSize <= 0) {
    if (Number.isFinite(margin) && margin > 0 && lev > 0) totalSize = margin * lev;
    else totalSize = 0;
  }
  if (!Number.isFinite(margin) || margin <= 0) {
    margin = lev > 0 && totalSize > 0 ? totalSize / lev : 0;
  }
  let quantity = Number(raw.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    quantity = Number.isFinite(entry) && entry > 0 && totalSize > 0 ? totalSize / entry : 0;
  }

  return {
    ...raw,
    symbol: String(raw.symbol || '').toUpperCase(),
    type,
    entryPrice: Number.isFinite(entry) && entry > 0 ? entry : 0,
    leverage: lev,
    margin: Number.isFinite(margin) && margin >= 0 ? margin : 0,
    totalSize: Number.isFinite(totalSize) && totalSize >= 0 ? totalSize : 0,
    quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : 0,
    openFee: Number.isFinite(Number(raw.openFee)) ? Math.max(0, Number(raw.openFee)) : 0,
    tp: (() => {
      const v = Number(raw.tp);
      return Number.isFinite(v) && v > 0 ? v : null;
    })(),
    sl: (() => {
      const v = Number(raw.sl);
      return Number.isFinite(v) && v > 0 ? v : null;
    })(),
    status: raw.status || 'OPEN'
  };
}

export const fmtQuoteVol = (q) => {
  if (q == null || Number.isNaN(q)) return '—';
  if (q >= 1e9) return `${(q / 1e9).toFixed(2)}B`;
  if (q >= 1e6) return `${(q / 1e6).toFixed(2)}M`;
  if (q >= 1e3) return `${(q / 1e3).toFixed(1)}K`;
  return q.toFixed(0);
};

export const sumClosedRealizedPnl = (closedPositions) => {
  const arr = Array.isArray(closedPositions) ? closedPositions : [];
  return arr.reduce((s, p) => {
    const v = p?.realizedPnl ?? p?.realized_pnl ?? p?.grossPnl ?? p?.gross_pnl ?? 0;
    const n = Number(v);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
};

/** Increment stored lifetime P/L on close — never capped; survives partial closed-history reads. */
export function nextLifetimeRealizedPnl(prevStored, nextClosedPositions, deltaPnl) {
  const fromSum = sumClosedRealizedPnl(nextClosedPositions);
  const prev = Number(prevStored);
  const delta = Number(deltaPnl);
  if (Number.isFinite(prev) && Number.isFinite(delta)) {
    return Math.max(fromSum, prev + delta);
  }
  return fromSum;
}

function parseUsdNumber(v) {
  if (v == null || v === '') return NaN;
  const n = Number(typeof v === 'string' ? v.replace(/,/g, '') : v);
  return Number.isFinite(n) ? n : NaN;
}

/** Leaderboard / profile: max of stored lifetime, closed sum, showcase board — no cap. */
export function resolveLeaderboardPnlTotal(row, showcaseBoardPnl = null) {
  if (!row || typeof row !== 'object') return 0;
  const fromClosed = sumClosedRealizedPnl(row.closedPositions ?? row.closed_positions);
  const storedRaw = parseUsdNumber(
    row.lifetimeRealizedPnl ?? row.lifetime_realized_pnl ?? row.realizedPnlTotal
  );
  const stored = Number.isFinite(storedRaw) ? storedRaw : null;
  const showcaseRaw =
    showcaseBoardPnl != null
      ? parseUsdNumber(showcaseBoardPnl)
      : parseUsdNumber(row.showcaseBoardPnl ?? row.showcase_board_pnl ?? row.pnl);
  let total = fromClosed;
  if (stored != null) total = Math.max(total, stored);
  if (Number.isFinite(showcaseRaw)) total = Math.max(total, showcaseRaw);
  const existing = parseUsdNumber(row.realizedPnlTotal);
  if (Number.isFinite(existing)) total = Math.max(total, existing);
  return total;
}

export const genPositionId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `p_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

/** Dedupe / auto-liq guards — stable for open positions. */
export const positionDedupeKey = (p) => {
  if (!p || typeof p !== 'object') return '';
  if (p.positionId) return String(p.positionId);
  return `${String(p.symbol || '').toUpperCase()}|${Number(p.entryPrice)}|${p.type}|${p.time || ''}|${Number(p.margin)}`;
};

export function findFirestorePositionIndex(currentPositions, enrichedPos, uiIndex) {
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

/** Removes duplicate closed rows (e.g. double-tap close race). */
export function dedupeClosedPositionsList(arr) {
  if (!Array.isArray(arr) || !arr.length) return [];
  const byKey = new Map();
  for (const p of arr) {
    const cid = p?.closeId || p?.positionId;
    const k = cid
      ? `cid:${cid}`
      : `${p?.symbol}|${p?.closedAt}|${p?.entryPrice}|${p?.exitPrice}|${Number(p?.realizedPnl)}`;
    if (!byKey.has(k)) byKey.set(k, p);
  }
  return Array.from(byKey.values());
}
