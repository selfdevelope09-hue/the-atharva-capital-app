import React, { useMemo } from 'react';
import { useHotPrices } from '../hooks/useHotPrices';
import { TRADING_PAIRS_USDT } from '../config/tradingPairs';
import { T } from '../app/theme';

export default function TickerTapeLite() {
  const prices = useHotPrices();
  const rows = useMemo(
    () => {
      const resolvePct = (d) => {
        const direct = Number(d?.change);
        if (Number.isFinite(direct)) return direct;
        const close = Number(d?.close ?? d?.price);
        const open = Number(d?.open);
        if (Number.isFinite(close) && Number.isFinite(open) && open > 0) {
          return ((close - open) / open) * 100;
        }
        return 0;
      };
      return TRADING_PAIRS_USDT.slice(0, 14)
        .filter((sym) => prices[sym])
        .map((sym) => [sym, prices[sym]])
        .map(([sym, d]) => {
          const price = Number(d?.price);
          const change = resolvePct(d);
          return {
            sym,
            price: Number.isFinite(price) ? price : 0,
            change: Number.isFinite(change) ? change : 0
          };
        });
    },
    [prices]
  );
  return (
    <div className="ticker-wrap" style={{ borderBottom: `1px solid ${T.border}` }}>
      <div className="ticker-track">
        {[...rows, ...rows].map((r, i) => (
          <div key={`${r.sym}-${i}`} className="ticker-seg" style={{ color: T.text }}>
            <span style={{ color: T.white }}>{r.sym.replace('USDT', '')}</span>
            <span>${r.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
            <span style={{ color: r.change >= 0 ? T.green : T.red, fontWeight: 700 }}>
              {r.change >= 0 ? '+' : ''}
              {r.change.toFixed(2)}%
            </span>
            <span className="ticker-dot">•</span>
          </div>
        ))}
      </div>
    </div>
  );
}
