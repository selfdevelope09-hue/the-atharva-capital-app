import { useEffect, useRef } from 'react';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { bff } from '../api/serverBff';
import { isBffDataMode } from '../config/dataBackend';

const TICK_MS = 60000;

/**
 * Counts active minutes when tab is visible; syncs to Postgres (BFF) or Firestore.
 */
/**
 * @param {string|null|undefined} uid User to credit (real account or showcase when acting-as).
 */
export function useScreenTimeTracker(uid) {
  const ticking = useRef(false);

  useEffect(() => {
    if (!uid) return undefined;

    const pulse = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (ticking.current) return;
      ticking.current = true;
      try {
        if (isBffDataMode()) {
          await bff('/api/data/presence-minute', {
            method: 'POST',
            body: JSON.stringify({ forUid: uid })
          });
        } else {
          await updateDoc(doc(db, 'users', uid), { totalMinutesOnline: increment(1) });
        }
      } catch {
        /* ignore — retry next minute */
      } finally {
        ticking.current = false;
      }
    };

    pulse();
    const intervalId = window.setInterval(pulse, TICK_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') pulse();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [uid]);
}
