import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { AuthContext } from '../authContext';
import { db } from '../firebaseClient';
import { isFirestoreDisabled } from '../config/dataBackend';
import { T } from '../app/theme';
import { Card } from '../components/ui/AppPrimitives';
import {
  MONTHLY_LEADERBOARD_PRIZES_INR,
  DAILY_FULL_TRADES_USD_BONUS,
  DAILY_OPENS_TARGET_FOR_USD_BONUS,
  LEADERBOARD_PERIOD_LABEL,
  LEADERBOARD_FREEZE_LABEL,
  LEADERBOARD_PAYOUT_LABEL
} from '../utils/rewardConstants';
import { getDailyTwelveRewardStatus } from '../utils/rewardProgress';
import { getEffectiveDailyOpenLimit } from '../utils/tradingDayLimit';
import { PRIMARY_STOCK_TIP_OWNER_UID, mergeTipEditorFallbackUids, extraTipEditorUidsFromEnv } from '../stockTips/tipEditorUid';
import { CREDS_GIFTS } from '../content/credsPromo';
import { LEADERBOARD_PROMO_POSTER_URL } from '../content/leaderboardPromo';
import { platformOwnerChatPath, PLATFORM_OWNER_DISPLAY_NAME } from '../config/platformOwner';

const DEFAULT_BANNERS = [
  {
    title: 'Compete on two tracks',
    subtitle: 'Leaderboard P/L prizes · Creds top-3 gifts — see columns below',
    accent: '#f0b90b',
    imageUrl: ''
  },
  {
    title: 'Premium plans unlock more',
    subtitle: 'Basic ₹49 · Pro ₹99 · Ultimate Pro ₹250/mo — verified badge, extra trades, bonus Creds',
    accent: '#0095F6',
    imageUrl: ''
  }
];

