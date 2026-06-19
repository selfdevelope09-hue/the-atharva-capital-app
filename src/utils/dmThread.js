import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { isBffChatMode } from '../config/dataBackend';
import { bff } from '../api/serverBff';

export const dmChannelId = (uidA, uidB) => {
  const [x, y] = [uidA, uidB].sort();
  return `${x}__${y}`;
};

export function firestoreTsMs(t) {
  if (t == null) return 0;
  if (typeof t?.toMillis === 'function') return t.toMillis();
  if (typeof t === 'number' && Number.isFinite(t)) return t;
  if (typeof t === 'string') {
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof t?.seconds === 'number') return t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6);
  return 0;
}

export async function ensureDmThread(meUid, otherUid, meName, otherName, chatOpts = {}) {
  if (isBffChatMode()) {
    const body = { otherUid, meName, otherName };
    if (chatOpts.asUid) body.asUid = chatOpts.asUid;
    await bff('/api/chat/ensure', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return dmChannelId(meUid, otherUid);
  }
  const id = dmChannelId(meUid, otherUid);
  const ref = doc(db, 'dmThreads', id);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? snap.data() : {};
  const prevNames = prev.names || {};
  const unreadByUser = { ...(prev.unreadByUser || {}) };
  unreadByUser[meUid] = unreadByUser[meUid] ?? 0;
  unreadByUser[otherUid] = unreadByUser[otherUid] ?? 0;
  const lastSeenAt = { ...(prev.lastSeenAt || {}) };
  await setDoc(
    ref,
    {
      participants: [meUid, otherUid].sort(),
      names: {
        ...prevNames,
        [meUid]: meName || 'Trader',
        [otherUid]: otherName || 'Trader'
      },
      unreadByUser,
      lastSeenAt,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  return id;
}
