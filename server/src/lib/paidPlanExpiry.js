const { getPool } = require('../db/pool');

/** Clear expired paid plans — returns updated row if changed. */
async function expirePaidPlanIfNeeded(uid, client) {
  if (!uid) return null;
  const db = client || getPool();
  const { rows } = await db.query(
    `select uid, is_paid_member, paid_plan_type, paid_member_until
     from users where uid = $1`,
    [uid]
  );
  const row = rows[0];
  if (!row || row.is_paid_member !== true) return row;
  if (!row.paid_member_until) return row;
  const untilMs = new Date(row.paid_member_until).getTime();
  if (!Number.isFinite(untilMs) || untilMs > Date.now()) return row;

  const { rows: updated } = await db.query(
    `update users set
      is_paid_member = false,
      paid_plan_type = null,
      paid_member_until = null,
      paid_member_granted_at = null,
      paid_member_granted_by = null,
      paid_balance_reset_at = null,
      paid_balance_reset_applied_at = null,
      updated_at = now()
     where uid = $1
     returning uid`,
    [uid]
  );
  return updated[0] ? { ...row, is_paid_member: false, paid_plan_type: null, paid_member_until: null } : row;
}

module.exports = { expirePaidPlanIfNeeded };
