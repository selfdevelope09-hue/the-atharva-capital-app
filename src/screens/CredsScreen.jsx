import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../authContext';
import { bff } from '../api/serverBff';
import { isBffDataMode } from '../config/dataBackend';
import { T } from '../app/theme';
import { Card } from '../components/ui/AppPrimitives';
import LeaderboardRowAvatar from '../components/LeaderboardRowAvatar';
import CredsHowItWorksModal from '../components/CredsHowItWorksModal';
import PaidMemberBadge from '../components/PaidMemberBadge';
import PremiumMembersModal from '../components/PremiumMembersModal';
import { isPaidMember } from '../config/paidPlan';

const PAGE_SIZE = 20;

const tierColors = {
  bronze: 'rgba(205,127,50,0.35)',
  silver: 'rgba(192,192,192,0.35)',
  gold: 'rgba(240,185,11,0.45)',
  alpha: 'rgba(155,89,182,0.45)'
};

function MyCredsCard({ me, loading }) {
  if (loading) {
    return (
      <Card style={{ padding: 16, marginBottom: 12, border: `1px solid ${T.border}` }}>
        <p style={{ color: T.text, margin: 0, fontSize: 16 }}>Loading your creds…</p>
      </Card>
    );
  }
  if (!me) {
    return (
      <Card style={{ padding: 16, marginBottom: 12, border: `1px solid ${T.border}` }}>
        <p style={{ color: T.text, margin: '0 0 10px', fontSize: 16, lineHeight: 1.5 }}>
          Sign in to track screen time, earn streak bonuses, and see your rank on the Ratings board.
        </p>
        <Link
          to="/login"
          style={{
            display: 'inline-block',
            padding: '10px 16px',
            borderRadius: 8,
            background: T.yellow,
            color: '#000',
            fontWeight: 800,
            textDecoration: 'none',
            fontSize: 15
          }}
        >
          Login
        </Link>
      </Card>
    );
  }

  const border = tierColors[me.badgeTier] || T.border;
  return (
    <Card
      style={{
        padding: 16,
        marginBottom: 12,
        border: `1px solid ${border}`,
        background: 'linear-gradient(145deg, rgba(30,35,41,0.98) 0%, rgba(11,14,17,0.98) 100%)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)'
      }}
    >
      <div style={{ fontSize: 13, color: T.text, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
        Your Ratings
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        <LeaderboardRowAvatar photoURL={me.photoURL} name={me.name} size={48} />
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: T.white }}>
            {me.name}
            {isPaidMember(me) ? <PaidMemberBadge size={16} /> : null}
          </div>
          <div style={{ marginTop: 4, fontSize: 15, color: T.yellow }}>{me.badgeLabel}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: T.text }}>Rank</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: T.white }}>
            {me.rank != null ? `#${me.rank}` : '—'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: T.text }}>Creds</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: T.yellow }}>{me.credsScore}</div>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
          gap: 8,
          marginTop: 14,
          fontSize: 14,
          color: T.text
        }}
      >
        <span>Active days: <strong style={{ color: T.white }}>{me.activeDays}</strong></span>
        <span>Online min: <strong style={{ color: T.white }}>{me.totalMinutesOnline}</strong></span>
        <span>Streak: <strong style={{ color: T.white }}>{me.currentStreakDays}d</strong></span>
        <span>Trades: <strong style={{ color: T.white }}>{me.totalTrades}</strong></span>
      </div>
    </Card>
  );
}

