import React from 'react';
import { PLAN_ULTIMATE_PRO } from '../config/paidPlan';

const BADGE_SRC = '/verified-badge.png';

/** Scalloped verified badge — uses user-provided asset. */
export default function PaidMemberBadge({ size = 20, title = 'Verified member' }) {
  const s = Number(size) || 16;
  return (
    <img
      src={BADGE_SRC}
      alt={title}
      title={title}
      width={s}
      height={s}
      style={{
        flexShrink: 0,
        verticalAlign: 'middle',
        marginLeft: 4,
        display: 'inline-block',
        objectFit: 'contain'
      }}
    />
  );
}

function DiamondTierIcon({ size = 16 }) {
  const s = Number(size) || 16;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      aria-hidden
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="diamondGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="45%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5L4 9.5l8 12 8-12L12 2.5z"
        fill="url(#diamondGrad)"
        stroke="#bae6fd"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M4 9.5h16M8.5 9.5L12 2.5l3.5 7M12 9.5v12" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
    </svg>
  );
}

export function PlanTierChip({ planType, size = 'sm' }) {
  const t = String(planType || '').toLowerCase();
  if (t === PLAN_ULTIMATE_PRO) {
    const iconSize = size === 'sm' ? 16 : 18;
    return (
      <span
        title="Ultimate Pro"
        style={{
          marginLeft: 6,
          display: 'inline-flex',
          alignItems: 'center',
          flexShrink: 0,
          verticalAlign: 'middle',
          filter: 'drop-shadow(0 0 4px rgba(56,189,248,0.45))'
        }}
      >
        <DiamondTierIcon size={iconSize} />
      </span>
    );
  }
  if (t !== 'basic' && t !== 'pro') return null;
  const isPro = t === 'pro';
  const pad = size === 'sm' ? '2px 7px' : '3px 9px';
  const fs = size === 'sm' ? 10 : 11;
  return (
    <span
      style={{
        marginLeft: 6,
        padding: pad,
        borderRadius: 6,
        fontSize: fs,
        fontWeight: 900,
        letterSpacing: 0.04,
        color: isPro ? '#fff' : '#0095F6',
        background: isPro ? 'linear-gradient(135deg, #a855f7, #7c3aed)' : 'rgba(0,149,246,0.15)',
        border: `1px solid ${isPro ? 'rgba(168,85,247,0.85)' : 'rgba(0,149,246,0.55)'}`,
        flexShrink: 0,
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
        textTransform: 'uppercase'
      }}
    >
      {isPro ? 'Pro' : 'Basic'}
    </span>
  );
}
