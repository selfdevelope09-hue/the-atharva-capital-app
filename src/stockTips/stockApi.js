import { searchNseLocal } from './nseSymbols';

/**
 * Indian-oriented stock search.
 * Primary: Alpha Vantage SYMBOL_SEARCH (set REACT_APP_ALPHA_VANTAGE_KEY).
 * Fallback: local NSE list filter.
 */
export async function searchIndianStocks(keyword) {
  const q = (keyword || '').trim();
  if (q.length < 1) return [];

  const key = process.env.REACT_APP_ALPHA_VANTAGE_KEY;
  if (key) {
    try {
      const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(
        q
      )}&apikey=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = await res.json();
      const raw = data.bestMatches || data['Best Matches'] || [];
      const mapped = (Array.isArray(raw) ? raw : []).slice(0, 24).map((m) => ({
        symbol: String(m['1. symbol'] || '')
          .replace(/\.BSE$/i, '')
          .replace(/\.NSE$/i, ''),
        name: m['2. name'] || m['1. symbol'] || '',
        region: m['4. region'] || ''
      }));
      const filtered = mapped.filter((x) => x.symbol);
      if (filtered.length) return filtered.slice(0, 20);
    } catch {
      /* fall through */
    }
  }

  return searchNseLocal(q).map((r) => ({ symbol: r.symbol, name: r.name, region: 'India (NSE)' }));
}
