const crypto = require('crypto');
const { getPool } = require('../db/pool');
const { buildSyntheticClosedPositions, buildRealisticClosedTrade } = require('./showcaseSyntheticTrades');
const { syncShowcaseAppCredentials, appLoginFieldsFromRow } = require('./appLogin');

function showcaseRowToClient(r, loginRow) {
  const login = loginRow ? appLoginFieldsFromRow(loginRow) : {};
  return {
    id: r.id,
    displayName: r.display_name,
    pnl: Number(r.pnl) || 0,
    tradeCount: Number(r.trade_count) || 0,
    profile_uid: r.profile_uid,
    showcasePresenceOnline: r.showcase_presence_online === true,
    showcasePresenceOfflineAt: r.showcase_presence_offline_at
      ? new Date(r.showcase_presence_offline_at).toISOString()
      : null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    appLoginId: login.appLoginId || '',
    appLoginPassword: login.appLoginPassword || ''
  };
}

function buildShowcaseUserRow(profileUid, displayName, pnlRaw, tradeCountRaw, preserve = {}) {
  const pnl = Number.isFinite(Number(pnlRaw)) ? Number(pnlRaw) : 0;
  const tc = Math.max(0, Math.min(500, Math.floor(Number(tradeCountRaw)) || 0));
  const closedAtEndMs = preserve.closedAtEndMs;
  const closedPositions =
    tc > 0 ? buildSyntheticClosedPositions(pnl, tc, profileUid, closedAtEndMs) : [];
  const sumClosed = closedPositions.reduce((s, x) => s + Number(x.realizedPnl || 0), 0);
  const lifetimeRealizedPnl = Math.max(
    Number.isFinite(Number(pnlRaw)) ? Number(pnlRaw) : 0,
    closedPositions.length > 0 ? sumClosed : 0
  );
  const photoURL = String(preserve.photoURL || '').slice(0, 500000);
  const bio = String(preserve.bio || '').slice(0, 2000);
  const presenceOnline = preserve.showcasePresenceOnline === true;
  const presenceOfflineAt = preserve.showcasePresenceOfflineAt || null;

  return {
    uid: profileUid,
    email: '',
    name: displayName,
    photo_url: photoURL,
    bio,
    virtual_balance: Math.max(0, 10000 + lifetimeRealizedPnl),
    lifetime_realized_pnl: lifetimeRealizedPnl,
    positions: [],
    closed_positions: closedPositions,
    portfolio: [],
    followers: preserve.includeSocial === false ? undefined : [],
    following: preserve.includeSocial === false ? undefined : [],
    is_showcase_profile: true,
    showcase_presence_online: presenceOnline,
    showcase_presence_offline_at: presenceOfflineAt,
    showcase_trade_count: tc,
    doc: {
      isShowcaseProfile: true,
      showcaseTradeCount: tc,
      closedPositions,
      showcasePresenceOnline: presenceOnline
    }
  };
}

async function upsertShowcaseUser(fields, includeSocial = true) {
  const preserve = {
    photoURL: fields.photo_url,
    bio: fields.bio,
    showcasePresenceOnline: fields.showcase_presence_online,
    showcasePresenceOfflineAt: fields.showcase_presence_offline_at,
    closedAtEndMs: fields.closedAtEndMs,
    includeSocial
  };
  const built = buildShowcaseUserRow(
    fields.uid,
    fields.name,
    fields.lifetime_realized_pnl ?? fields.pnl,
    fields.showcase_trade_count ?? fields.tradeCount,
    preserve
  );
  const followers = includeSocial ? built.followers || [] : null;
  const following = includeSocial ? built.following || [] : null;

  await getPool().query(
    `insert into users (
      uid, email, name, photo_url, bio, virtual_balance, lifetime_realized_pnl,
      followers, following, watchlist, positions, closed_positions, portfolio,
      is_showcase_profile, showcase_presence_online, showcase_presence_offline_at, showcase_trade_count, doc, updated_at
    ) values (
      $1,$2,$3,$4,$5,$6,$7,
      coalesce($8::text[], '{}'), coalesce($9::text[], '{}'), '{}',
      '[]'::jsonb, $10::jsonb, '[]'::jsonb,
      true, $11, $12, $13, $14::jsonb, now()
    )
    on conflict (uid) do update set
      name = excluded.name,
      photo_url = excluded.photo_url,
      bio = excluded.bio,
      virtual_balance = excluded.virtual_balance,
      lifetime_realized_pnl = excluded.lifetime_realized_pnl,
      closed_positions = excluded.closed_positions,
      positions = '[]'::jsonb,
      is_showcase_profile = true,
      showcase_presence_online = excluded.showcase_presence_online,
      showcase_presence_offline_at = excluded.showcase_presence_offline_at,
      showcase_trade_count = excluded.showcase_trade_count,
      doc = excluded.doc,
      updated_at = now()`,
    [
      built.uid,
      built.email,
      built.name,
      built.photo_url,
      built.bio,
      built.virtual_balance,
      built.lifetime_realized_pnl,
      followers,
      following,
      JSON.stringify(built.closed_positions),
      built.showcase_presence_online,
      built.showcase_presence_offline_at,
      built.showcase_trade_count,
      JSON.stringify(built.doc)
    ]
  );
}

