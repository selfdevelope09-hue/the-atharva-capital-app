import { firestoreTsMs } from './dmThread';
import { formatLastSeenLabel } from './chatPresenceFormat';
import { REMOVED_USER_LABEL, isAccountRemoved } from './removedUserDisplay';

/** Showcase traders: admin toggle is source of truth (not lastSeen recency). */
export function isShowcaseUid(uid) {
  return String(uid || '').startsWith('showcase__');
}

export function parseShowcasePresenceFields(data) {
  if (!data || typeof data !== 'object') {
    return {
      showcasePresenceOnline: false,
      showcasePresenceExplicitOffline: false,
      showcasePresenceOfflineAt: null
    };
  }
  const forcedOn = data.showcasePresenceOnline === true || data.showcase_presence_online === true;
  const forcedOff =
    data.showcasePresenceExplicitOffline === true ||
    data.showcasePresenceOnline === false ||
    data.showcase_presence_online === false;
  return {
    showcasePresenceOnline: forcedOn,
    showcasePresenceExplicitOffline: forcedOff && !forcedOn,
    showcasePresenceOfflineAt: data.showcasePresenceOfflineAt ?? data.showcase_presence_offline_at ?? null
  };
}

/** Admin “Online” / “Offline” for showcase__* profiles. */
export function isShowcasePresenceOnline(data) {
  const f = parseShowcasePresenceFields(data);
  if (f.showcasePresenceOnline) return true;
  if (f.showcasePresenceExplicitOffline) return false;
  return false;
}

/** Last-seen ms for chat list labels when offline (not used for online boolean). */
export function showcasePresenceLastSeenMs(data) {
  const f = parseShowcasePresenceFields(data);
  if (f.showcasePresenceOnline) return Date.now();
  const off = firestoreTsMs(f.showcasePresenceOfflineAt);
  if (off > 0) return off;
  if (f.showcasePresenceExplicitOffline) return Date.now() - 10 * 60 * 1000;
  return 0;
}

/** Chat / thread row presence label. */
export function formatShowcasePeerPresence(peerMapEntry) {
  if (!peerMapEntry) return { online: false, label: 'offline' };
  if (peerMapEntry.showcaseForcedOnline === true) {
    return { online: true, label: 'online' };
  }
  if (peerMapEntry.showcasePresenceExplicitOffline === true) {
    const off = Number(peerMapEntry.showcaseLastSeenMs) || 0;
    if (off > 0) {
      return { online: false, label: formatLastSeenLabel(off) };
    }
    return { online: false, label: 'offline' };
  }
  return { online: false, label: 'offline' };
}

/** Build peerPresence map entry from Firestore users/ doc. */
export function peerPresenceFromUserDoc(uid, d) {
  const isShowcase = isShowcaseUid(uid);
  const lastSeenMs = firestoreTsMs(d?.lastSeenAt);
  const isPaid =
    d?.isPaidMember === true || d?.is_paid_member === true;
  const accountRemoved = isAccountRemoved(d);
  const profileName = accountRemoved ? REMOVED_USER_LABEL : d?.name || '';
  if (!isShowcase) {
    return {
      lastSeenMs,
      photoURL: accountRemoved ? '' : d?.photoURL || '',
      profileName,
      isPaidMember: accountRemoved ? false : isPaid,
      paidPlanType: accountRemoved ? null : d?.paidPlanType ?? d?.paid_plan_type ?? null,
      accountRemoved
    };
  }
  const fields = parseShowcasePresenceFields(d);
  const offMs = firestoreTsMs(fields.showcasePresenceOfflineAt);
  return {
    lastSeenMs,
    showcaseForcedOnline: fields.showcasePresenceOnline,
    showcasePresenceExplicitOffline: fields.showcasePresenceExplicitOffline,
    showcaseLastSeenMs:
      offMs > 0 ? offMs : fields.showcasePresenceExplicitOffline ? showcasePresenceLastSeenMs(d) : lastSeenMs,
    photoURL: accountRemoved ? '' : d?.photoURL || '',
    profileName,
    isPaidMember: accountRemoved ? false : isPaid,
    paidPlanType: accountRemoved ? null : d?.paidPlanType ?? d?.paid_plan_type ?? null,
    accountRemoved
  };
}
