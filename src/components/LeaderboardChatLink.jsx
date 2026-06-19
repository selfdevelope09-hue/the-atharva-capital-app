import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../authContext';
import { T } from '../app/theme';

export default function LeaderboardChatLink({ targetId }) {
  const { user } = useContext(AuthContext);
  if (!targetId || user?.uid === targetId) return null;
  const btn = {
    padding: '5px 8px',
    borderRadius: 6,
    border: `1px solid ${T.yellow}`,
    color: T.yellow,
    background: 'transparent',
    fontSize: 10,
    fontWeight: 800,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    minHeight: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box'
  };
  if (!user) {
    return (
      <Link
        to="/login"
        state={{ from: '/leaderboard' }}
        onClick={(e) => e.stopPropagation()}
        style={btn}
      >
        Chat
      </Link>
    );
  }
  return (
    <Link to={`/chat?with=${encodeURIComponent(targetId)}`} onClick={(e) => e.stopPropagation()} style={btn}>
      Chat
    </Link>
  );
}
