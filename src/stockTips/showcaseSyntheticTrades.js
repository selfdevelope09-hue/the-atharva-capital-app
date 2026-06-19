/**
 * Virtual closed trades for showcase profiles: sum(realizedPnl) === totalPnl (cent-exact).
 * Per-trade PnL varies (weighted split); last trade absorbs rounding remainder.
 */

import { TRADING_PAIRS_USDT } from '../config/tradingPairs';

const DEFAULT_SYMBOLS = TRADING_PAIRS_USDT;

function hashString(s) {
  let h = 2166136261 >>> 0;
  const str = String(s || 'seed');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function nextRand(h) {
  return (Math.imul(h, 1103515245) + 12345) >>> 0;
}

/**
 * @param {number} totalPnlUsd
 * @param {number} numTrades
 * @param {string} [seedStr] — stable per showcase profile so history shape stays same until regenerated
 */
export function buildSyntheticClosedPositions(totalPnlUsd, numTrades, seedStr = '') {
  const n = Math.max(0, Math.min(500, Math.floor(Number(numTrades)) || 0));
  const total = Number(totalPnlUsd);
  if (n === 0 || !Number.isFinite(total)) return [];

  const cents = Math.round(total * 100);
  const seed = hashString(`${seedStr}|${n}|${cents}`);
  const weights = [];
  let h = seed;
  for (let i = 0; i < n; i++) {
    h = nextRand(h);
    weights.push(0.2 + ((h % 10000) / 10000) * 1.8);
  }
  const sumW = weights.reduce((a, b) => a + b, 0);
  const parts = weights.map((w) => Math.floor((cents * w) / sumW));
  const allocated = parts.reduce((a, b) => a + b, 0);
  parts[n - 1] += cents - allocated;

  const now = Date.now();
  const out = [];
  for (let i = 0; i < n; i++) {
    const pnlCents = parts[i];
    const realizedPnl = pnlCents / 100;
    const isLong = i % 2 === 0;
    const entryPrice = 60000 + ((i * 7919) % 8000);
    const totalSize = 150 + (i % 7) * 75;
    const qty = Number(totalSize) > 0 && entryPrice > 0 ? Number(totalSize) / entryPrice : 0;
    const exitPrice =
      qty > 1e-12 && Number.isFinite(realizedPnl)
        ? isLong
          ? entryPrice + realizedPnl / qty
          : entryPrice - realizedPnl / qty
        : entryPrice;

    out.push({
      symbol: DEFAULT_SYMBOLS[i % DEFAULT_SYMBOLS.length],
      type: isLong ? 'LONG' : 'SHORT',
      leverage: [5, 10, 20][i % 3],
      entryPrice,
      totalSize,
      exitPrice,
      margin: totalSize / ([5, 10, 20][i % 3]),
      grossPnl: realizedPnl,
      closeFee: 0,
      openFee: 0,
      realizedPnl,
      closedAt: new Date(now - (n - i) * 43 * 60 * 1000).toISOString(),
      status: 'CLOSED',
      closeReason: 'MANUAL',
      isSyntheticShowcase: true
    });
  }
  return out;
}

export function sumSyntheticPnL(closed) {
  if (!Array.isArray(closed)) return 0;
  return closed.reduce((s, p) => s + Number(p?.realizedPnl ?? 0), 0);
}
