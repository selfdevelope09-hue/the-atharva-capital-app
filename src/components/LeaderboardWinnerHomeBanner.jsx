import React from 'react';
import { Link } from 'react-router-dom';
import { T } from '../app/theme';
import { platformOwnerChatPath } from '../config/platformOwner';
import { winnerHeadline, winnerPrizeLine, winnerSubline } from '../utils/leaderboardWinnerCopy';

export default function LeaderboardWinnerHomeBanner({ winner }) {
  if (!winner?.rank) return null;

  return (
    <section
      style={{
        marginBottom: 14,
        borderRadius: 16,
        border: '1px solid rgba(240,185,11,0.55)',
        background: 'linear-gradient(135deg, rgba(40,32,8,0.95) 0%, rgba(19,21,30,0.98) 60%, #0a0a0a 100%)',
        padding: '18px 18px 16px'
      }}
      aria-label="Leaderboard prize notification"
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: T.yellow, marginBottom: 8 }}>
        MONTHLY LEADERBOARD WINNER
      </div>
      <h2 style={{ color: T.white, fontSize: 'clamp(18px, 4vw, 22px)', fontWeight: 900, margin: '0 0 8px', lineHeight: 1.25 }}>
        {winnerHeadline(winner)}
      </h2>
      <p style={{ color: T.text, fontSize: 15, lineHeight: 1.55, margin: '0 0 6px' }}>{winnerPrizeLine(winner)}</p>
      <p style={{ color: T.text, fontSize: 13, lineHeight: 1.5, margin: '0 0 14px', opacity: 0.92 }}>{winnerSubline()}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <Link
          to={platformOwnerChatPath()}
          style={{
            textDecoration: 'none',
            padding: '12px 18px',
            borderRadius: 12,
            background: T.yellow,
            color: '#000',
            fontWeight: 800,
            fontSize: 14
          }}
        >
          Claim prize
        </Link>
        <Link
          to="/winners"
          style={{
            textDecoration: 'none',
            padding: '12px 16px',
            borderRadius: 12,
            border: `1px solid ${T.border}`,
            color: T.white,
            fontWeight: 700,
            fontSize: 14
          }}
        >
          View winners list
        </Link>
      </div>
    </section>
  );
}
