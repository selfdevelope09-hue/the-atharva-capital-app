/**
 * Migrate developer-panel Firestore collections → Postgres (DigitalOcean).
 *
 *   node scripts/migrate-firestore-admin-to-postgres.js
 *
 * Env: FIREBASE_SERVICE_ACCOUNT_JSON, PG_URL
 */

const admin = require('firebase-admin');
const { Pool } = require('pg');

function initFb() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

function ts(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  return null;
}

async function migrateCollection(db, pg, fsName, table, mapRow) {
  const snap = await db.collection(fsName).get();
  let n = 0;
  for (const doc of snap.docs) {
    const row = mapRow(doc.id, doc.data());
    if (!row) continue;
    await pg.query(row.sql, row.params);
    n += 1;
  }
  console.log(`${fsName} → ${table}: ${n}`);
  return n;
}

async function main() {
  initFb();
  const pg = new Pool({ connectionString: process.env.PG_URL });
  const db = admin.firestore();

  const editors = await db.collection('config').doc('stockTipEditors').get();
  if (editors.exists) {
    await pg.query(
      `insert into platform_config (key, value, updated_at) values ('stockTipEditors', $1::jsonb, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [JSON.stringify(editors.data())]
    );
    console.log('config/stockTipEditors → platform_config');
  }

  const blocked = await db.collection('config').doc('blockedUsers').get();
  if (blocked.exists) {
    await pg.query(
      `insert into platform_config (key, value, updated_at) values ('blockedUsers', $1::jsonb, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [JSON.stringify(blocked.data())]
    );
    console.log('config/blockedUsers → platform_config');
  }

  await migrateCollection(db, pg, 'leaderboardShowcase', 'leaderboard_showcase', (id, d) => ({
    sql: `insert into leaderboard_showcase (
      id, display_name, pnl, trade_count, profile_uid,
      showcase_presence_online, showcase_presence_offline_at, doc, updated_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,coalesce($9,now()))
    on conflict (id) do update set
      display_name=excluded.display_name, pnl=excluded.pnl, trade_count=excluded.trade_count,
      profile_uid=excluded.profile_uid, showcase_presence_online=excluded.showcase_presence_online,
      showcase_presence_offline_at=excluded.showcase_presence_offline_at, doc=excluded.doc, updated_at=now()`,
    params: [
      id,
      String(d.displayName || ''),
      Number(d.pnl) || 0,
      Number(d.tradeCount) || 12,
      String(d.profile_uid || `showcase__${id}`),
      d.showcasePresenceOnline === true,
      ts(d.showcasePresenceOfflineAt),
      JSON.stringify(d),
      ts(d.updated_at)
    ]
  }));

  const showcaseUsers = await db.collection('users').where('uid', '>=', 'showcase__').get().catch(() => null);
  if (!showcaseUsers) {
    const all = await db.collection('users').get();
    let su = 0;
    for (const doc of all.docs) {
      if (!doc.id.startsWith('showcase__')) continue;
      const d = doc.data();
      await pg.query(
        `insert into users (uid, name, photo_url, bio, virtual_balance, lifetime_realized_pnl,
          closed_positions, is_showcase_profile, showcase_presence_online, showcase_presence_offline_at,
          showcase_trade_count, doc, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb,true,$8,$9,$10,$11::jsonb,now())
         on conflict (uid) do update set
           name=excluded.name, photo_url=excluded.photo_url, bio=excluded.bio,
           virtual_balance=excluded.virtual_balance, lifetime_realized_pnl=excluded.lifetime_realized_pnl,
           closed_positions=excluded.closed_positions, is_showcase_profile=true,
           showcase_presence_online=excluded.showcase_presence_online,
           showcase_presence_offline_at=excluded.showcase_presence_offline_at,
           showcase_trade_count=excluded.showcase_trade_count, doc=excluded.doc, updated_at=now()`,
        [
          doc.id,
          String(d.name || 'Trader'),
          String(d.photoURL || ''),
          String(d.bio || ''),
          Number(d.virtualBalance) || 10000,
          Number(d.lifetimeRealizedPnl) || 0,
          JSON.stringify(d.closedPositions || []),
          d.showcasePresenceOnline === true,
          ts(d.showcasePresenceOfflineAt),
          Number(d.showcaseTradeCount) || 0,
          JSON.stringify(d)
        ]
      );
      su += 1;
    }
    console.log(`showcase users → users: ${su}`);
  }

  await migrateCollection(db, pg, 'adminChatLogs', 'admin_chat_logs', (id, d) => ({
    sql: `insert into admin_chat_logs (id, thread_id, peer_showcase_id, peer_showcase_name, from_uid, from_name, text, image_url, created_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,coalesce($9,now()))
      on conflict (id) do nothing`,
    params: [
      id,
      d.threadId || null,
      d.peerShowcaseId || null,
      String(d.peerShowcaseName || ''),
      String(d.fromUid || ''),
      String(d.fromName || ''),
      String(d.text || ''),
      d.imageUrl || null,
      ts(d.createdAt)
    ]
  }));

  await migrateCollection(db, pg, 'tipQueries', 'tip_queries', (id, d) => ({
    sql: `insert into tip_queries (id, doc, created_at) values ($1,$2::jsonb,coalesce($3,now()))
      on conflict (id) do update set doc=excluded.doc`,
    params: [id, JSON.stringify({ ...d, id }), ts(d.created_at)]
  }));

  await pg.end();
  console.log('Admin migration done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
