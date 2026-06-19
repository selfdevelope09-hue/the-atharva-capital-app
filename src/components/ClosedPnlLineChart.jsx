import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const C = {
  border: '#2b2f36',
  text: '#848e9c',
  white: '#ffffff',
  yellow: '#f0b90b',
  green: '#02c076',
  red: '#f6465d',
  card2: '#2b3139'
};

/**
 * Dashboard closed-PnL equity line — isolated so `recharts` loads in its own chunk (smaller initial bundle).
 */
export default function ClosedPnlLineChart({ data }) {
  if (!Array.isArray(data) || !data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
        <XAxis dataKey="name" stroke={C.text} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis stroke={C.text} tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} width={56} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const row = payload[0].payload;
            return (
              <div
                style={{
                  backgroundColor: C.card2,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: '10px 12px',
                  fontSize: 12
                }}
              >
                <div style={{ color: C.white, fontWeight: 700, marginBottom: 6 }}>{row.name}</div>
                <div style={{ color: C.text }}>
                  Ye trade:{' '}
                  <span style={{ color: row.tradePnl >= 0 ? C.green : C.red, fontWeight: 700 }}>
                    ${Number(row.tradePnl).toFixed(2)}
                  </span>
                </div>
                <div style={{ color: C.text, marginTop: 4 }}>
                  Tak total (closed):{' '}
                  <span style={{ color: C.yellow, fontWeight: 700 }}>${Number(row.cumRealized).toFixed(2)}</span>
                </div>
              </div>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="cumRealized"
          name="cumRealized"
          stroke={C.yellow}
          strokeWidth={2}
          dot={{ r: 3, fill: C.yellow }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
