import React, { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { T } from '../app/theme';

/** Pro-style fallback chart — yellow line on dark grid (Trade page). */
export default function BinanceMiniChart({ symbol = 'BTCUSDT', minHeight = 320 }) {
  const sym = String(symbol || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'BTCUSDT';
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(sym)}&interval=15m&limit=96`
        );
        if (!r.ok) throw new Error('klines');
        const k = await r.json();
        if (cancelled || !Array.isArray(k)) return;
        setRows(
          k.map((c) => ({
            t: Number(c[0]),
            p: parseFloat(c[4])
          }))
        );
        setErr(false);
      } catch {
        if (!cancelled) setErr(true);
      }
    };
    load();
    const id = window.setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sym]);

  const lastPrice = rows.length ? rows[rows.length - 1].p : null;

  const chartBody = useMemo(() => {
    if (!rows.length) return null;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 8, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="rgba(240,185,11,0.08)" strokeDasharray="4 6" vertical={false} />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: '#848e9c', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={(v) => `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
          <Tooltip
            contentStyle={{
              background: '#1e2329',
              border: `1px solid ${T.yellow}`,
              borderRadius: 8,
              fontSize: 12
            }}
            labelFormatter={() => sym.replace('USDT', '/USDT')}
            formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Price']}
          />
          <Line
            type="monotone"
            dataKey="p"
            stroke={T.yellow}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: T.yellow, stroke: '#0b0e11', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }, [rows, sym]);

  const shell = {
    width: '100%',
    height: minHeight,
    minHeight,
    background: 'linear-gradient(180deg, #0f1419 0%, #0b0e11 55%, #0b0e11 100%)',
    borderTop: `1px solid rgba(240,185,11,0.12)`,
    position: 'relative'
  };

  if (err) {
    return (
      <div style={{ ...shell, display: 'grid', placeItems: 'center', color: T.text, fontSize: 13 }}>
        Chart unavailable — check connection
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div style={{ ...shell, display: 'grid', placeItems: 'center', color: T.text, fontSize: 13 }}>
        Loading chart…
      </div>
    );
  }

  return (
    <div style={shell}>
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 12,
          zIndex: 2,
          fontSize: 11,
          fontWeight: 700,
          color: T.yellow,
          letterSpacing: 1
        }}
      >
        {sym.replace('USDT', '')}/USDT
        {lastPrice != null ? (
          <span style={{ color: T.white, marginLeft: 8 }}>${lastPrice.toLocaleString()}</span>
        ) : null}
      </div>
      {chartBody}
    </div>
  );
}
