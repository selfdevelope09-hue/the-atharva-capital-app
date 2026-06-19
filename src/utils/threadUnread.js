/** Unread count for a participant — handles string/number JSON keys from Postgres. */
export function threadUnreadForUid(thread, uid) {
  if (!thread || !uid) return 0;
  const map = thread.unreadByUser || thread.unread_by_user || {};
  const raw = map[uid] ?? map[String(uid)];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Only count unread when the latest message in the thread was sent by someone else. */
export function effectiveUnreadForUid(thread, uid) {
  const n = threadUnreadForUid(thread, uid);
  if (n <= 0 || !uid) return 0;
  const lastFrom =
    thread.lastFromUid ||
    thread.last_from_uid ||
    '';
  if (lastFrom && String(lastFrom) === String(uid)) return 0;
  return n;
}

export function sumDmUnread(threads, uid) {
  if (!uid || !Array.isArray(threads)) return 0;
  return threads.reduce((s, t) => s + effectiveUnreadForUid(t, uid), 0);
}
