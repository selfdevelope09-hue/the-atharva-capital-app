import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bff } from '../api/serverBff';
import { isBffDataMode } from '../config/dataBackend';
import { T } from '../app/theme';
import { Card } from '../components/ui/AppPrimitives';
import LeaderboardRowAvatar from '../components/LeaderboardRowAvatar';
import PaidMemberBadge, { PlanTierChip } from './PaidMemberBadge';

export default function PremiumMembersModal({ open, onClose }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    if (!isBffDataMode()) {
      setError('Premium members list requires live server mode.');
      return undefined;
    }
    setLoading(true);
    setError('');
    bff('/api/data/premium-members')
      .then((j) => {
        setMembers(Array.isArray(j.members) ? j.members : []);
      })
      .catch((e) => setError(e?.message || 'Could not load premium members'))
      .finally(() => setLoading(false));
    return undefined;
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Premium members"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
    >
      <Card
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(0,149,246,0.45)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.55)'
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10
          }}
        >
          <div>
            <div style={{ color: '#0095F6', fontSize: 11, fontWeight: 800, letterSpacing: 1.2 }}>PREMIUM</div>
            <h2 style={{ margin: 0, color: T.white, fontSize: 18, fontWeight: 900 }}>Premium Members</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              border: 'none',
              background: T.card2,
              color: T.white,
              width: 36,
              height: 36,
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 18
            }}
          >
            ×
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
          {loading ? (
            <p style={{ padding: 20, color: T.text, textAlign: 'center' }}>Loading…</p>
          ) : error ? (
            <p style={{ padding: 20, color: T.red, textAlign: 'center' }}>{error}</p>
          ) : members.length === 0 ? (
            <p style={{ padding: 20, color: T.text, textAlign: 'center', lineHeight: 1.5 }}>
              No active premium members yet. Be the first — upgrade from Wallet.
            </p>
          ) : (
            members.map((m) => (
              <Link
                key={m.uid}
                to={`/profile/${encodeURIComponent(m.uid)}`}
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 18px',
                  textDecoration: 'none',
                  color: T.white,
                  borderBottom: `1px solid ${T.border}`
                }}
              >
                <LeaderboardRowAvatar photoURL={m.photoURL} name={m.name} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.name}
                    </span>
                    <PaidMemberBadge size={20} />
                    <PlanTierChip planType={m.paidPlanType} />
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
        <div style={{ padding: '12px 18px', borderTop: `1px solid ${T.border}` }}>
          <Link
            to="/wallet"
            onClick={onClose}
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '12px 14px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #0095F6, #1877f2)',
              color: '#fff',
              fontWeight: 800,
              textDecoration: 'none',
              fontSize: 14
            }}
          >
            Upgrade your plan →
          </Link>
        </div>
      </Card>
    </div>
  );
}
