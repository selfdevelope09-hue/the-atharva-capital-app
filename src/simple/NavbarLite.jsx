import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../authContext';
import { sumDmUnread } from '../utils/threadUnread';
import { T } from '../app/theme';
import LeaderboardRowAvatar from '../components/LeaderboardRowAvatar';

function ChatNavBadge({ count }) {
  if (!count || count < 1) return null;
  const label = count > 99 ? '99+' : String(count);
  return (
    <span
      aria-hidden
      title={`${count} unread`}
      style={{
        position: 'absolute',
        top: -5,
        right: -8,
        minWidth: 16,
        height: 16,
        padding: '0 4px',
        borderRadius: 999,
        background: T.red,
        color: '#fff',
        fontSize: 9,
        fontWeight: 900,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        boxShadow: '0 0 0 2px #1e2329',
        pointerEvents: 'none',
        zIndex: 2
      }}
    >
      {label}
    </span>
  );
}

export default function NavbarLite() {
  const { pathname } = useLocation();
  const { user, userData, logout, actingAsUid, clearActingAsUid, dmThreads, communityUnread } =
    useContext(AuthContext);
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 920px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 920px)');
    const fn = () => setMobile(mq.matches);
    mq.addEventListener('change', fn);
    fn();
    return () => mq.removeEventListener('change', fn);
  }, []);

  const navLinkStyle = { color: T.text, textDecoration: 'none', fontSize: 13, flexShrink: 0 };
  const myProfilePath = user?.uid ? `/profile/${user.uid}` : '/login';

  const chatUnread = useMemo(() => {
    if (!user?.uid) return 0;
    return sumDmUnread(dmThreads, user.uid) + (Number(communityUnread) || 0);
  }, [user?.uid, dmThreads, communityUnread]);

  return (
    <nav
      className="app-navbar-shell"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        borderBottom: `1px solid ${T.border}`,
        background: T.card,
        flexShrink: 0
      }}
    >
      <Link to="/" style={{ color: T.yellow, textDecoration: 'none', fontWeight: 800, fontSize: mobile ? 22 : 30 }}>
        AuronX Trade
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflowX: 'auto', whiteSpace: 'nowrap', minWidth: 0 }}>
        <Link
          to="/about"
          style={{
            ...navLinkStyle,
            fontWeight: pathname === '/about' || pathname === '/about-founder' ? 700 : 500,
            color: pathname === '/about' || pathname === '/about-founder' ? T.yellow : T.text
          }}
        >
          About Us
        </Link>
        <Link
          to="/privacy-policy"
          style={{
            ...navLinkStyle,
            fontWeight: pathname === '/privacy-policy' ? 700 : 500,
            color: pathname === '/privacy-policy' ? T.yellow : T.text
          }}
        >
          Privacy Policy
        </Link>
        <Link
          to="/winners"
          style={{
            ...navLinkStyle,
            fontWeight: pathname === '/winners' || pathname.startsWith('/winners') ? 700 : 500,
            color: pathname === '/winners' || pathname.startsWith('/winners') ? T.yellow : T.text
          }}
        >
          Winners
        </Link>
        <Link
          to="/learn"
          style={{
            ...navLinkStyle,
            fontWeight: pathname === '/learn' || pathname.startsWith('/learn/') ? 700 : 500,
            color: pathname === '/learn' || pathname.startsWith('/learn/') ? T.yellow : T.text
          }}
        >
          Learn
        </Link>
        {!mobile ? <Link to="/wallet" style={navLinkStyle}>Wallet</Link> : null}
        <Link to="/rewards" style={navLinkStyle}>
          Rewards
        </Link>
        {user && !mobile ? (
          <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
            <Link to="/chat" style={{ ...navLinkStyle, fontWeight: 700 }}>
              Chat
            </Link>
            <ChatNavBadge count={chatUnread} />
          </span>
        ) : null}

        {user ? (
          <>
            {actingAsUid ? (
              <button
                type="button"
                onClick={clearActingAsUid}
                style={{
                  border: `1px solid ${T.yellow}`,
                  background: 'transparent',
                  color: T.yellow,
                  borderRadius: 5,
                  padding: '5px 10px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  flexShrink: 0
                }}
              >
                Exit showcase
              </button>
            ) : null}
            <Link
              to={myProfilePath}
              title="My Profile"
              aria-label="My Profile"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: mobile ? 6 : 0,
                textDecoration: 'none',
                flexShrink: 0,
                color: pathname.startsWith('/profile') ? T.yellow : T.text,
                fontWeight: pathname.startsWith('/profile') ? 700 : 500,
                fontSize: mobile ? 12 : undefined
              }}
            >
              <LeaderboardRowAvatar
                photoURL={userData?.photoURL || user?.photoURL}
                name={userData?.name || user?.displayName || user?.email || 'You'}
                seed={user?.uid}
                size={mobile ? 28 : 32}
              />
              {mobile ? <span>Profile</span> : null}
            </Link>
            {mobile ? (
              <Link
                to="/profile/edit"
                style={{
                  ...navLinkStyle,
                  color: T.yellow,
                  fontWeight: 700,
                  fontSize: 12,
                  flexShrink: 0
                }}
              >
                Edit
              </Link>
            ) : null}
            <span style={{ color: T.yellow, fontSize: 12, flexShrink: 0 }}>
              ${Number(userData?.virtualBalance || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
            <button
              type="button"
              onClick={logout}
              style={{ border: `1px solid ${T.red}`, background: 'transparent', color: T.red, borderRadius: 5, padding: '5px 10px', cursor: 'pointer' }}
            >
              Logout
            </button>
          </>
        ) : (
          <Link to="/login" style={{ color: '#000', background: T.yellow, padding: '6px 12px', borderRadius: 5, textDecoration: 'none', fontWeight: 700 }}>
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}
