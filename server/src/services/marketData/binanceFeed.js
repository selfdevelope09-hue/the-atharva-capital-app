const WebSocket = require('ws');

const { TRADING_PAIRS_USDT } = require('../../config/tradingPairs');

/** Singleton Binance mini-ticker feed → in-memory price map + Socket.io broadcast. */
class BinanceFeed {
  constructor(io) {
    this.io = io;
    this.prices = new Map();
    this.subscribedSymbols = new Set(TRADING_PAIRS_USDT);
    this.ws = null;
    this.reconnectTimer = null;
  }

  start() {
    this.connect();
    setInterval(() => this.broadcastAll(), 500);
  }

  connect() {
    if (this.ws) {
      try {
        this.ws.terminate();
      } catch {
        /* ignore */
      }
    }
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');
    this.ws = ws;

    ws.on('open', () => {
      console.log('[binance] connected');
    });

    ws.on('message', (raw) => {
      try {
        const arr = JSON.parse(String(raw));
        if (!Array.isArray(arr)) return;
        for (const t of arr) {
          const sym = String(t.s || '').toUpperCase();
          if (!sym) continue;
          const price = parseFloat(t.c);
          if (!Number.isFinite(price)) continue;
          this.prices.set(sym, {
            symbol: sym,
            price,
            change24h: parseFloat(t.P) || 0,
            eventTime: Date.now()
          });
        }
      } catch {
        /* ignore */
      }
    });

    ws.on('close', () => {
      console.warn('[binance] disconnected — reconnecting…');
      this.scheduleReconnect();
    });

    ws.on('error', () => {
      this.scheduleReconnect();
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  subscribeSymbols(symbols) {
    for (const s of symbols || []) {
      const sym = String(s || '').toUpperCase();
      if (sym) this.subscribedSymbols.add(sym);
    }
  }

  broadcastAll() {
    if (!this.io) return;
    for (const sym of this.subscribedSymbols) {
      const tick = this.prices.get(sym);
      if (!tick) continue;
      this.io.emit('tick', tick);
    }
  }

  getPrice(symbol) {
    return this.prices.get(String(symbol || '').toUpperCase()) || null;
  }
}

let instance;

function startBinanceFeed(io) {
  if (!instance) {
    instance = new BinanceFeed(io);
    instance.start();
  }
  return instance;
}

function getBinanceFeed() {
  return instance;
}

module.exports = { startBinanceFeed, getBinanceFeed, TRADING_PAIRS_USDT };
