import React, { useContext, useState } from 'react';
import { AuthContext } from '../authContext';
import { bff } from '../api/serverBff';
import { T } from '../app/theme';
import {
  getPlanConfig,
  isPaidMember,
  paidFreeResetsRemaining,
  paidFreeResetLimit
} from '../config/paidPlan';

/**
 * Paid plan full reset — clears trades/P/L, restores plan wallet ($20k / $50k).
 */
export default function PaidFreeResetButton({ compact = false, onSuccess, style }) {
  const { user, userData, refreshUser } = useContext(AuthContext);
  const [busy, setBusy] = useState(false);

  if (!user?.uid || !isPaidMember(userData)) return null;

  const remaining = paidFreeResetsRemaining(userData);
  const limit = paidFreeResetLimit(userData);
  const cfg = getPlanConfig(userData);
  const startBal = cfg?.startBalanceUsd;

  const runReset = async () => {
    if (remaining <= 0 || busy) return;
    const msg = `Reset everything?\n\n• All open & closed trades cleared\n• Realized P/L set to $0\n• Wallet restored to $${startBal?.toLocaleString()} (${cfg?.label} plan)\n\nFree resets left after this: ${remaining - 1} of ${limit}`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await bff('/api/wallet/paid-free-reset', { method: 'POST', body: '{}' });
      await refreshUser();
      onSuccess?.();
    } catch (e) {
      window.alert(e?.message || 'Reset failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const disabled = remaining <= 0 || busy;

  return (
    <button
      type="button"
      title={
        remaining > 0
          ? `Free reset — restore $${startBal?.toLocaleString()} & clear trades (${remaining} left)`
          : 'No free resets left'
      }
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        runReset();
      }}
      disabled={disabled}
      style={{
        flexShrink: 0,
        marginLeft: compact ? 8 : 0,
        padding: compact ? '5px 10px' : '10px 14px',
        borderRadius: 8,
        border: `1px solid ${remaining > 0 ? 'rgba(240,185,11,0.55)' : T.border}`,
        background: remaining > 0 ? 'rgba(240,185,11,0.14)' : 'rgba(255,255,255,0.04)',
        color: remaining > 0 ? T.yellow : T.text,
        fontWeight: 800,
        fontSize: compact ? 10 : 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !busy ? 0.55 : 1,
        whiteSpace: 'nowrap',
        ...style
      }}
    >
      {busy ? '…' : compact ? `Reset (${remaining})` : `Free reset · ${remaining}/${limit} left`}
    </button>
  );
}