export default function RewardsScreen() {
  const { user, userData } = useContext(AuthContext);
  const [banners, setBanners] = useState(DEFAULT_BANNERS);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [showDevLink, setShowDevLink] = useState(false);
  const [showAllLbPrizes, setShowAllLbPrizes] = useState(false);

  useEffect(() => {
    if (isFirestoreDisabled()) return undefined;
    const ref = doc(db, 'config', 'rewardsContent');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const d = snap.data();
        const b = Array.isArray(d?.banners) && d.banners.length ? d.banners : null;
        if (b) {
          setBanners(
            b.map((x) => ({
              title: String(x.title || ''),
              subtitle: String(x.subtitle || ''),
              accent: String(x.accent || '#f0b90b'),
              imageUrl: String(x.imageUrl || '')
            }))
          );
        } else setBanners(DEFAULT_BANNERS);
      },
      () => setBanners(DEFAULT_BANNERS)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setBannerIdx((i) => (i + 1) % Math.max(1, banners.length)), 4800);
    return () => clearInterval(id);
  }, [banners.length]);

  useEffect(() => {
    if (isFirestoreDisabled()) {
      if (user?.uid === PRIMARY_STOCK_TIP_OWNER_UID) setShowDevLink(true);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'stockTipEditors'));
        const arr = snap.exists() ? snap.data()?.uids : [];
        const editors = mergeTipEditorFallbackUids(Array.isArray(arr) ? arr : []);
        const extras = extraTipEditorUidsFromEnv();
        const all = new Set([...editors, ...extras, PRIMARY_STOCK_TIP_OWNER_UID]);
        if (!cancelled && user?.uid && all.has(user.uid)) setShowDevLink(true);
      } catch {
        if (!cancelled && user?.uid === PRIMARY_STOCK_TIP_OWNER_UID) setShowDevLink(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const twelve = useMemo(() => getDailyTwelveRewardStatus(userData), [userData]);
  const effLimit = useMemo(() => getEffectiveDailyOpenLimit(userData), [userData]);
  const pct = twelve.target > 0 ? Math.min(100, Math.round((twelve.used / twelve.target) * 100)) : 0;
  const cur = banners[bannerIdx] || banners[0] || DEFAULT_BANNERS[0];

  const walletRewardsLink = ({ isActive }) => ({
    padding: '8px 14px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    textDecoration: 'none',
    border: `1px solid ${isActive ? T.yellow : T.border}`,
    background: isActive ? 'rgba(240,185,11,0.14)' : 'rgba(26,26,26,0.95)',
    color: isActive ? T.yellow : T.text
  });

  const columnShell = {
    borderRadius: 16,
    border: `1px solid ${T.border}`,
    overflow: 'hidden',
    background: 'linear-gradient(180deg, rgba(30,35,41,0.95) 0%, rgba(11,14,17,0.98) 100%)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.35)'
  };

  return (
    <div
      style={{
        padding: '14px clamp(12px, 3vw, 22px) max(100px, calc(24px + env(safe-area-inset-bottom, 0px)))',
        maxWidth: 920,
        margin: '0 auto',
        minHeight: '60vh'
      }}
    >
      <nav aria-label="Wallet and rewards" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <NavLink to="/wallet" end style={walletRewardsLink}>
          Wallet
        </NavLink>
        <NavLink to="/rewards" style={walletRewardsLink}>
          Rewards
        </NavLink>
      </nav>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h1 style={{ color: T.white, margin: 0, fontSize: 'clamp(1.35rem, 5vw, 1.75rem)', fontWeight: 900 }}>
          Rewards Hub
        </h1>
        {showDevLink ? (
          <Link to="/developer/rewards" style={{ color: T.yellow, fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>
            Edit CMS →
          </Link>
        ) : null}
      </div>

      <div
        className="rewards-hero-shimmer rewards-rotating-banner"
        style={{
          borderRadius: 16,
          border: `1px solid rgba(240, 185, 11, 0.35)`,
          overflow: 'hidden',
          marginBottom: 18,
          minHeight: 120,
          padding: '18px 16px 20px'
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: cur.accent || T.yellow, letterSpacing: 2, marginBottom: 6 }}>
          FEATURED
        </div>
        <div style={{ color: T.white, fontSize: 20, fontWeight: 900, lineHeight: 1.2 }}>{cur.title}</div>
        <div style={{ color: T.text, fontSize: 14, marginTop: 8, lineHeight: 1.45 }}>{cur.subtitle}</div>
      </div>

      {user ? (
        <Card style={{ marginBottom: 18, padding: 16, border: `1px solid rgba(2, 192, 118, 0.35)` }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.green, marginBottom: 8 }}>YOUR DAILY GRIND</div>
          <div style={{ color: T.white, fontSize: 18, fontWeight: 900, marginBottom: 6 }}>
            {twelve.used} / {twelve.target} opens today
          </div>
          <div style={{ height: 10, borderRadius: 999, background: T.card2, overflow: 'hidden', marginTop: 10 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${T.green}, ${T.yellow})` }} />
          </div>
          <div style={{ color: T.text, fontSize: 12, marginTop: 10 }}>
            Cap today: <strong style={{ color: T.white }}>{effLimit}</strong> opens · ${DAILY_FULL_TRADES_USD_BONUS.toLocaleString()} bonus at{' '}
            {DAILY_OPENS_TARGET_FOR_USD_BONUS} opens
          </div>
        </Card>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          alignItems: 'start'
        }}
      >
        {/* Leaderboard column */}
        <div style={columnShell}>
          <div
            style={{
              padding: '14px 16px',
              borderBottom: `1px solid ${T.border}`,
              background: 'rgba(240,185,11,0.08)'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: T.yellow, letterSpacing: 1 }}>TRACK 1</div>
            <div style={{ color: T.white, fontWeight: 900, fontSize: 17 }}>Leaderboard</div>
            <div style={{ color: T.text, fontSize: 12, marginTop: 4 }}>
              Top P/L · {LEADERBOARD_PERIOD_LABEL}
            </div>
          </div>
          <div style={{ padding: 14 }}>
            <div
              style={{
                borderRadius: 12,
                overflow: 'hidden',
                border: `1px solid rgba(240,185,11,0.35)`,
                marginBottom: 12
              }}
            >
              <img
                src={LEADERBOARD_PROMO_POSTER_URL}
                alt="June leaderboard top 10 UPI prizes"
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />
            </div>
            {(showAllLbPrizes ? MONTHLY_LEADERBOARD_PRIZES_INR : MONTHLY_LEADERBOARD_PRIZES_INR.slice(0, 3)).map(
              (p) => (
              <div
                key={p.rank}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '11px 12px',
                  borderRadius: 10,
                  marginBottom: 8,
                  background: 'rgba(240,185,11,0.06)',
                  border: `1px solid ${p.rank === 1 ? T.yellow : T.border}`
                }}
              >
                <span style={{ color: T.white, fontWeight: 700 }}>{p.label}</span>
                <span style={{ color: T.yellow, fontWeight: 900 }}>₹{p.amount.toLocaleString('en-IN')}</span>
              </div>
            )
            )}
            {!showAllLbPrizes ? (
              <button
                type="button"
                onClick={() => setShowAllLbPrizes(true)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: T.card2,
                  color: T.white,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  marginBottom: 8
                }}
              >
                View more (4th – 10th) ↓
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAllLbPrizes(false)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: 'transparent',
                  color: T.text,
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer',
                  marginBottom: 8
                }}
              >
                View less ↑
              </button>
            )}
            <p style={{ color: T.text, fontSize: 12, lineHeight: 1.5, margin: '8px 0 14px' }}>
              Freezes <strong style={{ color: T.white }}>{LEADERBOARD_FREEZE_LABEL}</strong> · Payout{' '}
              <strong style={{ color: T.white }}>{LEADERBOARD_PAYOUT_LABEL}</strong> (manual UPI by admin).
            </p>
            <Link
              to="/winners"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '13px 14px',
                borderRadius: 10,
                background: T.yellow,
                color: '#000',
                fontWeight: 900,
                textDecoration: 'none',
                fontSize: 14
              }}
            >
              Winners & payout process →
            </Link>
            <Link
              to="/leaderboard"
              style={{ display: 'block', textAlign: 'center', marginTop: 10, color: T.yellow, fontWeight: 700, fontSize: 13 }}
            >
              Open leaderboard
            </Link>
          </div>
        </div>

        {/* Creds column */}
        <div style={columnShell}>
          <div
            style={{
              padding: '14px 16px',
              borderBottom: `1px solid ${T.border}`,
              background: 'rgba(0,149,246,0.08)'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0095F6', letterSpacing: 1 }}>TRACK 2</div>
            <div style={{ color: T.white, fontWeight: 900, fontSize: 17 }}>Creds</div>
            <div style={{ color: T.text, fontSize: 12, marginTop: 4 }}>Top reputation — exclusive gifts</div>
          </div>
          <div style={{ padding: 14 }}>
            {CREDS_GIFTS.map((g) => (
              <div
                key={g.place}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 12px',
                  borderRadius: 10,
                  marginBottom: 8,
                  background: 'rgba(0,149,246,0.06)',
                  border: `1px solid ${T.border}`
                }}
              >
                <span style={{ fontSize: 22 }} aria-hidden>
                  {g.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: g.tone, fontWeight: 800, fontSize: 13 }}>{g.place}</div>
                  <div style={{ color: T.text, fontSize: 12, marginTop: 2 }}>{g.reward}</div>
                </div>
              </div>
            ))}
            <p style={{ color: T.text, fontSize: 12, lineHeight: 1.5, margin: '8px 0 14px' }}>
              Earn Creds from activity, streaks, and trading. Top 3 at month-end win the gifts below.
            </p>
            <Link
              to="/creds-winners"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '13px 14px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #0095F6, #1877f2)',
                color: '#fff',
                fontWeight: 900,
                textDecoration: 'none',
                fontSize: 14
              }}
            >
              Creds gifts & claim process →
            </Link>
            <Link
              to="/creds"
              style={{ display: 'block', textAlign: 'center', marginTop: 10, color: '#0095F6', fontWeight: 700, fontSize: 13 }}
            >
              View Creds leaderboard
            </Link>
          </div>
        </div>
      </div>

      <Card style={{ marginTop: 18, padding: 14, fontSize: 12, color: T.text, lineHeight: 1.55 }}>
        Questions?{' '}
        <Link to={platformOwnerChatPath()} style={{ color: T.yellow, fontWeight: 700 }}>
          Chat with {PLATFORM_OWNER_DISPLAY_NAME}
        </Link>
      </Card>
    </div>
  );
}
