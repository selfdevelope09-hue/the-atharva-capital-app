import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseClient';
import { isFirestoreDisabled } from '../config/dataBackend';
import { bff } from '../api/serverBff';
import { normalizeUserDocData } from './userDoc';

/** Default wallet row for new traders (Firestore `users/{uid}`). */
export function defaultFirestoreUserRow(uid, authUser) {
  const cu = authUser || auth.currentUser;
  return {
    uid,
    email: cu?.email || '',
    name: cu?.displayName || cu?.email?.split('@')[0] || 'Trader',
    photoURL: cu?.photoURL || '',
    bio: '',
    virtualBalance: 10000,
    positions: [],
    closedPositions: [],
    lifetimeRealizedPnl: 0,
    watchlist: [],
    followers: [],
    following: [],
    createdAt: new Date().toISOString(),
    authProvider: cu?.providerData?.some((p) => p?.providerId === 'google.com') ? 'google' : 'password',
    dailyTradesCount: 0,
    dailyTradesDate: '',
    dailyAdTradeBonus: 0,
    dailyTwelveRewardClaimedDate: ''
  };
}

/** Create `users/{uid}` if missing — fixes login without doc, trades, portfolio. */
export async function ensureFirestoreUserDoc(uid) {
  if (!uid) return null;
  if (isFirestoreDisabled()) {
    try {
      const j = await bff('/api/data/me', { timeoutMs: 15000 });
      return j?.user ? normalizeUserDocData(j.user) : null;
    } catch {
      return null;
    }
  }
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return normalizeUserDocData(snap.data());
  const row = defaultFirestoreUserRow(uid);
  await setDoc(ref, row);
  return normalizeUserDocData(row);
}
