import { PRIMARY_STOCK_TIP_OWNER_UID } from '../stockTips/tipEditorUid';

/** AuronX platform owner — leaderboard badge + payout chat routing. */
export const PLATFORM_OWNER_UID = PRIMARY_STOCK_TIP_OWNER_UID;
export const PLATFORM_OWNER_EMAIL = 'atharvadarshanwar09@gmail.com';
export const PLATFORM_OWNER_DISPLAY_NAME = 'Atharva Darshanwar';

export function isPlatformOwnerRow(row) {
  if (!row) return false;
  const uid = String(row.uid || row.id || '').trim();
  if (uid && uid === PLATFORM_OWNER_UID) return true;
  const email = String(row.email || '').trim().toLowerCase();
  if (email && email === PLATFORM_OWNER_EMAIL) return true;
  const name = String(row.name || row.displayName || '').trim().toLowerCase();
  if (name && name.includes('atharva') && name.includes('darshanwar')) return true;
  return false;
}

export function platformOwnerChatPath() {
  return `/chat?with=${encodeURIComponent(PLATFORM_OWNER_UID)}`;
}
