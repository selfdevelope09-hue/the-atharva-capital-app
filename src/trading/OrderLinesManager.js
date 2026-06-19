/**
 * TradingView Advanced Charts — order lines via chart.createOrderLine() only.
 * Requires self-hosted Charting Library (TradingView.widget).
 *
 * @param {import('charting_library').IChartingLibraryWidget} widget
 * @param {{ symbol: string, maintenanceMarginRate?: number, getLastPrice?: () => number | null }} options
 */
export class OrderLinesManager {
  constructor(widget, options = {}) {
    this.widget = widget;
    this.symbol = String(options.symbol || 'BTCUSDT').replace(/[^A-Za-z0-9_-]/g, '');
    this.mmr = Number(options.maintenanceMarginRate);
    if (!Number.isFinite(this.mmr) || this.mmr < 0) this.mmr = 0.005;
    /** Optional override when onTick is not available */
    this.getLastPrice = typeof options.getLastPrice === 'function' ? options.getLastPrice : null;

    this.chart = null;
    this.lines = { entry: null, tp: null, sl: null, liq: null };
    this.position = null;
    this._lastPrice = null;
    this._pnlInterval = null;
    this._unsubs = [];
    this._ready = false;
    this._storageKey = `order_lines_${this.symbol}`;
  }

  storageKey() {
    return this._storageKey;
  }

  init() {
    const onTick = (tick) => {
      if (!tick) return;
      const c = Number(tick.close);
      if (Number.isFinite(c) && c > 0) this._lastPrice = c;
    };
    this.widget.subscribe('onTick', onTick);
    this._unsubs.push(() => this.widget.unsubscribe('onTick', onTick));

    this.widget.onChartReady(() => {
      this._ready = true;
      this.chart = this.widget.activeChart();
      this.loadSavedLines();
      if (!this._pnlInterval) {
        this._pnlInterval = window.setInterval(() => this._updatePnL(), 1000);
      }
    });
  }

  destroy() {
    this._unsubs.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
    this._unsubs = [];
    if (this._pnlInterval) {
      clearInterval(this._pnlInterval);
      this._pnlInterval = null;
    }
    this._removeAllLines();
    this.chart = null;
    this.position = null;
    this._ready = false;
  }

  openPosition({ direction, entryPrice, quantity, leverage, margin, tpPrice, slPrice }) {
    if (!this._ready || !this.chart) {
      console.warn('OrderLinesManager: chart not ready yet');
      return;
    }
    const lev = Math.min(100, Math.max(1, Math.floor(Number(leverage) || 1)));
    const dir = String(direction || '').toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG';
    const ep = Number(entryPrice);
    const qty = Number(quantity);
    const m = Number(margin);
    if (!Number.isFinite(ep) || ep <= 0 || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(m) || m <= 0) {
      console.warn('OrderLinesManager: invalid position params');
      return;
    }

    this.position = { direction: dir, entryPrice: ep, quantity: qty, leverage: lev, margin: m };
    this._lastPrice = this._lastPrice != null && this._lastPrice > 0 ? this._lastPrice : ep;

    this._removeAllLines();

    this._createEntryLine(ep, dir);
    if (tpPrice != null && Number.isFinite(Number(tpPrice)) && Number(tpPrice) > 0) {
      this._createTPLine(Number(tpPrice));
    }
    if (slPrice != null && Number.isFinite(Number(slPrice)) && Number(slPrice) > 0) {
      this._createSLLine(Number(slPrice));
    }
    const liq = this._calcLiqPrice(ep, lev, dir);
    this._createLiqLine(liq);
    this._saveLines();
    this._updatePnL();
  }

  closePosition() {
    this._removeAllLines();
    this.position = null;
    try {
      localStorage.removeItem(this._storageKey);
    } catch {}
  }

