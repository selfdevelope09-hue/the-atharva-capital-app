const crypto = require('crypto');
const { getPool } = require('../db/pool');
const { getAuth } = require('./firebaseAdmin');

const PASS_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Shared password for all showcase AuronX logins. */
const SHOWCASE_APP_PASSWORD = 'atharva2530';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !String(stored).startsWith('scrypt:')) return false;
  const parts = String(stored).split(':');
  if (parts.length !== 3) return false;
  const [, salt, expected] = parts;
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

function generatePassword(len = 10) {
  let s = '';
  for (let i = 0; i < len; i += 1) {
    s += PASS_CHARS[crypto.randomInt(PASS_CHARS.length)];
  }
  return s;
}

function slugifyShowcaseLoginId(displayName) {
  const base = String(displayName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  if (base.length >= 4) return base.slice(0, 20);
  const padded = `${base}show`.slice(0, 20);
  return padded.length >= 4 ? padded : 'show';
}

async function generateShowcaseLoginId(pg, displayName, excludeUid = null) {
  let base = slugifyShowcaseLoginId(displayName);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate =
      attempt === 0 ? base : `${base}${attempt + 1}`.slice(0, 20);
    const { rows } = await pg.query(
      `select 1 from users where lower(app_login_id) = lower($1) and ($2::text is null or uid <> $2) limit 1`,
      [candidate, excludeUid]
    );
    if (!rows[0]) return candidate;
  }
  return `show${crypto.randomBytes(4).toString('hex')}`;
}

