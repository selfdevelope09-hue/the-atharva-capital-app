const { getPool } = require('../db/pool');

const PRIMARY_FALLBACK = String(process.env.PLATFORM_ADMIN_UID || '8i1gWBZLj7NOdWTTj3Cg4sgCW4I2').trim();

async function getConfigValue(key) {
  const { rows } = await getPool().query(`select value from platform_config where key = $1`, [key]);
  return rows[0]?.value && typeof rows[0].value === 'object' ? rows[0].value : {};
}

async function setConfigValue(key, value, updatedBy) {
  await getPool().query(
    `insert into platform_config (key, value, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, JSON.stringify({ ...value, updatedBy, updatedAt: new Date().toISOString() })]
  );
}

async function isPlatformAdminUid(uid) {
  if (!uid) return false;
  if (uid === PRIMARY_FALLBACK) return true;
  const extra = String(process.env.PLATFORM_ADMIN_UIDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (extra.includes(uid)) return true;
  const ed = await getConfigValue('stockTipEditors');
  const list = Array.isArray(ed.uids) ? ed.uids.map(String) : [];
  return list.includes(String(uid));
}

async function requireAdmin(req, res) {
  const ok = await isPlatformAdminUid(req.user?.uid);
  if (!ok) {
    res.status(403).json({ ok: false, error: 'Admin only' });
    return false;
  }
  return true;
}

module.exports = {
  PRIMARY_FALLBACK,
  getConfigValue,
  setConfigValue,
  isPlatformAdminUid,
  requireAdmin
};
