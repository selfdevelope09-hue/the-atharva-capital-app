/** Firebase Firestore Spark / free tier — daily read/write exhaustion. */
export function isFirestoreQuotaError(err) {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === 'resource-exhausted' ||
    /resource-exhausted|quota exceeded|quota_exceeded|limit exceeded|too many requests/i.test(msg)
  );
}

/**
 * Only switch to Supabase (BFF) on real Firestore quota / resource exhaustion.
 * Other errors (rules, network blips, permission) should not silently move users off Firebase.
 */
export function shouldFallbackFromFirestoreToSupabase(err) {
  if (!err) return false;
  return isFirestoreQuotaError(err);
}
