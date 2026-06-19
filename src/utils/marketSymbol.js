import { getAllPricesSnapshot, getHotPricesSnapshot } from '../context/priceStore';

/** Normalize any stored symbol → Binance USDT pair (e.g. BTC → BTCUSDT). */
export function normalizeBinanceSymbol(raw) {
  let s = String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!s) return 'BTCUSDT';
  if (!s.endsWith('USDT') && !s.endsWith('BUSD')) s = `${s}USDT`;
  return s;
}

/** Resolve live tick from PriceContext / socket map (handles BTC vs BTCUSDT). */
export function lookupLivePrice(prices, rawSymbol) {
  const sym = normalizeBinanceSymbol(rawSymbol);
  const key = String(rawSymbol || '').toUpperCase();
  const fromArg = prices && typeof prices === 'object' ? prices[sym] || prices[key] : null;
  if (fromArg) return fromArg;
  const hot = getHotPricesSnapshot();
  if (hot[sym] || hot[key]) return hot[sym] || hot[key];
  const all = getAllPricesSnapshot();
  return all[sym] || all[key] || null;
}

export function parseLiveMarkPrice(tick) {
  if (tick == null) return NaN;
  const raw = tick.price ?? tick.close;
  const n = parseFloat(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : NaN;
}
