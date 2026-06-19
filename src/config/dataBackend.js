/**
 * Data backend: Firebase Firestore vs DigitalOcean Postgres (HTTP BFF on realtime server).
 */

const QUOTA_SESSION_KEY = 'auron-firestore-quota';

function postgresMode() {
  return true;
}

export function isSupabaseConfigured() {
  return false;
}

export function isSupabaseDataBackend() {
  return false;
}

export function isSupabaseFallbackEnabled() {
  return false;
}

export function isPostgresDataMode() {
  return postgresMode();
}

/** No Firestore reads/writes for app data (Postgres + Socket.io only). */
export function isFirestoreDisabled() {
  return postgresMode();
}

/** @deprecated use isFirestoreDisabled */
export function shouldUseFirestore() {
  return !isFirestoreDisabled();
}

export function resetStaleBffSession() {
  forceFirebaseSession();
}

export function forceFirebaseSession() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage?.removeItem(QUOTA_SESSION_KEY);
    window.localStorage?.removeItem('auron-acting-as-uid');
    window.dispatchEvent(new CustomEvent('auron-bff-mode'));
  } catch {
    /* ignore */
  }
}

export function isBffDataMode() {
  return postgresMode();
}

export function isBffChatMode() {
  return postgresMode();
}

export function isBffTradeMode() {
  return true;
}

export function isFirebaseFirstMode() {
  return !postgresMode();
}

export function isBffLeaderboardMode() {
  return postgresMode();
}

export function activateBffQuotaFallback() {
  /* Postgres mode — no Firestore quota fallback */
}
