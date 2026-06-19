import React, { memo, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../authContext';
import { sumDmUnread } from '../utils/threadUnread';
import { T, BRAND_LOGO, BRAND_ALT, BRAND_NAME, BRAND_TAGLINE } from '../app/theme';
import LeaderboardRowAvatar from '../components/LeaderboardRowAvatar';

/** Desktop: full list. Mobile strip switches between main browse vs trading hub (matches app mockups). */
const NAV_LINKS_DESKTOP = [
  ['/x/home', 'Home'],
  ['/x/markets', 'Markets'],
  ['/x/trade', 'Trade'],
  ['/x/learn', 'Learn'],
  ['/x/profile', 'Profile'],
  ['/x/portfolio', 'Portfolio'],
  ['/x/leaderboard', 'Leaderboard'],
  ['/x/alerts', 'Alerts'],
  ['/x/insights', 'Insights/Tips'],
  ['/x/community', 'Community'],
  ['/x/screener', 'Screener'],
  ['/x/wallet-pro', 'Wallet'],
  ['/x/news', 'News']
];

const NAV_MOBILE_MAIN = [
  ['/x/home', 'Home'],
  ['/x/markets', 'Markets'],
  ['/x/trade', 'Trade'],
  ['/x/learn', 'Learn'],
  ['/x/profile', 'Profile']
];

const NAV_MOBILE_TRADING = [
  ['/x/trade', 'Trade'],
  ['/x/portfolio', 'Portfolio'],
  ['/x/risk', 'Risk'],
  ['/x/order-history', 'Orders'],
  ['/x/settings', 'Settings']
];

function mobileNavLinksForPath(pathname) {
  if (pathname.startsWith('/x/portfolio') || pathname.startsWith('/x/trade') || pathname.startsWith('/x/order-history') || pathname.startsWith('/x/risk')) {
    return NAV_MOBILE_TRADING;
  }
  return NAV_MOBILE_MAIN;
}

const Navbar = memo(function Navbar() {
  const { user, userData, logout, dmThreads, actingAsUid, clearActingAsUid, communityUnread } =
    useContext(AuthContext);
  const { pathname } = useLocation();
  const [navNarrow, setNavNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 920
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 920px)');
    const fn = () => setNavNarrow(mq.matches);
    mq.addEventListener('change', fn);
    fn();
    return () => mq.removeEventListener('change', fn);
  }, []);

  const chatUnread = useMemo(() => {
    if (!user) return 0;
    const dm = sumDmUnread(dmThreads, user.uid);
    return dm + (Number(communityUnread) || 0);
  }, [user, dmThreads, communityUnread]);

  const authActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: navNarrow ? 8 : 14, flexShrink: 0 }}>
      {user ? (
        <>
          <span
            style={{
              color: T.yellow,
              fontSize: navNarrow ? 11 : 13,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              maxWidth: navNarrow ? '5rem' : 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={`$${parseFloat(userData?.virtualBalance || 0).toFixed(2)}`}
          >
            $
            {parseFloat(userData?.virtualBalance || 0).toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: navNarrow ? 0 : 2
            })}
          </span>
          <Link
            to={`/profile/${encodeURIComponent(user.uid)}`}
            title="Profile"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              textDecoration: 'none',
              flexShrink: 0
            }}
          >
            <LeaderboardRowAvatar
              photoURL={userData?.photoURL}
              name={userData?.name || user.displayName || 'You'}
              size={navNarrow ? 26 : 30}
            />
          </Link>
          <Link
            to={`/profile/${encodeURIComponent(user.uid)}`}
            style={{
              color: T.white,
              fontSize: navNarrow ? 11 : 13,
              fontWeight: 600,
              textDecoration: 'none',
              borderBottom: `1px solid ${T.border}`,
              paddingBottom: 1
            }}
          >
            Profile
          </Link>
          <Link
            to="/profile/edit"
            style={{
              color: T.yellow,
              fontSize: navNarrow ? 11 : 13,
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={clearActingAsUid}
            style={{
              display: actingAsUid ? 'inline-flex' : 'none',
              background: 'none',
              border: `1px solid ${T.yellow}`,
              color: T.yellow,
              padding: navNarrow ? '7px 10px' : '5px 10px',
              borderRadius: 5,
              cursor: 'pointer',
              fontSize: navNarrow ? 11 : 12,
              fontWeight: 700,
              whiteSpace: 'nowrap'
            }}
            title="Back to your account"
          >
            Exit Showcase
          </button>
          <button
            type="button"
            onClick={logout}
            style={{
              background: 'none',
              border: `1px solid ${T.red}`,
              color: T.red,
              padding: navNarrow ? '7px 10px' : '5px 14px',
              borderRadius: 5,
              cursor: 'pointer',
              fontSize: navNarrow ? 11 : 13,
              fontWeight: 600,
              whiteSpace: 'nowrap'
            }}
          >
            Logout
          </button>
        </>
      ) : (
        <Link
          to="/login"
          style={{
            backgroundColor: T.yellow,
            color: '#000',
            padding: navNarrow ? '8px 12px' : '7px 18px',
            borderRadius: 5,
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: navNarrow ? 12 : 13,
            whiteSpace: 'nowrap'
          }}
        >
          Login
        </Link>
      )}
    </div>
  );

  const logo = (
    <Link
      to="/"
      style={{
        display: 'flex',
        alignItems: 'center',
        textDecoration: 'none',
        flexShrink: 0,
        lineHeight: 0,
        minWidth: 0
      }}
      aria-label={`${BRAND_NAME} â€” ${BRAND_TAGLINE} home`}
    >
      <img
        src={BRAND_LOGO}
        alt={BRAND_ALT}
        width={160}
        height={64}
        decoding="async"
        style={{
          height: navNarrow ? 28 : 36,
          width: 'auto',
          maxWidth: navNarrow ? 108 : 150,
          display: 'block'
        }}
      />
      <span
        style={{
          marginLeft: navNarrow ? 6 : 8,
          color: T.yellow,
          fontWeight: 800,
          fontSize: navNarrow ? 14 : 16,
          letterSpacing: '-0.02em',
          whiteSpace: 'nowrap'
        }}
      >
        {BRAND_NAME}
      </span>
    </Link>
  );

  const navBaseStyle = {
    width: '100%',
    padding: `max(8px, env(safe-area-inset-top, 0px)) clamp(10px, 3vw, 28px) 10px`,
    background: 'linear-gradient(180deg, #0a0a0a 0%, #000000 100%)',
    borderBottom: `1px solid rgba(240, 185, 11, 0.12)`,
    boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxSizing: 'border-box'
  };

  const renderDesktopLink = ([p, l]) => {
    const isChat = p === '/chat';
    const active = pathname === p;
    const linkBody = (
      <Link
        to={p}
        style={{
          color: active ? T.white : T.text,
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: active ? 700 : isChat ? 600 : 500,
          padding: '6px 2px'
        }}
      >
        {l}
      </Link>
    );
    return (
      <span
        key={p}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center'
        }}
      >
        {isChat && chatUnread > 0 ? (
          <>
            {linkBody}
            <span
              aria-label={`${chatUnread} unread chats`}
              title="Unread messages"
              style={{
                position: 'absolute',
                top: -2,
                right: -6,
                minWidth: 9,
                height: 9,
                borderRadius: 999,
                background: '#f6465d',
                boxShadow: '0 0 0 2px #1a1d22',
                pointerEvents: 'none'
              }}
            />
          </>
        ) : (
          linkBody
        )}
      </span>
    );
  };

  if (navNarrow) {
    return (
      <nav
        className="app-navbar app-navbar--mobile"
        style={{ ...navBaseStyle, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0 }}
      >
        <div
          className="app-navbar-top"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10 }}
        >
          {logo}
          {authActions}
        </div>
        <div className="nav-mobile-strip" role="navigation" aria-label="Main navigation">
          {mobileNavLinksForPath(pathname).map(([p, l]) => {
            const isChat = p === '/chat';
            const active = pathname === p;
            return (
              <span key={p} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                <Link
                  to={p}
                  className={`nav-mobile-link${active ? ' nav-mobile-link--active' : ''}`}
                  style={{ textDecoration: 'none' }}
                >
                  {l}
                </Link>
                {isChat && chatUnread > 0 ? (
                  <span
                    aria-label={`${chatUnread} unread`}
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 4,
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: '#f6465d',
                      pointerEvents: 'none'
                    }}
                  />
                ) : null}
              </span>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav
      className="app-navbar app-navbar--desktop"
      style={{ ...navBaseStyle, display: 'flex', alignItems: 'center', gap: 12, minHeight: 52 }}
    >
      {logo}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 16,
          flexWrap: 'wrap'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            flex: '1 1 200px',
            minWidth: 0
          }}
        >
          {NAV_LINKS_DESKTOP.map(renderDesktopLink)}
        </div>
        {authActions}
      </div>
    </nav>
  );
});

export default Navbar;
