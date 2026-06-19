import React from 'react';
import { Link } from 'react-router-dom';
import { T } from '../app/theme';
import { LEADERBOARD_ENDS_LABEL } from '../content/leaderboardPromo';
import { ordinalPlace } from '../utils/leaderboardWinnerCopy';
import LeaderboardRowAvatar from './LeaderboardRowAvatar';
/**
 * Top-10 monthly winners — same layout as leaderboard / Winners page.
 */
export default function LeaderboardWinnersList({ winners, title, subtitle, compact = false }) {
  if (!Array.isArray(winners) || !winners.length) return null;

  return (
    <section style={{ marginBottom: compact ? 12 : 18 }} aria-label={title || 'Monthly winners'}>
      {title ? (
        <h2 style={{ color: T.white, fontSize: compact ? 16 : 18, fontWeight: 800, margin: '0 0 4px' }}>{title}</h2>
      ) : null}
      {subtitle ? (
        <p style={{ color: T.text, fontSize: 13, marginTop: 0, marginBottom: 12, lineHeight: 1.5 }}>{subtitle}</p>
      ) : null}
      <div style={{ display: 'grid', gap: compact ? 8 : 10 }}>
        {winners.map((w) => (
            <div
              key={w.uid || w.rank}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: compact ? '12px 12px' : '14px 14px',
                borderRadius: 14,
                border: `1px solid ${w.rank <= 3 ? 'rgba(240,185,11,0.45)' : T.border}`,
                background: w.rank === 1 ? 'rgba(240,185,11,0.08)' : T.card
              }}
            >
              <div
                style={{
                  minWidth: 32,
                  fontWeight: 900,
                  fontSize: 14,
                  color: w.tone || (w.rank <= 3 ? T.yellow : T.text),
                  textAlign: 'center'
                }}
              >
                {w.rank === 1 ? '🥇' : w.rank === 2 ? '🥈' : w.rank === 3 ? '🥉' : w.rank}
              </div>
              <LeaderboardRowAvatar photoURL={w.photoURL} name={w.name} seed={w.uid} size={compact ? 42 : 48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: T.white, fontWeight: 800, fontSize: compact ? 15 : 16, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {w.name || 'Trader'}
                </div>
                <div style={{ color: T.green, fontSize: 12, marginTop: 2, fontWeight: 600 }}>
                  +${Number(w.realizedPnlTotal || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ color: w.tone || T.yellow, fontWeight: 900, fontSize: compact ? 15 : 17, whiteSpace: 'nowrap' }}>
                {w.prizeLabel || ordinalPlace(w.rank)}
              </div>
            </div>
        ))}
      </div>
    </section>
  );
}

export function HomeWinnersBlock({ winnersPayload }) {
  const announced =
    winnersPayload?.finalized && Array.isArray(winnersPayload.winners) && winnersPayload.winners.length > 0;
  if (!announced) return null;

  return (
    <div
      style={{
        marginBottom: 14,
        borderRadius: 16,
        border: '1px solid rgba(240,185,11,0.45)',
        background: 'linear-gradient(135deg, rgba(40,32,8,0.92) 0%, rgba(19,21,30,0.98) 55%, #0a0a0a 100%)',
        padding: '16px 16px 14px'
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: T.yellow, marginBottom: 8 }}>
        {winnersPayload.campaignKey === '2026-05' ? 'MAY 2026' : 'MONTHLY'} LEADERBOARD WINNERS
      </div>
      <LeaderboardWinnersList
        winners={winnersPayload.winners}
        compact
        subtitle={
          <>
            Final top 10 at{' '}
            <strong style={{ color: T.white }}>{winnersPayload.endsLabel || LEADERBOARD_ENDS_LABEL}</strong> (IST).{' '}
            <Link to="/winners" style={{ color: T.yellow, fontWeight: 700 }}>
              Payout steps →
            </Link>
          </>
        }
      />
    </div>
  );
}
