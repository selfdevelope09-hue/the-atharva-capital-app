import React from 'react';
import { T } from '../app/theme';

export default function LeaderboardOwnerBadge() {
  return (
    <span
      title="AuronX platform owner"
      style={{
        marginLeft: 6,
        padding: '2px 7px',
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 0.04,
        color: '#000',
        background: `linear-gradient(135deg, ${T.yellow}, #ffe08a)`,
        border: '1px solid rgba(240,185,11,0.85)',
        flexShrink: 0,
        verticalAlign: 'middle',
        whiteSpace: 'nowrap'
      }}
    >
      👑 Owner
    </span>
  );
}
