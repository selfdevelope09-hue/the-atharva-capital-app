const { getPool } = require('./pool');
const { expirePaidPlanIfNeeded } = require('../lib/paidPlanExpiry');
const {
  applyPaidBalanceResetIfDue,
  ensurePaidPlanBalanceGranted
} = require('../lib/paidPlanBalanceReset');

const USER_COLS = `
  uid, email, name, photo_url, bio, virtual_balance, lifetime_realized_pnl,
  followers, following, watchlist, presence_online, last_seen_at,
  positions, closed_positions, portfolio,
  daily_trades_date, daily_trades_count, daily_ad_trade_bonus, daily_twelve_reward_claimed_date,
  coalesce(is_showcase_profile, false) as is_showcase_profile,
  showcase_presence_online, showcase_presence_offline_at,
  coalesce(total_minutes_online, 0) as total_minutes_online,
  coalesce(creds_active_days, 0) as creds_active_days,
  coalesce(creds_streak_days, 0) as creds_streak_days,
  coalesce(creds_liquidations_count, 0) as creds_liquidations_count,
  coalesce(is_paid_member, false) as is_paid_member,
  paid_plan_type, paid_member_until, paid_member_granted_at, paid_member_granted_by,
  coalesce(creds_paid_bonus, 0) as creds_paid_bonus,
  paid_balance_reset_at, paid_balance_reset_applied_at,
  coalesce(paid_free_resets_used, 0) as paid_free_resets_used,
  app_login_id, app_password_hash, app_login_temp_plain, app_password_must_change
`;

async function getUserByUid(uid, client) {
  const db = client || getPool();
  await expirePaidPlanIfNeeded(uid, db);
  await applyPaidBalanceResetIfDue(uid, db);
  await ensurePaidPlanBalanceGranted(uid, db);
  const { rows } = await db.query(`select ${USER_COLS} from users where uid = $1`, [uid]);
  return rows[0] || null;
}

async function ensureUserFromFirebase(decoded, client) {
  const db = client || getPool();
  const existing = await getUserByUid(decoded.uid, db);
  if (existing) return existing;

  const email = decoded.email || null;
  const name = decoded.name || decoded.displayName || 'Trader';
  const photo = decoded.picture || '';

  const { rows } = await db.query(
    `insert into users (uid, email, name, photo_url, virtual_balance)
     values ($1, $2, $3, $4, 10000)
     on conflict (uid) do nothing
     returning ${USER_COLS}`,
    [decoded.uid, email, name, photo]
  );
  if (rows[0]) return rows[0];
  return getUserByUid(decoded.uid, db);
}

async function updateUserOptimistic(uid, expectedBalance, patch, client) {
  const db = client || getPool();
  const sets = [];
  const vals = [];
  let i = 1;

  const map = {
    virtual_balance: patch.virtual_balance,
    positions: patch.positions != null ? patch.positions : undefined,
    closed_positions: patch.closed_positions != null ? patch.closed_positions : undefined,
    lifetime_realized_pnl: patch.lifetime_realized_pnl,
    daily_trades_date: patch.daily_trades_date,
    daily_trades_count: patch.daily_trades_count,
    daily_ad_trade_bonus: patch.daily_ad_trade_bonus,
    daily_twelve_reward_claimed_date: patch.daily_twelve_reward_claimed_date
  };

  for (const [col, val] of Object.entries(map)) {
    if (val === undefined) continue;
    if (col === 'positions' || col === 'closed_positions') {
      sets.push(`${col} = $${i++}::jsonb`);
    } else {
      sets.push(`${col} = $${i++}`);
    }
    vals.push(col === 'positions' || col === 'closed_positions' ? JSON.stringify(val) : val);
  }
  sets.push(`updated_at = now()`);

    vals.push(uid, expectedBalance);
  const q = `
    update users set ${sets.join(', ')}
    where uid = $${i++} and virtual_balance::numeric = $${i}::numeric
    returning ${USER_COLS}
  `;
  const { rows } = await db.query(q, vals);
  return rows[0] || null;
}

module.exports = { getUserByUid, ensureUserFromFirebase, updateUserOptimistic, USER_COLS };
