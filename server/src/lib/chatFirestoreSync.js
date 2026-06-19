const { initFirebase } = require('./firebaseAdmin');
const { getPool } = require('../db/pool');

function tsToIso(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  if (typeof v.seconds === 'number') {
    return new Date(v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6)).toISOString();
  }
  return null;
}

function threadFromFirestore(id, d) {
  const participants = Array.isArray(d.participants) ? d.participants.map(String) : [];
  return {
    id,
    participants,
    names: d.names && typeof d.names === 'object' ? d.names : {},
    unread_by_user: d.unreadByUser && typeof d.unreadByUser === 'object' ? d.unreadByUser : {},
    last_seen_at: d.lastSeenAt && typeof d.lastSeenAt === 'object' ? d.lastSeenAt : {},
    typing_by_user: d.typingByUser && typeof d.typingByUser === 'object' ? d.typingByUser : {},
    last_preview: String(d.lastPreview || d.last_preview || ''),
    last_from_name: String(d.lastFromName || d.last_from_name || ''),
    last_from_uid: String(d.lastFromUid || d.last_from_uid || ''),
    updated_at: tsToIso(d.updatedAt || d.updated_at) || new Date().toISOString()
  };
}

function messageFromFirestore(threadId, id, d) {
  return {
    id,
    thread_id: threadId,
    from_uid: String(d.fromUid || d.from_uid || ''),
    from_name: String(d.fromName || d.from_name || 'Trader'),
    text: String(d.text || ''),
    image_url: d.imageUrl ? String(d.imageUrl) : d.image_url ? String(d.image_url) : null,
    file_url: d.fileUrl ? String(d.fileUrl) : d.file_url ? String(d.file_url) : null,
    file_name: d.fileName ? String(d.fileName) : d.file_name ? String(d.file_name) : null,
    media_kind: d.mediaKind ? String(d.mediaKind) : d.media_kind ? String(d.media_kind) : null,
    reply_to: d.replyTo && typeof d.replyTo === 'object' ? JSON.stringify(d.replyTo) : null,
    created_at: tsToIso(d.createdAt || d.created_at) || new Date().toISOString()
  };
}

/** Firestore import must not restore stale unread — Postgres is source of truth for read state. */
function mergeUnreadFromExisting(row, existing) {
  if (!existing) return row;
  const prevUnread =
    existing.unread_by_user && typeof existing.unread_by_user === 'object' ? existing.unread_by_user : {};
  const prevSeen =
    existing.last_seen_at && typeof existing.last_seen_at === 'object' ? existing.last_seen_at : {};
  row.unread_by_user = { ...prevUnread };
  row.last_seen_at = { ...(row.last_seen_at || {}), ...prevSeen };
  return row;
}

async function upsertDmThread(pg, row) {
  const { rows: existingRows } = await pg.query(
    `select unread_by_user, last_seen_at from dm_threads where id = $1`,
    [row.id]
  );
  mergeUnreadFromExisting(row, existingRows[0]);
  await pg.query(
    `insert into dm_threads (
      id, participants, names, unread_by_user, last_seen_at, typing_by_user,
      last_preview, last_from_name, updated_at
    ) values ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8,$9::timestamptz)
    on conflict (id) do update set
      participants=excluded.participants,
      names=dm_threads.names || excluded.names,
      unread_by_user=excluded.unread_by_user,
      last_seen_at=excluded.last_seen_at,
      typing_by_user=excluded.typing_by_user,
      last_preview=case when excluded.last_preview <> '' then excluded.last_preview else dm_threads.last_preview end,
      last_from_name=case when excluded.last_from_name <> '' then excluded.last_from_name else dm_threads.last_from_name end,
      updated_at=greatest(dm_threads.updated_at, excluded.updated_at)`,
    [
      row.id,
      row.participants,
      JSON.stringify(row.names),
      JSON.stringify(row.unread_by_user),
      JSON.stringify(row.last_seen_at),
      JSON.stringify(row.typing_by_user),
      row.last_preview,
      row.last_from_name,
      row.updated_at
    ]
  );
}

async function upsertDmMessage(pg, row) {
  await pg.query(
    `insert into dm_messages (id, thread_id, from_uid, from_name, text, image_url, file_url, file_name, media_kind, reply_to, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::timestamptz)
     on conflict (id) do nothing`,
    [
      row.id,
      row.thread_id,
      row.from_uid,
      row.from_name,
      row.text,
      row.image_url,
      row.file_url,
      row.file_name,
      row.media_kind,
      row.reply_to,
      row.created_at
    ]
  );
}

/**
 * Import Firestore dmThreads + messages for one user into Postgres (idempotent).
 * @returns {Promise<{ threads: number, messages: number }>}
 */
async function syncUserChatFromFirestore(uid) {
  if (!uid) return { threads: 0, messages: 0 };
  const db = initFirebase().firestore();
  const pg = getPool();
  const snap = await db.collection('dmThreads').where('participants', 'array-contains', uid).get();
  if (snap.empty) return { threads: 0, messages: 0 };

  let threadCount = 0;
  let messageCount = 0;

  for (const doc of snap.docs) {
    const row = threadFromFirestore(doc.id, doc.data() || {});
    if (!row.participants.includes(uid)) continue;
    await upsertDmThread(pg, row);
    threadCount += 1;

    const msgSnap = await db
      .collection('dmThreads')
      .doc(doc.id)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .limit(500)
      .get()
      .catch(async () => {
        const fallback = await db.collection('dmThreads').doc(doc.id).collection('messages').limit(500).get();
        return fallback;
      });

    for (const m of msgSnap.docs) {
      await upsertDmMessage(pg, messageFromFirestore(doc.id, m.id, m.data() || {}));
      messageCount += 1;
    }
  }

  return { threads: threadCount, messages: messageCount };
}

module.exports = { syncUserChatFromFirestore };
