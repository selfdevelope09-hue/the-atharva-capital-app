/**
 * One-way migration: Firebase Auth project Firestore `users` collection → Supabase `public.users`.
 *
 * Prerequisites:
 *   - FIREBASE_SERVICE_ACCOUNT_JSON (same as Vercel api routes)
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/migrate-firestore-users-to-supabase.js
 *   node scripts/migrate-firestore-users-to-supabase.js --dry-run
 *   node scripts/migrate-firestore-users-to-supabase.js --limit=500
 *   node scripts/migrate-firestore-users-to-supabase.js --uids=uid1,uid2
 *
 * Idempotent: upserts on uid (overwrites Supabase row with Firestore data).
 */

const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

function parseArgs() {
  const out = { dryRun: false, limit: null, uids: null };
  for (const a of process.argv.slice(2)) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--limit=')) out.limit = Math.max(1, parseInt(a.split('=')[1], 10) || 0);
    else if (a.startsWith('--uids=')) out.uids = a.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean);
  }
  return out;
}

function toUidList(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'object') return Object.keys(v).filter((k) => k && !String(k).startsWith('__'));
  return [];
}

function tsToIso(v) {
  if (v == null) return null;
  if (typeof v?.toDate === 'function') {
    try {
      const d = v.toDate();
      return Number.isFinite(d.getTime()) ? d.toISOString() : null;
    } catch {
      return null;
    }
  }
  if (typeof v?.seconds === 'number') {
    return new Date(v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6)).toISOString();
  }
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  return null;
}

function asJsonbArray(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'object') return Object.values(v);
  return [];
}

function firestoreUserToRow(id, d) {
  const followers = toUidList(d.followers);
  const following = toUidList(d.following);
  const watchlist = Array.isArray(d.watchlist) ? d.watchlist.map(String) : toUidList(d.watchlist);

  const virtualBalance = Number(d.virtualBalance);
  const lifetimeRealizedPnl = Number(d.lifetimeRealizedPnl);

  return {
    uid: id,
    email: d.email != null ? String(d.email) : null,
    name: String(d.name || 'Trader').slice(0, 500) || 'Trader',
    photo_url: String(d.photoURL || '').slice(0, 500000),
    bio: String(d.bio || '').slice(0, 2000),
    virtual_balance: Number.isFinite(virtualBalance) ? virtualBalance : 10000,
    lifetime_realized_pnl: Number.isFinite(lifetimeRealizedPnl) ? lifetimeRealizedPnl : 0,
    followers,
    following,
    watchlist,
    presence_online: !!d.presenceOnline,
    last_seen_at: tsToIso(d.lastSeenAt),
    positions: asJsonbArray(d.positions),
    closed_positions: asJsonbArray(d.closedPositions),
    portfolio: asJsonbArray(d.portfolio),
    last_processed_reset_payment_id: d.lastProcessedResetPaymentId
      ? String(d.lastProcessedResetPaymentId)
      : null,
    reset_at: d.resetAt ? tsToIso(d.resetAt) || (typeof d.resetAt === 'string' ? d.resetAt : null) : null,
    daily_trades_date: d.dailyTradesDate != null ? String(d.dailyTradesDate).slice(0, 10) : null,
    daily_trades_count: Math.max(0, Math.min(99, parseInt(d.dailyTradesCount, 10) || 0)),
    daily_ad_trade_bonus: Math.max(0, Math.min(9, parseInt(d.dailyAdTradeBonus, 10) || 0))
  };
}

async function main() {
  const args = parseArgs();
  const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const supUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const supKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawSa) {
    console.error('Missing FIREBASE_SERVICE_ACCOUNT_JSON');
    process.exit(1);
  }
  if (!supUrl || !supKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(rawSa)) });
  }
  const db = admin.firestore();
  const supa = createClient(supUrl, supKey, { auth: { persistSession: false } });

  let processed = 0;
  const batchSize = 200;
  const rowsBuffer = [];

  const flush = async () => {
    if (!rowsBuffer.length) return;
    const chunk = rowsBuffer.splice(0, rowsBuffer.length);
    if (args.dryRun) {
      console.log(`[dry-run] would upsert ${chunk.length} rows (sample uids: ${chunk.slice(0, 3).map((r) => r.uid).join(', ')})`);
      return;
    }
    const { error } = await supa.from('users').upsert(chunk, { onConflict: 'uid' });
    if (error) {
      console.error('Supabase upsert error:', error.message, error.details || '');
      process.exit(1);
    }
    console.log(`Upserted ${chunk.length} users (total ${processed})`);
  };

  if (args.uids?.length) {
    for (const uid of args.uids) {
      const snap = await db.collection('users').doc(uid).get();
      if (!snap.exists) {
        console.warn(`Skip missing Firestore user: ${uid}`);
        continue;
      }
      rowsBuffer.push(firestoreUserToRow(snap.id, snap.data() || {}));
      processed += 1;
      if (args.limit && processed >= args.limit) break;
      if (rowsBuffer.length >= batchSize) await flush();
    }
    await flush();
    console.log(`Done. Migrated ${processed} user(s).`);
    return;
  }

  let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize);
  let lastDoc = null;

  for (;;) {
    const snap = lastDoc ? await q.startAfter(lastDoc).get() : await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      rowsBuffer.push(firestoreUserToRow(doc.id, doc.data() || {}));
      processed += 1;
      if (args.limit && processed >= args.limit) {
        await flush();
        console.log(`Done (limit). Migrated ${processed} user(s).`);
        return;
      }
      if (rowsBuffer.length >= batchSize) await flush();
    }
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < batchSize) break;
  }

  await flush();
  console.log(`Done. Migrated ${processed} user(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
