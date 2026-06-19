import React, { useContext, useMemo } from 'react';
import { PriceContext } from '../context/PriceContext';
import { T } from '../app/theme';

export function TickerTape() {
  const prices = useContext(PriceContext);
  const rows = useMemo(
    () =>
      Object.entries(prices)
        .filter(([sym]) => sym.endsWith('USDT'))
        .slice(0, 12)
        .map(([sym, d]) => ({ sym, price: Number(d.price || 0), change: Number(d.change || 0) })),
    [prices]
  );
  return (
    <div style={{ borderBottom: `1px solid ${T.border}`, background: '#0b0e11', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 16, padding: '8px 12px', whiteSpace: 'nowrap', overflowX: 'auto' }}>
        {rows.map((r) => (
          <div key={r.sym} style={{ color: T.text, fontSize: 12 }}>
            <span style={{ color: T.white, marginRight: 6 }}>{r.sym.replace('USDT', '')}</span>
            <span style={{ marginRight: 6 }}>${r.price.toLocaleString()}</span>
            <span style={{ color: r.change >= 0 ? T.green : T.red }}>
              {r.change >= 0 ? '+' : ''}
              {r.change.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
import React, { useContext, useMemo } from 'react';
import { PriceContext } from '../context/PriceContext';
import { T } from '../app/theme';

export function TickerTape() {
  const prices = useContext(PriceContext);
  const rows = useMemo(
    () =>
      Object.entries(prices)
        .filter(([sym]) => sym.endsWith('USDT'))
        .slice(0, 12)
        .map(([sym, d]) => ({
          sym,
          price: Number(d.price || 0),
          change: Number(d.change || 0)
        })),
    [prices]
  );

  return (
    <div style={{ borderBottom: `1px solid ${T.border}`, background: '#0b0e11', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 16, padding: '8px 12px', whiteSpace: 'nowrap', overflowX: 'auto' }}>
        {rows.map((r) => (
          <div key={r.sym} style={{ color: T.text, fontSize: 12 }}>
            <span style={{ color: T.white, marginRight: 6 }}>{r.sym.replace('USDT', '')}</span>
            <span style={{ marginRight: 6 }}>${r.price.toLocaleString()}</span>
            <span style={{ color: r.change >= 0 ? T.green : T.red }}>
              {r.change >= 0 ? '+' : ''}
              {r.change.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PriceContext } from '../context/PriceContext';
import { T } from '../app/theme';

export function TickerTape() {
  const prices = useContext(PriceContext);
  const entries = useMemo(
    () =>
      Object.entries(prices)
        .filter(([sym]) => sym.endsWith('USDT'))
        .sort((a, b) => parseFloat(b[1].price) - parseFloat(a[1].price))
        .slice(0, 42),
    [prices]
  );

  const renderSeg = (sym, d, i) => {
    const chg = d ? parseFloat(d.change) : 0;
    const up = chg >= 0;
    return (
      <span key={`${sym}-${i}`} className="ticker-seg">
        <Link to={`/trade?symbol=${sym}`} style={{ color: T.white, textDecoration: 'none', fontWeight: 700 }}>
          {sym.replace('USDT', '')}
        </Link>
        <span style={{ color: T.text }}>/USDT</span>
        <span style={{ color: T.white, fontWeight: 600 }}>
          ${d ? parseFloat(d.price).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
        </span>
        <span style={{ color: up ? T.green : T.red, fontWeight: 600, minWidth: '3.2em' }}>
          {up ? '▲' : '▼'} {up ? '+' : ''}
          {d ? chg.toFixed(2) : '0.00'}%
        </span>
        <span className="ticker-dot">|</span>
      </span>
    );
  };

  const segments =
    entries.length > 0 ? (
      <>{entries.map(([sym, d], i) => renderSeg(sym, d, i))}</>
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
          {entries.length > 0 ? entries.map(([sym, d], i) => renderSeg(sym, d, i + 1000)) : null}
        </div>
      </div>
    </div>
  );
}
