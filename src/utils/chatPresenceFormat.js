import { firestoreTsMs } from './dmThread';

const DAY_MS = 24 * 60 * 60 * 1000;

/** WhatsApp-style: today 11pm, yesterday 5pm, 30 May 4pm */
export function formatChatClock(d) {
  const h = d.getHours();
  const m = d.getMinutes();
  const hour12 = h % 12 || 12;
  const ampm = h >= 12 ? 'pm' : 'am';
  if (m === 0) return `${hour12}${ampm}`;
  return `${hour12}:${String(m).padStart(2, '0')}${ampm}`;
}

export function formatLastSeenLabel(lastSeenMs) {
  const ms = typeof lastSeenMs === 'object' ? firestoreTsMs(lastSeenMs) : Number(lastSeenMs);
  if (!ms || !Number.isFinite(ms)) return 'last seen unavailable';

  const seenDate = new Date(ms);
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(seenDate)) / DAY_MS);
  const clock = formatChatClock(seenDate);

  if (diffDays === 0) return `today ${clock}`;
  if (diffDays === 1) return `yesterday ${clock}`;
  if (seenDate.getFullYear() === now.getFullYear()) {
    const datePart = seenDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return `${datePart} ${clock}`;
  }
  const datePart = seenDate.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  return `${datePart} ${clock}`;
}

export function formatPresenceFromMs(lastSeenMs, onlineRecentMs = 2.5 * 60 * 1000) {
  const ms = Number(lastSeenMs) || 0;
  if (!ms) return { online: false, label: 'last seen unavailable' };
  const diff = Date.now() - ms;
  if (diff <= onlineRecentMs) return { online: true, label: 'online' };
  return { online: false, label: formatLastSeenLabel(ms) };
}