async function listShowcaseRows() {
  const { rows } = await getPool().query(
    `select * from leaderboard_showcase order by pnl desc nulls last`
  );
  const out = [];
  for (const r of rows) {
    const profileUid = r.profile_uid;
    let loginRow = null;
    if (profileUid) {
      await syncShowcaseAppCredentials(profileUid, r.display_name).catch(() => null);
      const { rows: uRows } = await getPool().query(
        `select app_login_id, app_login_temp_plain, app_password_hash from users where uid = $1`,
        [profileUid]
      );
      loginRow = uRows[0] || null;
    }
    out.push(showcaseRowToClient(r, loginRow));
  }
  return out;
}

async function createShowcaseRow({ displayName, pnl, tradeCount, photoURL, bio, id }) {
  const rowId = id || crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  const profileUid = `showcase__${rowId}`;
  const now = new Date();
  await getPool().query(
    `insert into leaderboard_showcase (
      id, display_name, pnl, trade_count, profile_uid,
      showcase_presence_online, showcase_presence_offline_at, updated_at
    ) values ($1,$2,$3,$4,$5,false,$6,now())`,
    [rowId, displayName, pnl, tradeCount, profileUid, now]
  );
  await upsertShowcaseUser(
    {
      uid: profileUid,
      name: displayName,
      photo_url: photoURL || '',
      bio: bio || '',
      lifetime_realized_pnl: pnl,
      showcase_trade_count: tradeCount,
      showcase_presence_online: false,
      showcase_presence_offline_at: now
    },
    true
  );
  const creds = await syncShowcaseAppCredentials(profileUid, displayName);
  const { rows } = await getPool().query(`select * from leaderboard_showcase where id = $1`, [rowId]);
  const { rows: uRows } = await getPool().query(
    `select app_login_id, app_login_temp_plain, app_password_hash from users where uid = $1`,
    [profileUid]
  );
  const client = showcaseRowToClient(rows[0], uRows[0]);
  if (creds) {
    client.appLoginId = creds.loginId;
    client.appLoginPassword = creds.password;
  }
  return client;
}

async function updateShowcaseRow(id, { displayName, pnl, tradeCount, photoURL, bio }) {
  const { rows: prevRows } = await getPool().query(`select * from leaderboard_showcase where id = $1`, [id]);
  const prev = prevRows[0];
  if (!prev) throw new Error('Showcase row not found');
  const profileUid = prev.profile_uid;
  const { rows: uRows } = await getPool().query(`select photo_url, bio, showcase_presence_online, showcase_presence_offline_at from users where uid = $1`, [
    profileUid
  ]);
  const u = uRows[0] || {};
  await getPool().query(
    `update leaderboard_showcase set display_name = $2, pnl = $3, trade_count = $4, updated_at = now() where id = $1`,
    [id, displayName, pnl, tradeCount]
  );
  await upsertShowcaseUser(
    {
      uid: profileUid,
      name: displayName,
      photo_url: photoURL || u.photo_url || '',
      bio: bio ?? u.bio ?? '',
      lifetime_realized_pnl: pnl,
      showcase_trade_count: tradeCount,
      showcase_presence_online: u.showcase_presence_online,
      showcase_presence_offline_at: u.showcase_presence_offline_at
    },
    false
  );
  await syncShowcaseAppCredentials(profileUid, displayName);
  const { rows } = await getPool().query(`select * from leaderboard_showcase where id = $1`, [id]);
  const { rows: loginRows } = await getPool().query(
    `select app_login_id, app_login_temp_plain, app_password_hash from users where uid = $1`,
    [profileUid]
  );
  return showcaseRowToClient(rows[0], loginRows[0]);
}

