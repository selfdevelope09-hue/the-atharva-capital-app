import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useHotPrices } from '../hooks/useHotPrices';
import { TRADING_PAIRS_USDT } from '../config/tradingPairs';
import { T } from '../app/theme';

function resolvePct(d) {
  const direct = Number(d?.change);
  if (Number.isFinite(direct)) return direct;
  const close = Number(d?.close ?? d?.price);
  const open = Number(d?.open);
  if (Number.isFinite(close) && Number.isFinite(open) && open > 0) {
    return ((close - open) / open) * 100;
  }
  return 0;
}

export function TickerTape() {
  const prices = useHotPrices();
  const rows = useMemo(
    () =>
      TRADING_PAIRS_USDT.slice(0, 18).map((sym) => {
        const d = prices[sym];
        const price = Number(d?.price);
        const change = d ? resolvePct(d) : 0;
        return {
          sym,
          price: Number.isFinite(price) ? price : null,
          change: Number.isFinite(change) ? change : 0,
          ready: !!d
        };
      }),
    [prices]
  );

  const hasAny = rows.some((r) => r.ready);

  const renderSeg = (r, i) => {
    const up = r.change >= 0;
    return (
      <span key={`${r.sym}-${i}`} className="ticker-seg">
        <Link to={`/trade?symbol=${r.sym}`} style={{ color: T.white, textDecoration: 'none', fontWeight: 700 }}>
          {r.sym.replace('USDT', '')}
        </Link>
        <span style={{ color: T.text }}>/USDT</span>
        <span style={{ color: T.white, fontWeight: 600 }}>
          {r.ready ? `$${r.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '…'}
        </span>
        <span style={{ color: up ? T.green : T.red, fontWeight: 600, minWidth: '3.2em' }}>
          {r.ready ? (
            <>
              {up ? '▲' : '▼'} {up ? '+' : ''}
              {r.change.toFixed(2)}%
            </>
          ) : (
            <span style={{ color: T.text, fontWeight: 500 }}>live</span>
          )}
        </span>
        <span className="ticker-dot">|</span>
      </span>
    );
  };

  const segments = hasAny ? (
    <>{rows.map((r, i) => renderSeg(r, i))}</>
  ) : (
    <span className="ticker-seg" style={{ color: T.text, paddingLeft: 16 }}>
      Live prices loading…
    </span>
  );

  return (
    <div className="ticker-wrap" aria-label="Live crypto prices ticker">
      <div className="ticker-track">
        <div style={{ display: 'flex' }}>{segments}</div>
        <div style={{ display: 'flex' }} aria-hidden="true">
          {hasAny ? rows.map((r, i) => renderSeg(r, i + 1000)) : null}
        </div>
      </div>
    </div>
  );
}

export default TickerTape;
