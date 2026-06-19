/**
 * Normalize profile image URLs (Firestore, Google, Firebase Storage).
 */
export function resolveProfilePhotoURL(raw) {
  const fromObj =
    raw && typeof raw === 'object'
      ? raw.photoURL || raw.photo_url || raw.photoUrl || ''
      : raw;
  let u = String(fromObj || '').trim();
  if (!u) return '';
  if (u.startsWith('//')) u = `https:${u}`;
  if (!/^https?:\/\//i.test(u)) return '';

  if (/googleusercontent\.com/i.test(u) || /ggpht\.com/i.test(u)) {
    const base = u.split('?')[0].replace(/=s\d+(-c)?$/i, '');
    return `${base}=s256-c`;
  }
  if (/firebasestorage\.(googleapis\.com|app)/i.test(u) && !u.includes('alt=media')) {
    return u.includes('?') ? `${u}&alt=media` : `${u}?alt=media`;
  }
  return u;
}

/** Profile doc + optional Auth / session userData fallbacks (own profile). */
export function pickProfilePhotoRaw(profile, { user, userData, isSelf } = {}) {
  const fromDoc = profile?.photoURL || profile?.photo_url || profile?.photoUrl || '';
  if (fromDoc) return fromDoc;
  if (!isSelf) return '';
  return userData?.photoURL || userData?.photo_url || user?.photoURL || '';
}

export function resolveProfilePhotoFromUser(profile, opts = {}) {
  return resolveProfilePhotoURL(pickProfilePhotoRaw(profile, opts));
}

/** Google avatars need no-referrer; Firebase Storage works with default. */
export function profilePhotoReferrerPolicy(url) {
  const u = String(url || '');
  if (/googleusercontent\.com|ggpht\.com/i.test(u)) return 'no-referrer';
  return 'no-referrer-when-downgrade';
}
