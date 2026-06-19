import React, { memo, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../authContext';
import { sumDmUnread } from '../utils/threadUnread';
import { T } from '../app/theme';
import { useTipEditorAccess } from '../hooks/useTipEditorAccess';

const MQ = '(max-width: 920px)';

export function bottomNavHiddenPathLite(pathname) {
  return pathname === '/login' || pathname === '/signup';
}

const BottomNavLite = memo(function BottomNavLite() {
  const { pathname } = useLocation();
  const { user, dmThreads, communityUnread } = useContext(AuthContext);
  const { isEditor: isDevEditor } = useTipEditorAccess();
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(MQ).matches);
  useEffect(() => {
    const mq = window.matchMedia(MQ);
    const fn = () => setNarrow(mq.matches);
    mq.addEventListener('change', fn);
    fn();
    return () => mq.removeEventListener('change', fn);
  }, []);

  const chatUnread = useMemo(() => {
    if (!user?.uid) return 0;
    return sumDmUnread(dmThreads, user.uid) + (Number(communityUnread) || 0);
  }, [user?.uid, dmThreads, communityUnread]);

  if (!narrow || bottomNavHiddenPathLite(pathname)) return null;

  const items = [
    ['/', 'Home', '🏠'],
    ['/creds', 'Creds', '⭐'],
    ['/markets', 'Markets', '📊'],
    ['/trade', 'Trade', '⚡'],
    ['/dashboard', 'Portfolio', '📈'],
    ['/leaderboard', 'Leaderboard', '🏆'],
    ['/chat', 'Chat', '💬']
  ];
  if (isDevEditor) {
    items.push(['/developer', 'Dev', '🛠️']);
  }
  return (
    <nav
      className="app-bottom-nav-shell"
      style={{
        position: 'fixed',
        left: 8,
        right: 8,
        bottom: 'max(8px, env(safe-area-inset-bottom, 8px))',
        zIndex: 5000,
        display: 'flex',
        justifyContent: 'space-between',
        gap: 4,
        padding: '8px 8px',
        background: 'rgba(10,10,10,0.95)',
        border: '1px solid rgba(240, 185, 11, 0.24)',
        borderRadius: 14,
        boxShadow: '0 12px 28px rgba(0,0,0,0.35)'
      }}
    >
      {items.map(([path, label, icon]) => {
        const isChat = path === '/chat';
        const active =
          pathname === path ||
          (path === '/developer' && pathname.startsWith('/developer')) ||
          (path === '/leaderboard' && pathname.startsWith('/leaderboard')) ||
          (path === '/creds' && pathname.startsWith('/creds'));
        const unread = isChat ? chatUnread : 0;
        const badge = unread > 0 ? (unread > 99 ? '99+' : String(unread)) : '';
        return (
          <Link
            key={path + label}
            to={path}
            title={label}
            aria-label={unread > 0 && isChat ? `${label}, ${unread} unread` : label}
            style={{
              color: active ? T.yellow : T.text,
              textDecoration: 'none',
              borderRadius: 10,
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 0,
              flex: 1,
              padding: '5px 0',
              background: active ? 'rgba(240,185,11,0.18)' : 'transparent',
              border: active ? '1px solid rgba(240,185,11,0.45)' : '1px solid transparent',
              position: 'relative'
            }}
          >
            {badge ? (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  right: '8%',
                  minWidth: 15,
                  height: 15,
                  padding: '0 3px',
                  borderRadius: 999,
                  background: T.red,
                  color: '#fff',
                  fontSize: 8,
                  fontWeight: 900,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  boxShadow: '0 0 0 2px rgba(10,10,10,0.95)',
                  zIndex: 2
                }}
              >
                {badge}
              </span>
            ) : null}
            <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
            <span style={{ fontSize: path === '/creds' ? 10 : 8, marginTop: 2, fontWeight: 700 }}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
});

export default BottomNavLite;
