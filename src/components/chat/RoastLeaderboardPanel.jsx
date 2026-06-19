import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bff } from '../../api/serverBff';
import { T } from '../../app/theme';
import LeaderboardRowAvatar from '../LeaderboardRowAvatar';
import { ROAST_PNL_PER_MESSAGE, roastPointsForText } from '../../config/communityRooms';

export default function RoastLeaderboardPanel({ compact = false }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(!compact);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      bff('/api/chat/roast-leaderboard?limit=10')
        .then((j) => {
          if (!cancelled) {
            setRows(Array.isArray(j.rows) ? j.rows : []);
            setErr('');
          }
        })
        .catch((e) => {
          if (!cancelled) setErr(e?.message || 'Could not load roast leaderboard.');
        });
    load();
    const id = window.setInterval(load, 12000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div
      className="roast-leaderboard-panel"
      style={{
        margin: compact ? '0 0 8px' : '0 0 10px',
        borderRadius: 12,
        border: '1px solid rgba(246,70,93,0.35)',
        background: 'linear-gradient(180deg, rgba(246,70,93,0.12) 0%, rgba(17,27,33,0.95) 100%)',
        overflow: 'hidden'
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '10px 12px',
          border: 'none',
          background: 'transparent',
          color: T.white,
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <span style={{ fontWeight: 900, fontSize: 13, letterSpacing: '0.02em' }}>🔥 Roast Leaderboard</span>
        <span style={{ color: T.text, fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open ? (
        <div style={{ padding: '0 10px 10px' }}>
          <div
            style={{
              fontSize: 11,
              color: T.text,
              lineHeight: 1.5,
              marginBottom: 8,
              padding: '8px 10px',
              borderRadius: 8,
              background: 'rgba(0,0,0,0.22)'
            }}
          >
            <strong style={{ color: '#f6465d' }}>How it works:</strong> More you chat here → more Roast points (
            {roastPointsForText('example message with length')} pts example). Each message adds{' '}
            <strong style={{ color: T.green }}>${ROAST_PNL_PER_MESSAGE.toLocaleString()}</strong> to your main
            leaderboard P/L (shows in history as <strong>by Roast</strong>).
          </div>
          {err ? <div style={{ color: T.red, fontSize: 11 }}>{err}</div> : null}
          {rows.length ? (
            rows.map((r) => (
              <div
                key={r.uid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 4px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <span style={{ width: 22, color: T.yellow, fontWeight: 900, fontSize: 12 }}>#{r.rank}</span>
                <LeaderboardRowAvatar photoURL={r.photoURL} name={r.name} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    to={`/profile/${encodeURIComponent(r.uid)}`}
                    style={{
                      color: T.white,
                      fontWeight: 700,
                      fontSize: 12,
                      textDecoration: 'none',
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {r.name}
                  </Link>
                  <div style={{ fontSize: 10, color: T.text }}>
                    {r.roastPoints} pts · {r.messageCount} msgs · ${Number(r.roastPnl || 0).toLocaleString()} roast P/L
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: T.text, fontSize: 11, padding: 6 }}>No roast messages yet — be the first!</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
