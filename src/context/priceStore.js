import { TRADING_PAIRS_USDT } from '../config/tradingPairs';

const HOT = new Set(TRADING_PAIRS_USDT);
const FLUSH_MS = 200;

/** @type {Record<string, object>} */
let allPrices = {};
/** @type {Record<string, object>} */
let hotPrices = {};
let hotVersion = 0;
const hotListeners = new Set();
let allVersion = 0;
const allListeners = new Set();

let pendingHot = {};
let flushTimer = null;

function notifyHot() {
  hotVersion += 1;
  hotListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

function notifyAll() {
  allVersion += 1;
  allListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

function scheduleHotFlush() {
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    const batch = pendingHot;
    pendingHot = {};
    if (!Object.keys(batch).length) return;
    hotPrices = { ...hotPrices, ...batch };
    notifyHot();
  }, FLUSH_MS);
}

function parseTickerRow(coin) {
  if (!coin?.s?.endsWith('USDT')) return null;
  const close = parseFloat(coin.c);
  const open = parseFloat(coin.o);
  if (!Number.isFinite(close) || !Number.isFinite(open) || open === 0) return null;
  const quoteVolume = parseFloat(coin.q);
  return {
    price: close.toFixed(2),
    close,
    open,
    change: (((close - open) / open) * 100).toFixed(2),
    quoteVolume: Number.isFinite(quoteVolume) ? quoteVolume : 0
  };
}

export function ingestTickerPayload(payload) {
  if (payload?.data != null && payload?.stream) {
    ingestTickerPayload(payload.data);
    return;
  }
  const rows = Array.isArray(payload) ? payload : [payload];
  let touchedHot = false;
  let touchedAll = false;
  const hotBatch = {};

  for (const coin of rows) {
    const row = parseTickerRow(coin);
    if (!row) continue;
    const sym = coin.s;
    allPrices[sym] = row;
    touchedAll = true;
    if (HOT.has(sym)) {
      hotBatch[sym] = row;
      touchedHot = true;
    }
  }

  if (touchedAll) notifyAll();
  if (touchedHot) {
    pendingHot = { ...pendingHot, ...hotBatch };
    scheduleHotFlush();
  }
}

export function ingest24hrTickers(data) {
  if (!Array.isArray(data)) return;
  let touchedHot = false;
  const hotBatch = {};
  for (const coin of data) {
    const row = parseTickerRow(coin);
    if (!row) continue;
    allPrices[coin.s] = row;
    if (HOT.has(coin.s)) {
      hotBatch[coin.s] = row;
      touchedHot = true;
    }
  }
  notifyAll();
  if (touchedHot) {
    pendingHot = { ...pendingHot, ...hotBatch };
    scheduleHotFlush();
  }
}

export function getHotPricesSnapshot() {
  return hotPrices;
}

export function getAllPricesSnapshot() {
  return allPrices;
}

export function subscribeHotPrices(listener) {
  hotListeners.add(listener);
  return () => hotListeners.delete(listener);
}

export function subscribeAllPrices(listener) {
  allListeners.add(listener);
  return () => allListeners.delete(listener);
}

export function getHotPricesVersion() {
  return hotVersion;
}

export function getAllPricesVersion() {
  return allVersion;
}

/** All USDT mini tickers — one socket keeps 100+ Markets pairs live without URL limits. */
export const BINANCE_ALL_MINI_TICKER_WS = 'wss://stream.binance.com:9443/ws/!miniTicker@arr';

export function buildHotMiniTickerWsUrl() {
  if (TRADING_PAIRS_USDT.length > 40) return BINANCE_ALL_MINI_TICKER_WS;
  const streams = TRADING_PAIRS_USDT.map((s) => `${s.toLowerCase()}@miniTicker`).join('/');
  return `wss://stream.binance.com:9443/stream?streams=${streams}`;
}

export { FLUSH_MS, HOT as HOT_PRICE_SYMBOLS };
