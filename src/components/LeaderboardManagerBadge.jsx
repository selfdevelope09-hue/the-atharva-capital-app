import React from 'react';

export default function LeaderboardManagerBadge() {
  return (
    <span
      title="AuronX platform manager"
      style={{
        marginLeft: 6,
        padding: '2px 7px',
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 0.04,
        color: '#fff',
        background: 'linear-gradient(135deg, #0095F6, #1877f2)',
        border: '1px solid rgba(0,149,246,0.85)',
        flexShrink: 0,
        verticalAlign: 'middle',
        whiteSpace: 'nowrap'
      }}
    >
      Manager
    </span>
  );
}
