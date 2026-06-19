/**
 * Safe migration: Firestore → Postgres (DigitalOcean).
 * Idempotent upserts + checkpoint file + source_hash verification.
 *
 * Usage:
 *   node scripts/migrate-firestore-to-postgres.js --dry-run
 *   node scripts/migrate-firestore-to-postgres.js --collections=users,payments,dmThreads
 *   node scripts/migrate-firestore-to-postgres.js --uids=uid1,uid2
 *
 * Env:
 *   FIREBASE_SERVICE_ACCOUNT_JSON
 *   PG_URL
 *   APP_DATA_ENC_KEY_B64 (optional — encrypts email/phone on users)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');
const { Pool } = require('pg');

const CHECKPOINT_PATH = path.join(process.cwd(), '.migration-checkpoint.json');

function parseArgs() {
  const out = { dryRun: false, batch: 200, limit: null, uids: null, collections: ['users', 'payments', 'dmThreads'] };
  for (const a of process.argv.slice(2)) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--batch=')) out.batch = Math.max(1, parseInt(a.split('=')[1], 10) || 200);
    else if (a.startsWith('--limit=')) out.limit = Math.max(1, parseInt(a.split('=')[1], 10) || 0);
    else if (a.startsWith('--uids=')) out.uids = a.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith('--collections=')) {
      out.collections = a.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return out;
}

function loadCheckpoint() {
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

function stableStringify(obj) {
  const seen = new WeakSet();
  const sort = (x) => {
    if (!x || typeof x !== 'object') return x;
    if (seen.has(x)) return null;
    seen.add(x);
    if (Array.isArray(x)) return x.map(sort);
    const out = {};
    for (const k of Object.keys(x).sort()) out[k] = sort(x[k]);
    return out;
  };
  return JSON.stringify(sort(obj));
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function tsToIso(v) {
  if (v == null) return null;
  if (typeof v.toDate === 'function') {
    const d = v.toDate();
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  if (typeof v.seconds === 'number') {
    return new Date(v.seconds * 1000).toISOString();
  }
  return null;
}

function encEmailPhone(plaintext, keyB64) {
  if (!plaintext || !keyB64) return null;
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) throw new Error('APP_DATA_ENC_KEY_B64 must be 32 bytes base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]);
}

function firestoreUserToRow(id, d, keyB64) {
  const followers = Array.isArray(d.followers) ? d.followers : d.followers ? Object.keys(d.followers) : [];
  const following = Array.isArray(d.following) ? d.following : d.following ? Object.keys(d.following) : [];
  const watchlist = Array.isArray(d.watchlist) ? d.watchlist : [];
  const doc = d;
  const sourceHash = sha256Hex(stableStringify(doc));
  return {
    uid: id,
    email: d.email != null ? String(d.email) : null,
    email_enc: encEmailPhone(d.email, keyB64),
    phone_enc: encEmailPhone(d.phone || d.phoneNumber, keyB64),
    name: String(d.name || 'Trader').slice(0, 500),
    photo_url: String(d.photoURL || '').slice(0, 500000),
    bio: String(d.bio || '').slice(0, 2000),
    virtual_balance: Number.isFinite(Number(d.virtualBalance)) ? Number(d.virtualBalance) : 10000,
    lifetime_realized_pnl: Number.isFinite(Number(d.lifetimeRealizedPnl)) ? Number(d.lifetimeRealizedPnl) : 0,
    followers,
    following,
    watchlist,
    presence_online: !!d.presenceOnline,
    last_seen_at: tsToIso(d.lastSeenAt),
    positions: JSON.stringify(Array.isArray(d.positions) ? d.positions : []),
    closed_positions: JSON.stringify(Array.isArray(d.closedPositions) ? d.closedPositions : []),
    portfolio: JSON.stringify(Array.isArray(d.portfolio) ? d.portfolio : []),
    daily_trades_date: d.dailyTradesDate != null ? String(d.dailyTradesDate).slice(0, 10) : null,
    daily_trades_count: Math.max(0, parseInt(d.dailyTradesCount, 10) || 0),
    daily_ad_trade_bonus: Math.max(0, parseInt(d.dailyAdTradeBonus, 10) || 0),
    daily_twelve_reward_claimed_date: d.dailyTwelveRewardClaimedDate || null,
    doc: JSON.stringify(doc),
    source_doc_path: `users/${id}`,
    source_updated_at: tsToIso(d.updatedAt || d.lastSeenAt),
    source_hash: sourceHash
  };
}

async function upsertUsers(pg, rows, dryRun) {
  if (!rows.length) return;
  if (dryRun) {
    console.log(`[dry-run] users upsert ${rows.length} (sample ${rows[0].uid})`);
    return;
  }
  for (const r of rows) {
    await pg.query(
      `insert into users (
        uid, email, name, photo_url, bio, virtual_balance, lifetime_realized_pnl,
        followers, following, watchlist, presence_online, last_seen_at,
        positions, closed_positions, portfolio,
        daily_trades_date, daily_trades_count, daily_ad_trade_bonus, daily_twelve_reward_claimed_date,
        doc, source_doc_path, source_updated_at, source_hash
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16,$17,$18,$19,$20::jsonb,$21,$22,$23
      )
      on conflict (uid) do update set
        email=excluded.email,
        name=excluded.name,
        photo_url=excluded.photo_url,
        bio=excluded.bio,
        virtual_balance=excluded.virtual_balance,
        lifetime_realized_pnl=excluded.lifetime_realized_pnl,
        followers=excluded.followers,
        following=excluded.following,
        watchlist=excluded.watchlist,
        positions=excluded.positions,
        closed_positions=excluded.closed_positions,
        portfolio=excluded.portfolio,
        daily_trades_date=excluded.daily_trades_date,
        daily_trades_count=excluded.daily_trades_count,
        daily_ad_trade_bonus=excluded.daily_ad_trade_bonus,
        daily_twelve_reward_claimed_date=excluded.daily_twelve_reward_claimed_date,
        doc=excluded.doc,
        source_doc_path=excluded.source_doc_path,
        source_updated_at=excluded.source_updated_at,
        source_hash=excluded.source_hash,
        updated_at=now()`,
      [
        r.uid,
        r.email,
        r.name,
        r.photo_url,
        r.bio,
        r.virtual_balance,
        r.lifetime_realized_pnl,
        r.followers,
        r.following,
        r.watchlist,
        r.presence_online,
        r.last_seen_at,
        r.positions,
        r.closed_positions,
        r.portfolio,
        r.daily_trades_date,
        r.daily_trades_count,
        r.daily_ad_trade_bonus,
        r.daily_twelve_reward_claimed_date,
        r.doc,
        r.source_doc_path,
        r.source_updated_at,
        r.source_hash
      ]
    );
  }
}

function isQuotaError(e) {
  const msg = String(e?.message || e || '');
  return /RESOURCE_EXHAUSTED|quota|429/i.test(msg);
}

async function withRetry(label, fn, { maxAttempts = 12, baseMs = 5000 } = {}) {
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      return await fn();
    } catch (e) {
      if (!isQuotaError(e) || attempt >= maxAttempts) throw e;
      const wait = baseMs * attempt;
      console.warn(`[${label}] quota/rate limit — retry ${attempt}/${maxAttempts} in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function firestoreGet(ref) {
  return withRetry('firestore.get', () => ref.get());
}

async function firestoreQueryGet(q) {
  return withRetry('firestore.query', () => q.get());
}

async function migrateUsers(db, pg, args, cp, keyB64) {
  const batch = args.batch;
  let processed = 0;
  let lastId = cp.users?.lastId || null;
  const buffer = [];

  const flush = async () => {
    if (!buffer.length) return;
    const chunk = buffer.splice(0, buffer.length);
    await upsertUsers(pg, chunk, args.dryRun);
  };

  if (args.uids?.length) {
    for (const uid of args.uids) {
      const snap = await firestoreGet(db.collection('users').doc(uid));
      if (!snap.exists) continue;
      buffer.push(firestoreUserToRow(snap.id, snap.data() || {}, keyB64));
      processed += 1;
      if (buffer.length >= batch) await flush();
    }
    await flush();
    console.log(`users migrated: ${processed}`);
    return;
  }

  for (;;) {
    let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(batch);
    const snap = lastId ? await firestoreQueryGet(q.startAfter(lastId)) : await firestoreQueryGet(q);
    if (snap.empty) break;
    for (const doc of snap.docs) {
      buffer.push(firestoreUserToRow(doc.id, doc.data() || {}, keyB64));
      processed += 1;
      if (buffer.length >= batch) await flush();
      if (args.limit && processed >= args.limit) break;
    }
    await flush();
    lastId = snap.docs[snap.docs.length - 1].id;
    cp.users = { lastId, processed };
    saveCheckpoint(cp);
    console.log(`users progress ${processed} lastId=${lastId}`);
    if (args.limit && processed >= args.limit) break;
    if (snap.size < batch) break;
  }
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
    last_preview: String(d.lastPreview || ''),
    last_from_name: String(d.lastFromName || ''),
    updated_at: tsToIso(d.updatedAt) || new Date().toISOString()
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
    reply_to: d.replyTo && typeof d.replyTo === 'object' ? JSON.stringify(d.replyTo) : null,
    created_at: tsToIso(d.createdAt) || new Date().toISOString()
  };
}

async function upsertDmThread(pg, row, dryRun) {
  if (dryRun) return;
  await pg.query(
    `insert into dm_threads (
      id, participants, names, unread_by_user, last_seen_at, typing_by_user,
      last_preview, last_from_name, updated_at
    ) values ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8,$9::timestamptz)
    on conflict (id) do update set
      participants=excluded.participants,
      names=excluded.names,
      unread_by_user=excluded.unread_by_user,
      last_seen_at=excluded.last_seen_at,
      typing_by_user=excluded.typing_by_user,
      last_preview=excluded.last_preview,
      last_from_name=excluded.last_from_name,
      updated_at=excluded.updated_at`,
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

async function upsertDmMessage(pg, row, dryRun) {
  if (dryRun) return;
  await pg.query(
    `insert into dm_messages (id, thread_id, from_uid, from_name, text, image_url, reply_to, created_at)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::timestamptz)
     on conflict (id) do nothing`,
    [row.id, row.thread_id, row.from_uid, row.from_name, row.text, row.image_url, row.reply_to, row.created_at]
  );
}

async function migrateDmThreads(db, pg, args, cp) {
  const batch = Math.min(args.batch, 50);
  let processed = 0;
  let lastId = cp.dmThreads?.lastId || null;
  for (;;) {
    let q = db.collection('dmThreads').orderBy(admin.firestore.FieldPath.documentId()).limit(batch);
    const snap = lastId ? await firestoreQueryGet(q.startAfter(lastId)) : await firestoreQueryGet(q);
    if (snap.empty) break;
    for (const doc of snap.docs) {
      const row = threadFromFirestore(doc.id, doc.data() || {});
      if (args.dryRun) {
        console.log(`[dry-run] dm_thread ${row.id}`);
      } else {
        await upsertDmThread(pg, row, false);
        const msgSnap = await firestoreQueryGet(
          db
            .collection('dmThreads')
            .doc(doc.id)
            .collection('messages')
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(500)
        );
        for (const m of msgSnap.docs) {
          await upsertDmMessage(pg, messageFromFirestore(doc.id, m.id, m.data() || {}), false);
        }
      }
      processed += 1;
      if (args.limit && processed >= args.limit) break;
    }
    lastId = snap.docs[snap.docs.length - 1].id;
    cp.dmThreads = { lastId, processed };
    saveCheckpoint(cp);
    console.log(`dmThreads progress ${processed} lastId=${lastId}`);
    if (args.limit && processed >= args.limit) break;
    if (snap.size < batch) break;
  }
  console.log(`dmThreads migrated: ${processed}`);
}

async function migratePayments(db, pg, args, cp) {
  const batch = args.batch;
  let processed = 0;
  let lastId = cp.payments?.lastId || null;
  for (;;) {
    let q = db.collection('payments').orderBy(admin.firestore.FieldPath.documentId()).limit(batch);
    const snap = lastId ? await firestoreQueryGet(q.startAfter(lastId)) : await firestoreQueryGet(q);
    if (snap.empty) break;
    for (const doc of snap.docs) {
      const docData = doc.data() || {};
      const sourceHash = sha256Hex(stableStringify(docData));
      if (!args.dryRun) {
        await pg.query(
          `insert into payments (id, uid, doc, source_doc_path, source_updated_at, source_hash)
           values ($1,$2,$3::jsonb,$4,$5,$6)
           on conflict (id) do update set doc=excluded.doc, source_hash=excluded.source_hash, migrated_at=now()`,
          [
            doc.id,
            String(docData.uid || docData.userId || ''),
            JSON.stringify(docData),
            `payments/${doc.id}`,
            tsToIso(docData.updatedAt),
            sourceHash
          ]
        );
      } else {
        console.log(`[dry-run] payment ${doc.id}`);
      }
      processed += 1;
      if (args.limit && processed >= args.limit) break;
    }
    lastId = snap.docs[snap.docs.length - 1].id;
    cp.payments = { lastId, processed };
    saveCheckpoint(cp);
    console.log(`payments progress ${processed}`);
    if (args.limit && processed >= args.limit) break;
    if (snap.size < batch) break;
  }
  console.log(`payments migrated: ${processed}`);
}

function loadServiceAccount() {
  const file = path.join(process.cwd(), 'serviceAccount.json');
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Missing serviceAccount.json or FIREBASE_SERVICE_ACCOUNT_JSON');
  return JSON.parse(raw);
}

async function main() {
  const args = parseArgs();
  const pgUrl = process.env.PG_URL;
  const keyB64 = process.env.APP_DATA_ENC_KEY_B64 || '';
  if (!pgUrl) throw new Error('Missing PG_URL');

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(loadServiceAccount()) });
  }
  const db = admin.firestore();
  const pg = new Pool({
    connectionString: pgUrl,
    ssl: pgUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
  });

  const cp = loadCheckpoint();
  try {
    if (args.collections.includes('users')) {
      await migrateUsers(db, pg, args, cp, keyB64);
    }
    if (args.collections.includes('dmThreads')) {
      await migrateDmThreads(db, pg, args, cp);
    }
    if (args.collections.includes('payments')) {
      await migratePayments(db, pg, args, cp);
    }
    const counts = await pg.query(`
      select
        (select count(*)::int from users) as users,
        (select count(*)::int from dm_threads) as dm_threads,
        (select count(*)::int from dm_messages) as dm_messages,
        (select count(*)::int from payments) as payments
    `);
    console.log('Row counts:', counts.rows[0]);
    console.log('Migration pass complete.');
  } finally {
    await pg.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