  loadSavedLines() {
    if (!this.chart) return;
    let raw;
    try {
      raw = localStorage.getItem(this._storageKey);
    } catch {
      return;
    }
    if (!raw) return;
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      try {
        localStorage.removeItem(this._storageKey);
      } catch {}
      return;
    }
    const pos = data && data.position;
    if (!pos || typeof pos !== 'object') return;
    const tp = data.tp != null ? Number(data.tp) : null;
    const sl = data.sl != null ? Number(data.sl) : null;
    this.openPosition({
      direction: pos.direction,
      entryPrice: Number(pos.entryPrice),
      quantity: Number(pos.quantity),
      leverage: Number(pos.leverage),
      margin: Number(pos.margin),
      tpPrice: Number.isFinite(tp) && tp > 0 ? tp : undefined,
      slPrice: Number.isFinite(sl) && sl > 0 ? sl : undefined
    });
  }

  _createEntryLine(price, direction) {
    const color = direction === 'LONG' ? '#378ADD' : '#E24B4A';
    const line = this.chart.createOrderLine();
    line
      .setPrice(price)
      .setLineColor(color)
      .setBodyBackgroundColor(color)
      .setBodyBorderColor(color)
      .setBodyTextColor('#FFFFFF')
      .setBodyText(`${direction}  ${price.toLocaleString('en-US', { maximumFractionDigits: 6 })}`)
      .setLineWidth(2)
      .setLineStyle(0)
      .setQuantity('')
      .setQuantityBorderColor(color)
      .setQuantityBackgroundColor(`${color}33`)
      .setEditable(false);
    this.lines.entry = line;
  }

  _createTPLine(price) {
    const mgr = this;
    const line = this.chart.createOrderLine();
    line
      .setPrice(price)
      .setLineColor('#1D9E75')
      .setBodyBackgroundColor('#1D9E75')
      .setBodyBorderColor('#1D9E75')
      .setBodyTextColor('#FFFFFF')
      .setBodyText(`TP  ${mgr._roeAtPrice(price)}`)
      .setLineWidth(1)
      .setLineStyle(1)
      .setEditable(true)
      .onMove(() => {
        const p = line.getPrice();
        line.setBodyText(`TP  ${mgr._roeAtPrice(p)}`);
        mgr._saveLines();
      })
      .onCancel('', () => {
        try {
          line.remove();
        } catch {}
        mgr.lines.tp = null;
        mgr._saveLines();
      });
    this.lines.tp = line;
  }

  _createSLLine(price) {
    const mgr = this;
    const line = this.chart.createOrderLine();
    line
      .setPrice(price)
      .setLineColor('#E24B4A')
      .setBodyBackgroundColor('#E24B4A')
      .setBodyBorderColor('#E24B4A')
      .setBodyTextColor('#FFFFFF')
      .setBodyText(`SL  ${mgr._roeAtPrice(price)}`)
      .setLineWidth(1)
      .setLineStyle(1)
      .setEditable(true)
      .onMove(() => {
        const p = line.getPrice();
        line.setBodyText(`SL  ${mgr._roeAtPrice(p)}`);
        mgr._saveLines();
      })
      .onCancel('', () => {
        try {
          line.remove();
        } catch {}
        mgr.lines.sl = null;
        mgr._saveLines();
      });
    this.lines.sl = line;
  }

  _createLiqLine(price) {
    const line = this.chart.createOrderLine();
    line
      .setPrice(price)
      .setLineColor('#BA7517')
      .setBodyBackgroundColor('#BA7517')
      .setBodyBorderColor('#BA7517')
      .setBodyTextColor('#FFFFFF')
      .setBodyText(`LIQ  ${price.toLocaleString('en-US', { maximumFractionDigits: 6 })}`)
      .setLineWidth(1)
      .setLineStyle(2)
      .setEditable(false);
    this.lines.liq = line;
  }

  _calcLiqPrice(entryPrice, leverage, direction) {
    const L = Math.min(125, Math.max(1, leverage));
    const mmr = this.mmr;
    const imr = 1 / L;
    if (direction === 'LONG') return (entryPrice * (1 - imr)) / (1 - mmr);
    return (entryPrice * (1 + imr)) / (1 + mmr);
  }

  /** ROE% at a hypothetical exit price (USDT linear-style). */
  _roeAtPrice(targetPrice) {
    if (!this.position) return '0.0%';
    const { direction, entryPrice, leverage } = this.position;
    const tp = Number(targetPrice);
    const ep = Number(entryPrice);
    const lev = Math.min(100, Math.max(1, leverage));
    let pct;
    if (direction === 'LONG') {
      pct = ((tp - ep) / ep) * lev * 100;
    } else {
      pct = ((ep - tp) / ep) * lev * 100;
    }
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  }

  _getCurrentPrice() {
    if (this.getLastPrice) {
      const v = this.getLastPrice();
      if (Number.isFinite(v) && v > 0) return v;
    }
    if (Number.isFinite(this._lastPrice) && this._lastPrice > 0) return this._lastPrice;
    return this.position ? this.position.entryPrice : 0;
  }

  _updatePnL() {
    if (!this.position || !this.lines.entry) return;
    const { direction, entryPrice, quantity, margin } = this.position;
    const currentPrice = this._getCurrentPrice();
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) return;

    let pnl;
    if (direction === 'LONG') {
      pnl = (currentPrice - entryPrice) * quantity;
    } else {
      pnl = (entryPrice - currentPrice) * quantity;
    }
    const pnlPercent = (pnl / margin) * 100;
    const sign = pnl >= 0 ? '+' : '';
    const color = pnl >= 0 ? '#1D9E75' : '#E24B4A';
    const pnlText = `${sign}$${pnl.toFixed(2)}  (${sign}${pnlPercent.toFixed(2)}%)`;

    this.lines.entry
      .setBodyText(`${this.position.direction}  ${entryPrice.toLocaleString('en-US', { maximumFractionDigits: 6 })}  |  ${pnlText}`)
      .setBodyBackgroundColor(color)
      .setBodyBorderColor(color)
      .setLineColor(color);
  }

  _saveLines() {
    const data = {
      tp: this.lines.tp ? this.lines.tp.getPrice() : null,
      sl: this.lines.sl ? this.lines.sl.getPrice() : null,
      position: this.position
    };
    try {
      localStorage.setItem(this._storageKey, JSON.stringify(data));
    } catch (e) {
      console.warn('OrderLinesManager: save failed', e);
    }
  }

  _removeAllLines() {
    Object.values(this.lines).forEach((line) => {
      if (!line) return;
      try {
        line.remove();
      } catch {}
    });
    this.lines = { entry: null, tp: null, sl: null, liq: null };
  }
}
