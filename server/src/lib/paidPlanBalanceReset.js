const { getPool } = require('../db/pool');
const { isPaidRow, planConfig, normalizePlanType } = require('./paidPlan');

const TZ = 'Asia/Kolkata';
/** June 1 2026 00:00 IST — first campaign balance reset. */
const CAMPAIGN_RESET_MS = Date.UTC(2026, 4, 31, 18, 30, 0, 0);

function istParts(ms) {
  const d = new Date(ms);
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = f.formatToParts(d);
  const o = {};
  parts.forEach((p) => {
    if (p.type !== 'literal') o[p.type] = Number(p.value);
  });
  return o;
}

function istMidnightUtc(y, m, d) {
  let t = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 6 * 60 * 60 * 1000;
  for (let i = 0; i < 48; i += 1) {
    const dateKey = new Date(t).toLocaleDateString('sv-SE', { timeZone: TZ });
    const [yy, mm, dd] = dateKey.split('-').map(Number);
    if (yy === y && mm === m && dd === d) break;
    const tag = yy * 10000 + mm * 100 + dd;
    const want = y * 10000 + m * 100 + d;
    t += tag < want ? 60 * 60 * 1000 : -60 * 60 * 1000;
  }
  const p = istParts(t);
  return t - ((p.hour * 60 + p.minute) * 60 + p.second) * 1000;
}

function istFirstOfNextMonthMidnight(fromMs = Date.now()) {
  const p = istParts(fromMs);
  const ny = p.month === 12 ? p.year + 1 : p.year;
  const nm = p.month === 12 ? 1 : p.month + 1;
  return istMidnightUtc(ny, nm, 1);
}

/** When the plan starting balance should be applied (UTC ms). */
function computePaidBalanceResetAt(fromMs = Date.now()) {
  if (fromMs < CAMPAIGN_RESET_MS) return CAMPAIGN_RESET_MS;
  return istFirstOfNextMonthMidnight(fromMs);
}

function computePaidBalanceResetAtIso(fromMs = Date.now()) {
  return new Date(computePaidBalanceResetAt(fromMs)).toISOString();
}

function resetAlreadyApplied(row) {
  if (!row?.paid_balance_reset_at) return false;
  const resetMs = new Date(row.paid_balance_reset_at).getTime();
  const appliedMs = row.paid_balance_reset_applied_at
    ? new Date(row.paid_balance_reset_applied_at).getTime()
    : NaN;
  return Number.isFinite(appliedMs) && appliedMs >= resetMs;
}

function isPaidBalanceResetDue(row, nowMs = Date.now()) {
  if (!isPaidRow(row)) return false;
  if (!row.paid_balance_reset_at) return false;
  if (resetAlreadyApplied(row)) return false;
  const resetMs = new Date(row.paid_balance_reset_at).getTime();
  return Number.isFinite(resetMs) && resetMs <= nowMs;
}

function planVirtualBalance(row, cfg) {
  const lifetimePnl = Number(row?.lifetime_realized_pnl) || 0;
  return Math.max(0, Number(cfg.startBalance || 0) + lifetimePnl);
}

/** First-time or missed grant: paid plan active but starting balance never marked applied. */
function needsPaidStartingBalanceGrant(row) {
  if (!isPaidRow(row)) return false;
  if (!row.paid_balance_reset_applied_at) return true;
  return false;
}

/**
 * Grant plan starting balance immediately (Basic $20k / Pro $50k + lifetime realized PnL).
 */
async function grantPaidPlanStartingBalance(uid, client) {
  if (!uid) return { row: null, granted: false };
  const db = client || getPool();
  const { rows } = await db.query(
    `select uid, is_paid_member, paid_plan_type, paid_member_until, virtual_balance,
      coalesce(lifetime_realized_pnl, 0) as lifetime_realized_pnl,
      paid_balance_reset_at, paid_balance_reset_applied_at
     from users where uid = $1`,
    [uid]
  );
  const row = rows[0];
  if (!needsPaidStartingBalanceGrant(row)) return { row, granted: false };

  const cfg = planConfig(row.paid_plan_type);
  if (!cfg) return { row, granted: false };

  const now = new Date();
  const nextBalance = planVirtualBalance(row, cfg);
  const nextReset = computePaidBalanceResetAtIso(now.getTime() + 1000);

  const { rows: updated } = await db.query(
    `update users set
      virtual_balance = $2,
      paid_balance_reset_applied_at = $3,
      paid_balance_reset_at = coalesce(paid_balance_reset_at, $4::timestamptz),
      updated_at = now()
     where uid = $1
     returning uid, virtual_balance, paid_balance_reset_at, paid_balance_reset_applied_at`,
    [uid, nextBalance, now, nextReset]
  );
  return { row: updated[0] || row, granted: !!updated[0] };
}

async function ensurePaidPlanBalanceGranted(uid, client) {
  return grantPaidPlanStartingBalance(uid, client);
}

async function applyPaidBalanceResetIfDue(uid, client) {
  if (!uid) return { row: null, applied: false };
  const db = client || getPool();
  const { rows } = await db.query(
    `select uid, is_paid_member, paid_plan_type, paid_member_until, virtual_balance,
      paid_balance_reset_at, paid_balance_reset_applied_at
     from users where uid = $1`,
    [uid]
  );
  const row = rows[0];
  if (!isPaidBalanceResetDue(row)) return { row, applied: false };

  const cfg = planConfig(row.paid_plan_type);
  if (!cfg) return { row, applied: false };

  const now = new Date();
  const nextReset = computePaidBalanceResetAtIso(now.getTime() + 1000);

  const { rows: updated } = await db.query(
    `update users set
      virtual_balance = $2,
      paid_balance_reset_applied_at = $3,
      paid_balance_reset_at = $4,
      updated_at = now()
     where uid = $1
     returning uid`,
    [uid, cfg.startBalance, now, nextReset]
  );
  return { row, applied: !!updated[0] };
}

async function applyAllDuePaidBalanceResets(client) {
  const db = client || getPool();
  const now = new Date();
  const { rows } = await db.query(
    `select uid from users
     where is_paid_member = true
       and paid_plan_type in ('basic', 'pro', 'ultimate_pro')
       and paid_balance_reset_at is not null
       and paid_balance_reset_at <= $1
       and (paid_balance_reset_applied_at is null
            or paid_balance_reset_applied_at < paid_balance_reset_at)`,
    [now]
  );
  let applied = 0;
  for (const r of rows) {
    const { applied: ok } = await applyPaidBalanceResetIfDue(r.uid, db);
    if (ok) applied += 1;
  }
  return applied;
}

module.exports = {
  computePaidBalanceResetAt,
  computePaidBalanceResetAtIso,
  isPaidBalanceResetDue,
  planVirtualBalance,
  grantPaidPlanStartingBalance,
  ensurePaidPlanBalanceGranted,
  applyPaidBalanceResetIfDue,
  applyAllDuePaidBalanceResets,
  normalizePlanType
};
