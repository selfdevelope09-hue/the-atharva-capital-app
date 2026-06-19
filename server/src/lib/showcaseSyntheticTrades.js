const { TRADING_PAIRS_USDT } = require('../config/tradingPairs');
const DEFAULT_SYMBOLS = TRADING_PAIRS_USDT;

/** Approximate mark prices for realistic entry/exit (updated periodically). */
const SYMBOL_MARKS = {
  BTCUSDT: 98500,
  ETHUSDT: 3650,
  SOLUSDT: 185,
  BNBUSDT: 620,
  XRPUSDT: 2.35,
  DOGEUSDT: 0.22
};

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

function buildSyntheticClosedPositions(totalPnlUsd, numTrades, seedStr = '', closedAtEndMs = Date.now()) {
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

  const endMs = Number(closedAtEndMs) || Date.now();
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
      closedAt: new Date(endMs - (n - i) * 43 * 60 * 1000).toISOString(),
      status: 'CLOSED',
      closeReason: 'MANUAL',
      isSyntheticShowcase: true
    });
  }
  return out;
}

/**
 * One realistic closed trade for admin P/L bumps — looks like a real manual close.
 * @param {number} realizedPnl — exact P/L to record (profit or loss)
 * @param {number} [closedAtMs] — when the trade "closed" (defaults to now)
 * @param {string} [seedStr] — stable randomness per profile
 */
function buildRealisticClosedTrade(realizedPnl, closedAtMs = Date.now(), seedStr = '') {
  const pnl = Number(realizedPnl);
  if (!Number.isFinite(pnl) || pnl === 0) return null;

  const crypto = require('crypto');
  const { genPositionId } = require('./tradingMath');

  let h = hashString(`${seedStr}|real|${Math.round(pnl * 100)}|${closedAtMs}`);
  h = nextRand(h);
  const symbol = DEFAULT_SYMBOLS[h % DEFAULT_SYMBOLS.length];
  const baseMark = SYMBOL_MARKS[symbol] || 1000;
  h = nextRand(h);
  const jitter = 1 + ((h % 200) - 100) / 10000;
  const entryPrice = Number((baseMark * jitter).toFixed(symbol.includes('DOGE') || symbol.includes('XRP') ? 5 : 2));

  h = nextRand(h);
  const leverage = [5, 10, 20][h % 3];
  h = nextRand(h);
  const targetRoePct = 18 + (h % 280) / 10;
  const margin = Math.max(50, Math.abs(pnl) / (targetRoePct / 100));
  const totalSize = margin * leverage;
  const quantity = totalSize / entryPrice;

  const isLong = pnl >= 0 ? h % 3 !== 0 : h % 3 === 0;
  const type = isLong ? 'LONG' : 'SHORT';
  const exitPrice = Number(
    (isLong ? entryPrice + pnl / quantity : entryPrice - pnl / quantity).toFixed(
      symbol.includes('DOGE') || symbol.includes('XRP') ? 5 : 2
    )
  );

  h = nextRand(h);
  const holdMin = 8 + (h % 35);
  const closedAt = new Date(closedAtMs);
  const openedAt = new Date(closedAtMs - holdMin * 60 * 1000);

  return {
    positionId: genPositionId(),
    symbol,
    type,
    entryPrice,
    leverage,
    margin: Number(margin.toFixed(2)),
    totalSize: Number(totalSize.toFixed(2)),
    quantity: Number(quantity.toFixed(8)),
    openFee: 0,
    feeRate: 0,
    tp: null,
    sl: null,
    exitPrice,
    grossPnl: pnl,
    closeFee: 0,
    realizedPnl: pnl,
    time: openedAt.toISOString(),
    closedAt: closedAt.toISOString(),
    status: 'MANUAL',
    closeReason: 'MANUAL',
    closeId: genPositionId()
  };
}

module.exports = { buildSyntheticClosedPositions, buildRealisticClosedTrade };
