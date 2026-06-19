import { normalizeUserDocData } from './userDoc';

const KEY_PREFIX = 'auron-user-cache:v1:';

export function readUserDataCache(uid) {
  if (!uid || typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY_PREFIX + uid);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.uid !== uid) return null;
    return normalizeUserDocData(parsed);
  } catch {
    return null;
  }
}

export function writeUserDataCache(uid, data) {
  if (!uid || !data || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(KEY_PREFIX + uid, JSON.stringify(normalizeUserDocData(data)));
  } catch {
    /* quota / private mode */
  }
}

export function clearUserDataCache(uid) {
  if (!uid || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(KEY_PREFIX + uid);
  } catch {
    /* ignore */
  }
}

/** Instant UI while /api/data/me loads. */
export function optimisticUserFromAuth(fbUser) {
  if (!fbUser?.uid) return null;
  return normalizeUserDocData({
    uid: fbUser.uid,
    email: fbUser.email || '',
    name: fbUser.displayName || (fbUser.email ? String(fbUser.email).split('@')[0] : 'Trader'),
    photoURL: fbUser.photoURL || '',
    virtualBalance: 10000,
    positions: [],
    closedPositions: [],
    followers: [],
    following: [],
    watchlist: []
  });
}
