/** AuronX platform manager — leaderboard badge (Yash Gore). */
export const PLATFORM_MANAGER_EMAIL = 'atharvagore24877@gmail.com';
export const PLATFORM_MANAGER_DISPLAY_NAME = 'Yash Gore';

export function isPlatformManagerRow(row) {
  if (!row) return false;
  const email = String(row.email || '').trim().toLowerCase();
  if (email && email === PLATFORM_MANAGER_EMAIL) return true;
  const name = String(row.name || row.displayName || '').trim().toLowerCase();
  if (name === 'yash gore') return true;
  if (name.includes('yash') && name.includes('gore')) return true;
  return false;
}
