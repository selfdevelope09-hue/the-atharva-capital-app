import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import LeaderboardPromoModal from './LeaderboardPromoModal';

const PROMO_SESSION_KEY = 'auron-paid-promo-seen-v1';

function promoSeenThisSession() {
  try {
    return sessionStorage.getItem(PROMO_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function markPromoSeen() {
  try {
    sessionStorage.setItem(PROMO_SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * Paid-plans poster — once per browser session (not every tab focus / route).
 */
export default function LeaderboardPromoGate({ enabled }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      return undefined;
    }
    if (!promoSeenThisSession()) setOpen(true);
    return undefined;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) return undefined;
    let handle;
    import('@capacitor/app')
      .then(({ App }) =>
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive && !promoSeenThisSession()) setOpen(true);
        })
      )
      .then((h) => {
        handle = h;
      })
      .catch(() => {});
    return () => {
      handle?.remove?.();
    };
  }, [enabled]);

  if (!enabled || !open) return null;
  return (
    <LeaderboardPromoModal
      onClose={() => {
        markPromoSeen();
        setOpen(false);
      }}
    />
  );
}
