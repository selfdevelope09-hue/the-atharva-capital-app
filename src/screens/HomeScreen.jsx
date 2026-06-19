import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../authContext';
import { T, BRAND_LOGO, BRAND_ALT } from '../app/theme';
import { Card } from '../components/ui/AppPrimitives';
import { TaglineLine } from '../components/brand/TaglineBrand';
import { TickerTape } from '../layout/TickerTape';
import LeaderboardWinnerHomeBanner from '../components/LeaderboardWinnerHomeBanner';
import { HomeWinnersBlock } from '../components/LeaderboardWinnersList';
import { bffPublic } from '../api/serverBff';
import { LEADERBOARD_ENDS_LABEL } from '../content/leaderboardPromo';
function HomeScreen() {
  const { user, leaderboardWinner, actingAsUid } = useContext(AuthContext);
  const [winnersPayload, setWinnersPayload] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const j = await bffPublic('/api/data/leaderboard-winners');
        if (!cancelled) setWinnersPayload(j);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const winnersAnnounced =
    winnersPayload?.finalized && Array.isArray(winnersPayload.winners) && winnersPayload.winners.length > 0;

  return (
    <>
      <div style={{ width: '100%', overflow: 'hidden' }}>
        <TickerTape />
      </div>
      <div style={{ padding: 'clamp(14px,3.2vw,28px) 14px 30px', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
        <HomeWinnersBlock winnersPayload={winnersPayload} />

        {user && leaderboardWinner && !actingAsUid ? (
          <LeaderboardWinnerHomeBanner winner={leaderboardWinner} />
        ) : null}

        <div
          style={{
            borderRadius: 18,
            border: '1px solid rgba(240,185,11,0.35)',
            background: 'linear-gradient(120deg, rgba(11,14,17,0.98) 0%, rgba(11,14,17,0.96) 55%, rgba(25,20,8,0.96) 100%)',
            padding: '18px 18px 16px',
            marginBottom: 12
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, alignItems: 'center' }}>
            <div>
              <div style={{ color: T.text, fontSize: 13, marginBottom: 8 }}>Welcome to</div>
              <h1 style={{ color: T.white, fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 900, lineHeight: 1.1, margin: 0 }}>
                Auron<span style={{ color: T.yellow }}>X</span>
              </h1>
              <p style={{ color: T.text, fontSize: 15, lineHeight: 1.55, margin: '12px 0 10px' }}>
                Practice trading on real-time crypto market data. Learn, test and grow without financial risk.
              </p>
              <TaglineLine style={{ fontSize: 11, letterSpacing: '0.2em', marginBottom: 14 }} />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link to={user ? '/trade' : '/signup'} style={{ textDecoration: 'none', background: T.yellow, color: '#000', borderRadius: 12, padding: '11px 18px', fontWeight: 800, fontSize: 15 }}>
                  Start Trading
                </Link>
                <Link to="/tips" style={{ textDecoration: 'none', background: 'transparent', color: T.white, borderRadius: 12, border: `1px solid ${T.border}`, padding: '11px 18px', fontWeight: 700, fontSize: 15 }}>
                  Explore Insights
                </Link>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <img
                src={BRAND_LOGO}
                alt={BRAND_ALT}
                width={290}
                height={180}
                decoding="async"
                style={{ width: '100%', maxWidth: 280, height: 'auto', filter: 'drop-shadow(0 8px 24px rgba(240,185,11,0.25))' }}
              />
            </div>
          </div>
        </div>

        {!winnersAnnounced ? (
          <Link
            to="/winners"
            style={{
              display: 'block',
              textDecoration: 'none',
              marginBottom: 14,
              borderRadius: 16,
              overflow: 'hidden',
              border: '1px solid rgba(240,185,11,0.45)',
              background: 'linear-gradient(135deg, rgba(40,32,8,0.9) 0%, rgba(19,21,30,0.98) 55%, #0a0a0a 100%)'
            }}
          >
            <div style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: T.yellow, marginBottom: 6 }}>
                JUNE LEADERBOARD PRIZES
              </div>
              <div style={{ color: T.white, fontSize: 17, fontWeight: 800, marginBottom: 4 }}>
                Top 10 win up to ₹11,000
              </div>
              <div style={{ color: T.text, fontSize: 14 }}>
                {LEADERBOARD_ENDS_LABEL} · payout 1 July via UPI →
              </div>
            </div>
          </Link>
        ) : null}

        <Link
          to="/tips"
          style={{
            display: 'block',
            textDecoration: 'none',
            marginBottom: 14,
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid rgba(167,139,250,0.35)',
            background: 'linear-gradient(135deg, rgba(58,45,126,0.45) 0%, rgba(19,21,30,0.98) 60%, #0a0a0a 100%)'
          }}
        >
          <div style={{ padding: '18px 18px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', color: '#bba7ff', marginBottom: 8 }}>
              EXPERT MARKET INSIGHTS
            </div>
            <div style={{ color: T.white, fontSize: 18, fontWeight: 800, marginBottom: 6, lineHeight: 1.35 }}>
              Indian stock views — short-term, swing &amp; positional
            </div>
            <div style={{ color: T.text, fontSize: 15, lineHeight: 1.5 }}>
              Charts, entry / target / SL, and WhatsApp support. Tap to open insights hub →
            </div>
          </div>
        </Link>

        <h2 style={{ color: T.white, fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 26 }}>
          {[
            { to: '/trade', icon: '⚡', title: 'Trade', sub: 'Start Trading' },
            { to: '/dashboard', icon: '📊', title: 'Portfolio', sub: 'Track Performance' },
            { to: '/chat', icon: '💬', title: 'Chat', sub: 'Community Chat' },
            { to: '/wallet', icon: '👛', title: 'Wallet', sub: 'View Balance' },
            { to: '/learn', icon: '📘', title: 'Learn', sub: 'Trading blogs' },
            { to: '/leaderboard', icon: '🏆', title: 'Leaderboard', sub: 'Top Traders' }
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              style={{
                textDecoration: 'none',
                borderRadius: 14,
                padding: '16px 14px',
                background: '#11151d',
                border: `1px solid ${T.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
                boxShadow: '0 4px 18px rgba(0,0,0,0.22)'
              }}
            >
              <div style={{ color: T.yellow, fontSize: 22, lineHeight: 1 }}>{item.icon}</div>
              <div style={{ color: T.white, fontWeight: 800, fontSize: 17 }}>{item.title}</div>
              <div style={{ color: T.text, fontSize: 13 }}>{item.sub}</div>
            </Link>
          ))}
        </div>

        <section id="about-founder" aria-labelledby="about-founder-heading">
          <Card style={{ border: `1px solid rgba(240,185,11,0.26)`, padding: '20px clamp(14px, 3vw, 22px)' }}>
            <h2 id="about-founder-heading" style={{ color: T.white, fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
              About AuronX Trade &amp; the founder
            </h2>
            <TaglineLine style={{ marginBottom: 10, fontSize: 10, letterSpacing: '0.18em' }} />
            <p style={{ color: T.text, fontSize: 15, lineHeight: 1.65, marginBottom: 10 }}>
              <strong style={{ color: T.yellow }}>AuronX Trade</strong> is a virtual trading platform for
              market-data practice with no financial risk. Virtual trading only, not real trading.
            </p>
            <p style={{ color: T.text, fontSize: 15, lineHeight: 1.65, marginBottom: 14 }}>
              It is founded by <strong style={{ color: T.white }}>Atharva Darshanwar</strong>, a
              17-year-old entrepreneur from Nagpur, India, building under the Connect ecosystem.
            </p>
            <Link to="/about" style={{ color: T.yellow, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
              Full About AuronX Trade →
            </Link>
          </Card>
        </section>
      </div>
    </>
  );
}
export default HomeScreen;
