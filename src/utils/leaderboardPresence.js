import { firestoreTsMs } from './dmThread';
import { isShowcasePresenceOnline, isShowcaseUid, parseShowcasePresenceFields } from './showcasePresence';

/** Same window as chat list: recent lastSeen counts as online (real users only). */
const ONLINE_RECENT_MS = 2.5 * 60 * 1000;
/** When presenceOnline is true, allow slightly stale lastSeen (missed heartbeat / background tab). */
const ONLINE_PRESENCE_GRACE_MS = 6 * 60 * 1000;

function presenceFieldsFromRow(row) {
  if (!row || typeof row !== 'object') return {};
  const showcase = parseShowcasePresenceFields(row);
  return {
    lastSeenAt: row.lastSeenAt ?? row.last_seen_at ?? null,
    presenceOnline: row.presenceOnline === true || row.presence_online === true,
    ...showcase
  };
}

/** Merge live presence snapshot (Firestore poll / users-bulk) onto a leaderboard row. */
export function mergeLeaderboardRowPresence(row, patch) {
  if (!row) return row;
  if (!patch || typeof patch !== 'object') return row;
  return { ...row, ...presenceFieldsFromRow(row), ...presenceFieldsFromRow(patch) };
}

export function isLeaderboardRowPresenceOnline(row, nowMs = Date.now()) {
  if (!row) return false;
  const uid = String(row.id || row.uid || '');
  if (isShowcaseUid(uid)) {
    return isShowcasePresenceOnline(row);
  }

  const fields = presenceFieldsFromRow(row);
  const lastSeen = firestoreTsMs(fields.lastSeenAt);
  if (lastSeen > 0 && nowMs - lastSeen <= ONLINE_RECENT_MS) return true;
  if (fields.presenceOnline === true && lastSeen > 0 && nowMs - lastSeen <= ONLINE_PRESENCE_GRACE_MS) {
    return true;
  }
  return false;
}

export function leaderboardPresenceTitle(row, nowMs = Date.now()) {
  return isLeaderboardRowPresenceOnline(row, nowMs) ? 'Online' : 'Offline';
}

export function countLeaderboardRowsOnline(rows, nowMs = Date.now()) {
  if (!Array.isArray(rows) || !rows.length) return 0;
  let n = 0;
  for (const row of rows) {
    if (isLeaderboardRowPresenceOnline(row, nowMs)) n += 1;
  }
  return n;
}

/** Fields to store in presenceByUid map from Firestore / BFF user row. */
export function presencePatchFromUserDoc(data) {
  if (!data || typeof data !== 'object') return null;
  return presenceFieldsFromRow(data);
}

/** Patch from leaderboardShowcase row (keeps profile_uid in sync). */
export function presencePatchFromShowcaseRow(row) {
  if (!row || typeof row !== 'object') return null;
  return presenceFieldsFromRow(row);
}
