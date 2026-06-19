/**
 * Minimal TradingView Charting Library datafeed (Binance spot klines).
 */

const RESOLUTION_MAP = {
  1: '1m',
  3: '3m',
  5: '5m',
  15: '15m',
  30: '30m',
  60: '1h',
  120: '2h',
  240: '4h',
  '1D': '1d',
  D: '1d',
  '1W': '1w',
  W: '1w'
};

const SUPPORTED = ['1', '5', '15', '30', '60', '240', '1D'];

function tickerFromSymbol(symbolName) {
  return String(symbolName || '')
    .toUpperCase()
    .replace(/^BINANCE:/, '')
    .replace(/[^A-Z0-9]/g, '');
}

function pricescaleForTicker(ticker) {
  if (/USDT$/.test(ticker) && ticker.startsWith('BTC')) return 100;
  if (/USDT$/.test(ticker)) return 10000;
  return 100;
}

export function createBinanceDatafeed() {
  const subs = new Map();

  return {
    onReady(cb) {
      setTimeout(
        () =>
          cb({
            supported_resolutions: SUPPORTED,
            supports_marks: false,
            supports_timescale_marks: false,
            supports_search: false,
            supports_group_request: false
          }),
        0
      );
    },

    searchSymbols() {},

    resolveSymbol(symbolName, onResolve) {
      const ticker = tickerFromSymbol(symbolName);
      const scale = pricescaleForTicker(ticker);
      onResolve({
        name: symbolName,
        ticker,
        description: ticker,
        type: 'crypto',
        session: '24x7',
        timezone: 'Etc/UTC',
        exchange: 'BINANCE',
        listed_exchange: 'BINANCE',
        format: 'price',
        minmov: 1,
        pricescale: scale,
        has_intraday: true,
        has_daily: true,
        has_weekly_and_monthly: false,
        supported_resolutions: SUPPORTED,
        volume_precision: 4,
        data_status: 'streaming'
      });
    },

    async getBars(symbolInfo, resolution, periodParams, onResult, onError) {
      try {
        const interval = RESOLUTION_MAP[resolution] || '15m';
        const ticker = tickerFromSymbol(symbolInfo.ticker || symbolInfo.name);
        const limit = Math.min(1000, Math.max(100, periodParams.countBack || 300));
        const end = periodParams.to ? periodParams.to * 1000 : Date.now();
        const url = `https://api.binance.com/api/v3/klines?symbol=${ticker}&interval=${interval}&endTime=${end}&limit=${limit}`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`Binance ${r.status}`);
        const raw = await r.json();
        const bars = raw.map((k) => ({
          time: Number(k[0]),
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
          volume: Number(k[5])
        }));
        onResult(bars, { noData: bars.length === 0 });
      } catch (e) {
        onError(e.message || 'getBars failed');
      }
    },

    subscribeBars(symbolInfo, resolution, onTick, listenerGuid) {
      const ticker = tickerFromSymbol(symbolInfo.ticker || symbolInfo.name).toLowerCase();
      const interval = RESOLUTION_MAP[resolution] || '15m';
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${ticker}@kline_${interval}`);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const k = msg?.k;
          if (!k) return;
          onTick({
            time: Number(k.t),
            open: Number(k.o),
            high: Number(k.h),
            low: Number(k.l),
            close: Number(k.c),
            volume: Number(k.v)
          });
        } catch {
          /* ignore */
        }
      };
      subs.set(listenerGuid, ws);
    },

    unsubscribeBars(listenerGuid) {
      const ws = subs.get(listenerGuid);
      if (ws) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
      subs.delete(listenerGuid);
    }
  };
}
