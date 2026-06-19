/**
 * Project policy: production uses Firebase (Firestore + Auth + Storage) only.
 * Set USE_FIREBASE_ONLY=false on Vercel only if you intentionally re-enable Supabase APIs.
 */
function useFirebaseOnly() {
  const raw = process.env.USE_FIREBASE_ONLY;
  if (raw === undefined || raw === '') return false;
  const v = String(raw).toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes';
}

module.exports = { useFirebaseOnly };
