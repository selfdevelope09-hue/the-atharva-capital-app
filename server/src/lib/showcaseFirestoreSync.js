const { initFirebase } = require('./firebaseAdmin');
const { getPool } = require('../db/pool');
const { listShowcaseRows, upsertShowcaseUser } = require('./showcaseService');

function ts(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * One-time pull: Firestore leaderboardShowcase → Postgres (when PG table empty).
 * @returns {Promise<number>} rows imported
 */
async function syncShowcaseFromFirestore({ force = false } = {}) {
  if (!force) {
    const existing = await listShowcaseRows();
    if (existing.length > 0) return 0;
  }

  const db = initFirebase().firestore();
  const snap = await db.collection('leaderboardShowcase').get();
  if (snap.empty) return 0;

  let n = 0;
  for (const doc of snap.docs) {
    const id = doc.id;
    const d = doc.data() || {};
    const displayName = String(d.displayName || d.display_name || '').trim();
    if (!displayName) continue;
    const pnl = Number(d.pnl) || 0;
    const tradeCount = Math.max(1, parseInt(String(d.tradeCount ?? d.trade_count ?? 12), 10) || 12);
    const profileUid = String(d.profile_uid || `showcase__${id}`).trim();
    const online = d.showcasePresenceOnline === true || d.showcase_presence_online === true;
    const offlineAt = online ? null : ts(d.showcasePresenceOfflineAt || d.showcase_presence_offline_at);

    await getPool().query(
      `insert into leaderboard_showcase (
        id, display_name, pnl, trade_count, profile_uid,
        showcase_presence_online, showcase_presence_offline_at, doc, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,coalesce($9,now()))
      on conflict (id) do update set
        display_name = excluded.display_name,
        pnl = excluded.pnl,
        trade_count = excluded.trade_count,
        profile_uid = excluded.profile_uid,
        showcase_presence_online = excluded.showcase_presence_online,
        showcase_presence_offline_at = excluded.showcase_presence_offline_at,
        doc = excluded.doc,
        updated_at = now()`,
      [
        id,
        displayName,
        pnl,
        tradeCount,
        profileUid,
        online,
        offlineAt,
        JSON.stringify(d),
        ts(d.updated_at)
      ]
    );

    let u = {};
    try {
      const uSnap = await db.collection('users').doc(profileUid).get();
      if (uSnap.exists) u = uSnap.data() || {};
    } catch {
      /* optional profile doc */
    }

    await upsertShowcaseUser(
      {
        uid: profileUid,
        name: String(u.name || displayName).trim() || displayName,
        photo_url: String(u.photoURL || u.photo_url || '').trim(),
        bio: String(u.bio || '').trim(),
        pnl,
        tradeCount,
        showcase_presence_online: online,
        showcase_presence_offline_at: offlineAt
      },
      true
    );
    n += 1;
  }

  return n;
}

async function syncShowcaseFromFirestoreIfEmpty() {
  return syncShowcaseFromFirestore({ force: false });
}

module.exports = { syncShowcaseFromFirestore, syncShowcaseFromFirestoreIfEmpty };
