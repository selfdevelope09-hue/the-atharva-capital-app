/** Client-side leaderboard snapshot (BFF / Firestore loadBoard). Must not serve stale rows after admin reset. */
export const LEADERBOARD_CACHE_KEY = 'auronx-leaderboard-cache-v4';
export const LEADERBOARD_CACHE_TTL_MS = 20 * 1000;

export function clearLeaderboardClientCacheAndNotify() {
  try {
    localStorage.removeItem(LEADERBOARD_CACHE_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent('auron-leaderboard-reload'));
  } catch {
    /* ignore */
  }
}

/** Invalidate cache but refresh in-place (no full-screen leaderboard spinner). */
export function notifyLeaderboardBackgroundRefresh() {
  try {
    localStorage.removeItem(LEADERBOARD_CACHE_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent('auron-leaderboard-reload', { detail: { background: true } }));
  } catch {
    /* ignore */
  }
}