async function deleteShowcaseRow(id) {
  const { rows } = await getPool().query(`select profile_uid from leaderboard_showcase where id = $1`, [id]);
  const profileUid = rows[0]?.profile_uid;
  await getPool().query(`delete from leaderboard_showcase where id = $1`, [id]);
  if (profileUid) await getPool().query(`delete from users where uid = $1`, [profileUid]);
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Varied "last seen X min ago" — prefer 1,4,5,7,8 min + random seconds. */
function buildVariedOfflineTimestamps(n) {
  const baseMins = [1, 4, 5, 7, 8, 2, 3, 6, 9, 10, 11, 12, 15, 18, 22];
  shuffleInPlace(baseMins);
  const out = [];
  const now = Date.now();
  for (let i = 0; i < n; i += 1) {
    const mins = baseMins[i % baseMins.length];
    const extraSec = (Math.floor(Math.random() * 47) + i * 13) % 55;
    out.push(new Date(now - mins * 60 * 1000 - extraSec * 1000));
  }
  return out;
}

async function setShowcasePresence(entryId, profileUid, online, offlineAt = null) {
  const offlineAtResolved = online ? null : offlineAt || new Date();
  await getPool().query(
    `update leaderboard_showcase set
      showcase_presence_online = $2,
      showcase_presence_offline_at = $3,
      updated_at = now()
     where id = $1`,
    [entryId, online, offlineAtResolved]
  );
  await getPool().query(
    `update users set
      showcase_presence_online = $2,
      showcase_presence_offline_at = $3,
      updated_at = now()
     where uid = $1`,
    [profileUid, online, offlineAtResolved]
  );
}

/** Random N showcase profiles online or offline (bulk; per-row buttons unchanged). */
async function bulkSetShowcasePresence(countRaw, mode) {
  const count = Math.max(0, Math.min(500, parseInt(String(countRaw), 10) || 0));
  if (count <= 0) throw new Error('Enter a number greater than 0');
  const modeNorm = String(mode || '').toLowerCase();
  if (!['online', 'offline'].includes(modeNorm)) throw new Error('mode must be online or offline');

  const rows = await listShowcaseRows();
  const candidates =
    modeNorm === 'online'
      ? rows.filter((r) => r.showcasePresenceOnline !== true)
      : rows.filter((r) => r.showcasePresenceOnline === true);

  const picked = shuffleInPlace([...candidates]).slice(0, Math.min(count, candidates.length));
  const offlineTimes = modeNorm === 'offline' ? buildVariedOfflineTimestamps(picked.length) : [];
  const updated = [];

  for (let i = 0; i < picked.length; i += 1) {
    const row = picked[i];
    const profileUid = row.profile_uid;
    if (!profileUid) continue;
    const nextOnline = modeNorm === 'online';
    const offlineAt = nextOnline ? null : offlineTimes[i];
    await setShowcasePresence(row.id, profileUid, nextOnline, offlineAt);
    updated.push({
      id: row.id,
      profileUid,
      displayName: row.displayName,
      online: nextOnline,
      offlineAt: offlineAt ? offlineAt.toISOString() : null
    });
  }

  return {
    requested: count,
    applied: updated.length,
    available: candidates.length,
    mode: modeNorm,
    updated
  };
}

function parseClosedPositions(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Append P/L delta + one realistic closed trade (preserves existing history). */
async function appendShowcasePnlDelta(id, deltaPnlRaw) {
  const delta = Number(String(deltaPnlRaw ?? '').replace(/,/g, ''));
  if (!Number.isFinite(delta) || delta === 0) throw new Error('Enter a non-zero P/L amount');

  const { rows: prevRows } = await getPool().query(`select * from leaderboard_showcase where id = $1`, [id]);
  const prev = prevRows[0];
  if (!prev) throw new Error('Showcase row not found');

  const profileUid = prev.profile_uid;
  const { rows: uRows } = await getPool().query(
    `select closed_positions, photo_url, bio, showcase_presence_online, showcase_presence_offline_at from users where uid = $1`,
    [profileUid]
  );
  const u = uRows[0];
  if (!u) throw new Error('Showcase profile not found');

  const closedPositions = parseClosedPositions(u.closed_positions);
  const closedAtMs = Date.now();
  const newTrade = buildRealisticClosedTrade(delta, closedAtMs, profileUid);
  if (!newTrade) throw new Error('Could not build trade');

  const currentPnl =
    Number(prev.pnl) ||
    closedPositions.reduce((s, x) => s + Number(x.realizedPnl || 0), 0);
  const nextClosed = [...closedPositions, newTrade];
  const lifetimeRealizedPnl = currentPnl + delta;
  const newTradeCount = Math.max(Number(prev.trade_count) || 0, nextClosed.length);

  await getPool().query(
    `update leaderboard_showcase set pnl = $2, trade_count = $3, updated_at = now() where id = $1`,
    [id, lifetimeRealizedPnl, newTradeCount]
  );

  await getPool().query(
    `update users set
      lifetime_realized_pnl = $2,
      virtual_balance = $3,
      closed_positions = $4::jsonb,
      showcase_trade_count = $5,
      updated_at = now()
     where uid = $1`,
    [
      profileUid,
      lifetimeRealizedPnl,
      Math.max(0, 10000 + lifetimeRealizedPnl),
      JSON.stringify(nextClosed),
      newTradeCount
    ]
  );

  const { rows } = await getPool().query(`select * from leaderboard_showcase where id = $1`, [id]);
  const { rows: loginRows } = await getPool().query(
    `select app_login_id, app_login_temp_plain, app_password_hash from users where uid = $1`,
    [profileUid]
  );
  return {
    row: showcaseRowToClient(rows[0], loginRows[0]),
    trade: newTrade,
    lifetimeRealizedPnl,
    delta
  };
}

module.exports = {
  showcaseRowToClient,
  listShowcaseRows,
  createShowcaseRow,
  updateShowcaseRow,
  deleteShowcaseRow,
  setShowcasePresence,
  bulkSetShowcasePresence,
  buildShowcaseUserRow,
  upsertShowcaseUser,
  appendShowcasePnlDelta
};