async function generateUniqueLoginId(pg, uid) {
  const compact = String(uid || '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
    .slice(-8);
  let base = `ax${compact || crypto.randomBytes(3).toString('hex')}`.slice(0, 14);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}${attempt}`;
    const { rows } = await pg.query(
      `select 1 from users where lower(app_login_id) = lower($1) limit 1`,
      [candidate]
    );
    if (!rows[0]) return candidate;
  }
  return `ax${crypto.randomBytes(5).toString('hex')}`;
}

/**
 * Create AuronX login id + password when missing. Returns plaintext password once.
 * @returns {Promise<{ loginId: string, password: string }|null>}
 */
async function ensureAppCredentials(uid, client) {
  const pg = client || getPool();
  const { rows } = await pg.query(
    `select app_login_id, app_password_hash from users where uid = $1`,
    [uid]
  );
  const row = rows[0];
  if (!row) return null;
  if (row.app_login_id && row.app_password_hash) return null;

  const loginId = await generateUniqueLoginId(pg, uid);
  const password = generatePassword(10);
  const app_password_hash = hashPassword(password);
  await pg.query(
    `update users set
      app_login_id = $2,
      app_password_hash = $3,
      app_login_temp_plain = $4,
      app_password_must_change = true,
      updated_at = now()
     where uid = $1`,
    [uid, loginId, app_password_hash, password]
  );
  return { loginId, password };
}

/**
 * Showcase profiles: AuronX ID = display name (lowercase letters/digits), password atharva2530.
 */
async function syncShowcaseAppCredentials(uid, displayName, client) {
  if (!String(uid || '').startsWith('showcase__')) return null;
  const pg = client || getPool();
  const loginId = await generateShowcaseLoginId(pg, displayName, uid);
  const password = SHOWCASE_APP_PASSWORD;
  await pg.query(
    `update users set
      app_login_id = $2,
      app_password_hash = $3,
      app_login_temp_plain = $4,
      app_password_must_change = false,
      updated_at = now()
     where uid = $1`,
    [uid, loginId, hashPassword(password), password]
  );
  return { loginId, password };
}

async function syncAllShowcaseAppLogins(client) {
  const pg = client || getPool();
  const { rows } = await pg.query(
    `select ls.profile_uid, ls.display_name
     from leaderboard_showcase ls
     where ls.profile_uid is not null and ls.profile_uid <> ''`
  );
  let updated = 0;
  for (const row of rows) {
    const r = await syncShowcaseAppCredentials(row.profile_uid, row.display_name, pg);
    if (r) updated += 1;
  }
  return { updated, total: rows.length };
}

async function findUidByLoginId(loginId) {
  const id = String(loginId || '')
    .trim()
    .toLowerCase();
  if (!id) return null;
  const { rows } = await getPool().query(
    `select uid, app_password_hash from users where lower(app_login_id) = $1 limit 1`,
    [id]
  );
  return rows[0] || null;
}

async function createCustomTokenForAppLogin(loginId, password) {
  const row = await findUidByLoginId(loginId);
  if (!row?.uid || !row.app_password_hash) {
    const err = new Error('Invalid AuronX ID or password');
    err.statusCode = 401;
    throw err;
  }
  if (!verifyPassword(password, row.app_password_hash)) {
    const err = new Error('Invalid AuronX ID or password');
    err.statusCode = 401;
    throw err;
  }
  const customToken = await getAuth().createCustomToken(row.uid);
  return { uid: row.uid, customToken };
}

async function changeAppLoginId(uid, currentPassword, newLoginId) {
  const custom = String(newLoginId || '')
    .trim()
    .toLowerCase();
  if (custom.length < 4 || custom.length > 20) {
    const err = new Error('AuronX ID must be 4–20 characters');
    err.statusCode = 400;
    throw err;
  }
  if (!/^[a-z0-9_]+$/.test(custom)) {
    const err = new Error('Use only letters, numbers, and underscore');
    err.statusCode = 400;
    throw err;
  }
  const { rows } = await getPool().query(
    `select app_password_hash, app_login_id from users where uid = $1`,
    [uid]
  );
  const row = rows[0];
  if (!row?.app_password_hash) {
    const err = new Error('AuronX ID login is not set up for this account');
    err.statusCode = 400;
    throw err;
  }
  if (!verifyPassword(currentPassword, row.app_password_hash)) {
    const err = new Error('Current password is wrong');
    err.statusCode = 401;
    throw err;
  }
  if (custom === String(row.app_login_id || '').toLowerCase()) {
    return { loginId: row.app_login_id };
  }
  const { rows: taken } = await getPool().query(
    `select uid from users where lower(app_login_id) = $1 and uid <> $2 limit 1`,
    [custom, uid]
  );
  if (taken[0]) {
    const err = new Error('This AuronX ID is already taken');
    err.statusCode = 409;
    throw err;
  }
  await getPool().query(
    `update users set app_login_id = $2, updated_at = now() where uid = $1`,
    [uid, custom]
  );
  return { loginId: custom };
}

async function changeAppPassword(uid, currentPassword, newPassword) {
  const next = String(newPassword || '');
  if (next.length < 6) {
    const err = new Error('New password must be at least 6 characters');
    err.statusCode = 400;
    throw err;
  }
  const { rows } = await getPool().query(
    `select app_password_hash from users where uid = $1`,
    [uid]
  );
  const row = rows[0];
  if (!row?.app_password_hash) {
    const err = new Error('AuronX ID login is not set up for this account');
    err.statusCode = 400;
    throw err;
  }
  if (!verifyPassword(currentPassword, row.app_password_hash)) {
    const err = new Error('Current password is wrong');
    err.statusCode = 401;
    throw err;
  }
  await getPool().query(
    `update users set
      app_password_hash = $2,
      app_login_temp_plain = $3,
      app_password_must_change = false,
      updated_at = now()
     where uid = $1`,
    [uid, hashPassword(next), next]
  );
  return { ok: true };
}

async function adminSetAppPassword(targetUid, password, loginIdOptional) {
  const plain = String(password || '').trim();
  if (plain.length < 6) {
    const err = new Error('Password must be at least 6 characters');
    err.statusCode = 400;
    throw err;
  }
  const pg = getPool();
  const { rows } = await pg.query(`select uid, app_login_id from users where uid = $1`, [targetUid]);
  if (!rows[0]) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  let loginId = rows[0].app_login_id;
  if (!loginId) loginId = await generateUniqueLoginId(pg, targetUid);
  if (loginIdOptional) {
    const custom = String(loginIdOptional).trim().toLowerCase();
    if (custom.length < 4) {
      const err = new Error('Login ID too short');
      err.statusCode = 400;
      throw err;
    }
    const { rows: taken } = await pg.query(
      `select uid from users where lower(app_login_id) = $1 and uid <> $2 limit 1`,
      [custom, targetUid]
    );
    if (taken[0]) {
      const err = new Error('Login ID already in use');
      err.statusCode = 409;
      throw err;
    }
    loginId = custom;
  }
  await pg.query(
    `update users set
      app_login_id = $2,
      app_password_hash = $3,
      app_login_temp_plain = $4,
      app_password_must_change = true,
      updated_at = now()
     where uid = $1`,
    [targetUid, loginId, hashPassword(plain), plain]
  );
  return { loginId, password: plain };
}

function appLoginFieldsFromRow(row) {
  if (!row) return {};
  return {
    appLoginId: row.app_login_id ? String(row.app_login_id) : '',
    appLoginPassword: row.app_login_temp_plain ? String(row.app_login_temp_plain) : '',
    appPasswordMustChange: row.app_password_must_change !== false
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  generatePassword,
  slugifyShowcaseLoginId,
  ensureAppCredentials,
  syncShowcaseAppCredentials,
  syncAllShowcaseAppLogins,
  createCustomTokenForAppLogin,
  changeAppPassword,
  changeAppLoginId,
  adminSetAppPassword,
  appLoginFieldsFromRow,
  SHOWCASE_APP_PASSWORD
};
