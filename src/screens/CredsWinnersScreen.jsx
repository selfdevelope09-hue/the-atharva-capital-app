import React from 'react';
import { Link } from 'react-router-dom';
import { T } from '../app/theme';
import { CREDS_GIFTS, CREDS_WINNERS_STEPS } from '../content/credsPromo';
import { platformOwnerChatPath, PLATFORM_OWNER_DISPLAY_NAME } from '../config/platformOwner';

export default function CredsWinnersScreen() {
  return (
    <main style={{ padding: '16px 14px 32px', maxWidth: 720, margin: '0 auto' }}>
      <p style={{ marginBottom: 12 }}>
        <Link to="/rewards" style={{ color: T.text, textDecoration: 'none', fontSize: 13 }}>
          ← Rewards
        </Link>
      </p>

      <h1 style={{ color: T.white, fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 900, margin: '0 0 6px' }}>
        Creds gifts &amp; claim
      </h1>
      <p style={{ color: T.text, fontSize: 14, lineHeight: 1.55, marginTop: 0, marginBottom: 18 }}>
        Top 3 Creds traders each month win exclusive gifts. Same claim flow as leaderboard winners — message the founder
        in Chat.
      </p>

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ color: T.white, fontSize: 17, fontWeight: 800, marginBottom: 12 }}>Monthly Creds gifts</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {CREDS_GIFTS.map((g) => (
            <div
              key={g.place}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 14px',
                borderRadius: 12,
                border: `1px solid ${T.border}`,
                background: T.card
              }}
            >
              <span style={{ fontSize: 28 }} aria-hidden>
                {g.icon}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ color: g.tone, fontWeight: 800, fontSize: 15 }}>{g.place}</div>
                <div style={{ color: T.white, fontWeight: 700, fontSize: 14, marginTop: 4 }}>{g.reward}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: T.white, fontSize: 17, fontWeight: 800, marginBottom: 12 }}>Claim process</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {CREDS_WINNERS_STEPS.map((s) => (
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
                  <div style={{ color: '#0095F6', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em' }}>
                    STEP {s.step}
                  </div>
                  <div style={{ color: T.white, fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{s.title}</div>
                  <p style={{ color: T.text, fontSize: 14, lineHeight: 1.55, margin: 0 }}>{s.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link
          to="/creds"
          style={{
            textAlign: 'center',
            textDecoration: 'none',
            padding: '14px 16px',
            borderRadius: 12,
            background: '#0095F6',
            color: '#fff',
            fontWeight: 800,
            fontSize: 15
          }}
        >
          Climb the Creds board
        </Link>
        <Link
          to={platformOwnerChatPath()}
          style={{
            textAlign: 'center',
            textDecoration: 'none',
            padding: '14px 16px',
            borderRadius: 12,
            border: `1px solid #0095F6`,
            background: 'rgba(0,149,246,0.1)',
            color: '#0095F6',
            fontWeight: 800,
            fontSize: 15
          }}
        >
          Chat with {PLATFORM_OWNER_DISPLAY_NAME} (claim gift)
        </Link>
      </div>
    </main>
  );
}