function CredsRow({ row }) {
  const tierBorder = tierColors[row.badgeTier] || T.border;
  return (
    <Link
      to={`/profile/${row.uid}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        textDecoration: 'none',
        color: T.white,
        borderBottom: `1px solid ${T.border}`,
        background: 'rgba(30,35,41,0.35)'
      }}
    >
      <span
        style={{
          width: 32,
          fontWeight: 900,
          fontSize: 17,
          color: row.rank <= 3 ? T.yellow : T.text,
          textAlign: 'center',
          flexShrink: 0
        }}
      >
        {row.rank}
      </span>
      <LeaderboardRowAvatar photoURL={row.photoURL} name={row.name} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.name}
          {isPaidMember(row) ? <PaidMemberBadge /> : null}
        </div>
        <div style={{ fontSize: 13, color: T.text, marginTop: 3 }}>{row.badgeLabel}</div>
      </div>
      <span
        style={{
          fontWeight: 900,
          fontSize: 18,
          color: T.yellow,
          padding: '5px 10px',
          borderRadius: 8,
          border: `1px solid ${tierBorder}`,
          flexShrink: 0
        }}
      >
        {row.credsScore}
      </span>
    </Link>
  );
}

export default function CredsScreen() {
  const { user } = useContext(AuthContext);
  const credsForUid = user?.uid || '';
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [me, setMe] = useState(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showHowCreds, setShowHowCreds] = useState(false);
  const [showPremium, setShowPremium] = useState(false);

  const load = useCallback(async (pageNum) => {
    if (!isBffDataMode()) {
      setError('Ratings require the live server. Enable BFF data mode.');
      setLoading(false);
      return;
    }
    if (!user?.uid) {
      setMe(null);
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const q = credsForUid ? `&forUid=${encodeURIComponent(credsForUid)}` : '';
      const data = await bff(`/api/data/creds-ratings?page=${pageNum}${q}`);
      if (!data?.ok) throw new Error(data?.error || 'Failed to load ratings');
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setMe(data.me || null);
      setTotalPages(Math.max(1, Number(data.totalPages) || 1));
      setTotalUsers(Number(data.totalUsers) || 0);
      setPage(Number(data.page) || pageNum);
    } catch (e) {
      setError(e?.message || 'Could not load ratings');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, credsForUid]);

  useEffect(() => {
    load(page);
  }, [load, page]);

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '12px 12px 24px', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <h1 style={{ margin: 0, fontSize: 26, color: T.white }}>Creds & Ratings</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowPremium(true)}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #0095F6',
              background: 'rgba(0,149,246,0.12)',
              color: '#0095F6',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            Premium Members
          </button>
          <button
            type="button"
            onClick={() => setShowHowCreds(true)}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: `1px solid ${T.yellow}`,
              background: 'rgba(240,185,11,0.12)',
              color: T.yellow,
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            How creds are calculated
          </button>
        </div>
      </div>
      <p style={{ margin: '0 0 14px', color: T.text, fontSize: 15, lineHeight: 1.55 }}>
        Reputation score from activity, screen time, trading habits, and streaks. Stay active with the tab focused to earn minutes.
      </p>

      <CredsHowItWorksModal open={showHowCreds} onClose={() => setShowHowCreds(false)} />
      <PremiumMembersModal open={showPremium} onClose={() => setShowPremium(false)} />

      <MyCredsCard me={user ? me : null} loading={!!user && loading && !me && !error} />

      {error ? (
        <Card style={{ padding: 14, color: T.red, marginBottom: 12 }}>{error}</Card>
      ) : null}

      <Card style={{ padding: 0, overflow: 'visible', border: `1px solid ${T.border}` }}>
        <div
          style={{
            padding: '10px 12px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8
          }}
        >
          <span style={{ fontWeight: 800, fontSize: 17 }}>Ratings leaderboard</span>
          <span style={{ fontSize: 13, color: T.text }}>
            {totalUsers > 0 ? `${totalUsers} traders · ` : ''}
            page {page}/{totalPages}
          </span>
        </div>

        {loading && rows.length === 0 ? (
          <p style={{ padding: 20, color: T.text, margin: 0, textAlign: 'center', fontSize: 15 }}>Loading traders…</p>
        ) : null}

        {!loading && rows.length === 0 && !error ? (
          <p style={{ padding: 20, color: T.text, margin: 0, textAlign: 'center', fontSize: 15 }}>No ratings yet.</p>
        ) : null}

        {rows.map((row) => (
          <CredsRow key={row.uid} row={row} />
        ))}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 12,
            gap: 10,
            borderTop: `1px solid ${T.border}`
          }}
        >
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={goPrev}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: page <= 1 ? 'rgba(132,142,156,0.15)' : T.card,
              color: page <= 1 ? T.text : T.white,
              fontWeight: 700,
              fontSize: 15,
              cursor: page <= 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>
          <span style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={goNext}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 8,
              border: `1px solid ${T.yellow}`,
              background: page >= totalPages ? 'rgba(132,142,156,0.15)' : 'rgba(240,185,11,0.12)',
              color: page >= totalPages ? T.text : T.yellow,
              fontWeight: 700,
              fontSize: 15,
              cursor: page >= totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
        </div>
      </Card>

      <p style={{ marginTop: 14, fontSize: 13, color: T.text, lineHeight: 1.5 }}>
        Tiers: 🥉 0–150 · 🥈 151–300 · 🥇 301–500 · 👑 501+. Liquidations reduce your score.
      </p>
    </div>
  );
}
