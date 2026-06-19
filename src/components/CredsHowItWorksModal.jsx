import React from 'react';
import { T } from '../app/theme';
import { CREDS_FORMULA_LINES, CREDS_TIER_LINES } from '../content/credsHelp';

export default function CredsHowItWorksModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="creds-how-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(11,14,17,0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: 'min(88vh, 640px)',
          overflow: 'auto',
          borderRadius: 14,
          border: `1px solid ${T.border}`,
          background: T.card,
          padding: '18px 16px 16px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.45)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <h2 id="creds-how-title" style={{ margin: 0, color: T.white, fontSize: 20, fontWeight: 900 }}>
            How creds are calculated
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              border: 'none',
              background: 'rgba(132,142,156,0.2)',
              color: T.white,
              borderRadius: 8,
              width: 32,
              height: 32,
              fontSize: 18,
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            ×
          </button>
        </div>
        <p style={{ color: T.text, fontSize: 14, lineHeight: 1.55, margin: '10px 0 16px' }}>
          Your <strong style={{ color: T.yellow }}>Creds</strong> score is a reputation number built from how you use
          AuronX. All items below add up; your tier badge follows the final total.
        </p>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
          {CREDS_FORMULA_LINES.map((line) => (
            <li
              key={line.label}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                background: 'rgba(30,35,41,0.5)'
              }}
            >
              <div style={{ color: T.yellow, fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{line.label}</div>
              <div style={{ color: T.text, fontSize: 13, lineHeight: 1.5 }}>{line.detail}</div>
            </li>
          ))}
        </ul>
        <h3 style={{ color: T.white, fontSize: 15, fontWeight: 800, margin: '18px 0 8px' }}>Tier badges</h3>
        <ul style={{ margin: 0, paddingLeft: 18, color: T.text, fontSize: 13, lineHeight: 1.65 }}>
          {CREDS_TIER_LINES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p style={{ color: T.text, fontSize: 12, lineHeight: 1.5, margin: '14px 0 0', opacity: 0.9 }}>
          Keep the app tab focused while practicing — screen time only counts when you are actively on AuronX.
        </p>
      </div>
    </div>
  );
}
