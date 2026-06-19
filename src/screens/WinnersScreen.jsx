import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { T } from '../app/theme';
import {
  LEADERBOARD_PROMO_POSTER_URL,
  LEADERBOARD_ENDS_LABEL,
  LEADERBOARD_PERIOD,
  MONTHLY_PRIZES_INR,
  WINNERS_STEPS,
  PAYOUT_LABEL
} from '../content/leaderboardPromo';
import { platformOwnerChatPath, PLATFORM_OWNER_DISPLAY_NAME } from '../config/platformOwner';
import { bffPublic } from '../api/serverBff';
import LeaderboardWinnersList from '../components/LeaderboardWinnersList';

export default function WinnersScreen() {
  const [winnersPayload, setWinnersPayload] = useState(null);
  const [loadErr, setLoadErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const j = await bffPublic('/api/data/leaderboard-winners');
        if (!cancelled) setWinnersPayload(j);
      } catch (e) {
        if (!cancelled) setLoadErr(String(e?.message || 'Could not load winners'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const announced = winnersPayload?.finalized && Array.isArray(winnersPayload.winners) && winnersPayload.winners.length > 0;

  return (
    <main style={{ padding: '16px 14px 32px', maxWidth: 720, margin: '0 auto' }}>
      <p style={{ marginBottom: 12 }}>
        <Link to="/" style={{ color: T.text, textDecoration: 'none', fontSize: 13 }}>
          ← Home
        </Link>
      </p>

      <h1 style={{ color: T.white, fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 900, margin: '0 0 6px' }}>
        Winners &amp; payout
      </h1>
      <p style={{ color: T.text, fontSize: 14, lineHeight: 1.55, marginTop: 0, marginBottom: 16 }}>
        <strong style={{ color: T.white }}>{LEADERBOARD_PERIOD}</strong> · Rankings freeze on{' '}
        <strong style={{ color: T.yellow }}>{LEADERBOARD_ENDS_LABEL}</strong>. Payout{' '}
        <strong style={{ color: T.yellow }}>{PAYOUT_LABEL}</strong>.
      </p>

      {announced ? (
        <LeaderboardWinnersList
          winners={winnersPayload.winners}
          title={
            winnersPayload.campaignKey === '2026-05'
              ? 'May 2026 winners'
              : winnersPayload.campaignKey === '2026-06'
                ? 'June 2026 winners'
                : 'Monthly leaderboard winners'
          }
          subtitle={
            <>
              Final rankings at{' '}
              <strong style={{ color: T.white }}>{winnersPayload.endsLabel || LEADERBOARD_ENDS_LABEL}</strong> (IST).
            </>
          }
        />
      ) : (
        <p style={{ color: T.text, fontSize: 14, marginBottom: 18, lineHeight: 1.55 }}>
          June top 10 will be listed here after <strong style={{ color: T.yellow }}>{LEADERBOARD_ENDS_LABEL}</strong>.
          Compete now on the live board.
        </p>
      )}

      {loadErr ? (
        <p style={{ color: T.red, fontSize: 13, marginBottom: 14 }}>{loadErr}</p>
      ) : null}

      <div
        style={{
          borderRadius: 14,
          overflow: 'hidden',
          border: `1px solid rgba(240,185,11,0.35)`,
          marginBottom: 18
        }}
      >
        <img
          src={LEADERBOARD_PROMO_POSTER_URL}
          alt="Leaderboard ending soon — monthly prizes and winners process"
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      </div>

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ color: T.white, fontSize: 17, fontWeight: 800, marginBottom: 12 }}>Monthly prize pool</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {MONTHLY_PRIZES_INR.map((p) => (
            <div
              key={p.rank ?? p.place}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                borderRadius: 12,
                border: `1px solid ${T.border}`,
                background: T.card
              }}
            >
              <span style={{ color: T.text, fontWeight: 600 }}>{p.place}</span>
              <span style={{ color: p.tone, fontWeight: 900, fontSize: 18 }}>{p.amount}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: T.white, fontSize: 17, fontWeight: 800, marginBottom: 12 }}>Winners &amp; payout process</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {WINNERS_STEPS.map((s) => (
            <div
              key={s.step}
              style={{
                padding: '14px 14px',
                borderRadius: 12,
                border: `1px solid ${T.border}`,
                background: T.card
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden>
                  {s.icon}
                </span>
                <div>
                  <div style={{ color: T.yellow, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em' }}>
                    STEP {s.step}
                  </div>
                  <div style={{ color: T.white, fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{s.title}</div>
                  <p style={{ color: T.text, fontSize: 14, lineHeight: 1.55, margin: 0 }}>{s.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ color: T.text, fontSize: 13, marginTop: 12, lineHeight: 1.5 }}>
          Payout date: <strong style={{ color: T.white }}>{PAYOUT_LABEL}</strong>
        </p>
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link
          to="/leaderboard"
          style={{
            textAlign: 'center',
            textDecoration: 'none',
            padding: '14px 16px',
            borderRadius: 12,
            background: T.yellow,
            color: '#000',
            fontWeight: 800,
            fontSize: 15
          }}
        >
          Compete on leaderboard
        </Link>
        <Link
          to={platformOwnerChatPath()}
          style={{
            textAlign: 'center',
            textDecoration: 'none',
            padding: '14px 16px',
            borderRadius: 12,
            border: `1px solid ${T.yellow}`,
            background: 'rgba(240,185,11,0.1)',
            color: T.yellow,
            fontWeight: 800,
            fontSize: 15
          }}
        >
          Chat with {PLATFORM_OWNER_DISPLAY_NAME} (QR / payout)
        </Link>
      </div>

      <p style={{ color: T.text, fontSize: 11, lineHeight: 1.5, marginTop: 20, opacity: 0.85 }}>
        Virtual trading only — no real money on the platform. Prizes are promotional rewards for the monthly
        leaderboard competition.
      </p>
    </main>
  );
}
