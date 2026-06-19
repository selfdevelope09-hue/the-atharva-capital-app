import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { T } from '../app/theme';
import { STARTUP_PROMO_POSTER_URL } from '../content/leaderboardPromo';

/**
 * Full-screen promo poster. Parent controls open state; show again on each app open / resume.
 */
export default function LeaderboardPromoModal({ onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Level up your trading — choose your plan"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 12000,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'max(10px, env(safe-area-inset-top)) 10px max(10px, env(safe-area-inset-bottom))'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          flexShrink: 0,
          padding: '4px 4px 8px'
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            border: `1px solid ${T.border}`,
            background: T.card,
            color: T.white,
            fontSize: 22,
            fontWeight: 700,
            cursor: 'pointer',
            lineHeight: 1
          }}
        >
          ×
        </button>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          borderRadius: 14,
          border: `1px solid rgba(240,185,11,0.35)`
        }}
      >
        <img
          src={STARTUP_PROMO_POSTER_URL}
          alt="Level up your trading — Free, Basic ₹49/mo, Pro ₹99/mo, and Ultimate Pro ₹250/mo with verified badge, premium order book, and bonus Creds"
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            verticalAlign: 'top'
          }}
        />
      </div>

      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          gap: 8,
          paddingTop: 10,
          flexWrap: 'wrap'
        }}
      >
        <Link
          to="/wallet"
          onClick={onClose}
          style={{
            flex: 1,
            minWidth: 120,
            textAlign: 'center',
            textDecoration: 'none',
            padding: '12px 14px',
            borderRadius: 12,
            background: T.yellow,
            color: '#000',
            fontWeight: 800,
            fontSize: 14
          }}
        >
          View plans
        </Link>
        <Link
          to="/rewards"
          onClick={onClose}
          style={{
            flex: 1,
            minWidth: 120,
            textAlign: 'center',
            textDecoration: 'none',
            padding: '12px 14px',
            borderRadius: 12,
            border: `1px solid ${T.border}`,
            background: T.card,
            color: T.white,
            fontWeight: 700,
            fontSize: 14
          }}
        >
          Rewards & prizes
        </Link>
      </div>
    </div>
  );
}
