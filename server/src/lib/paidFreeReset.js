const { getPool } = require('../db/pool');
const {
  isPaidRow,
  planConfig,
  VIRTUAL_BALANCE_ON_TRADING_RESET_SQL,
  BASIC_FREE_RESET_LIMIT,
  PRO_FREE_RESET_LIMIT,
  ULTIMATE_PRO_FREE_RESET_LIMIT
} = require('./paidPlan');

function paidFreeResetLimitForRow(row) {
  if (!isPaidRow(row)) return 0;
  return planConfig(row.paid_plan_type)?.freeResets ?? 0;
}

function paidFreeResetsUsed(row) {
  return Math.max(0, Number(row?.paid_free_resets_used) || 0);
}

function paidFreeResetsRemaining(row) {
  const limit = paidFreeResetLimitForRow(row);
  return Math.max(0, limit - paidFreeResetsUsed(row));
}

/**
 * Full trading reset + plan-tier wallet ($20k Basic / $50k Pro). Consumes one free reset.
 */
async function applyPaidFreeTradingReset(uid, client) {
  const db = client || getPool();
  const { rows: locked } = await db.query(
    `select uid, is_paid_member, paid_plan_type, paid_member_until,
      coalesce(paid_free_resets_used, 0) as paid_free_resets_used
     from users where uid = $1 for update`,
    [uid]
  );
  const row = locked[0];
  if (!row) return { ok: false, status: 404, error: 'User not found' };
  if (!isPaidRow(row)) {
    return { ok: false, status: 403, error: 'Active paid plan required for free resets' };
  }
  if (paidFreeResetsRemaining(row) <= 0) {
    return { ok: false, status: 403, error: 'No free resets left on your plan' };
  }

  const { rows: up } = await db.query(
    `update users set
      virtual_balance = ${VIRTUAL_BALANCE_ON_TRADING_RESET_SQL},
      lifetime_realized_pnl = 0,
      positions = '[]'::jsonb,
      closed_positions = '[]'::jsonb,
      portfolio = '[]'::jsonb,
      paid_free_resets_used = coalesce(paid_free_resets_used, 0) + 1,
      reset_at = now(),
      daily_trades_date = null,
      daily_trades_count = 0,
      daily_ad_trade_bonus = 0,
      daily_twelve_reward_claimed_date = null,
      updated_at = now()
    where uid = $1
    returning uid, virtual_balance, paid_plan_type, paid_free_resets_used`,
    [uid]
  );
  const updated = up[0];
  const cfg = planConfig(updated.paid_plan_type);
  return {
    ok: true,
    virtualBalance: Number(updated.virtual_balance),
    planType: updated.paid_plan_type,
    freeResetsUsed: paidFreeResetsUsed(updated),
    freeResetsRemaining: paidFreeResetsRemaining(updated),
    freeResetsLimit: paidFreeResetLimitForRow(updated),
    startBalanceUsd: cfg?.startBalance ?? null
  };
}

module.exports = {
  BASIC_FREE_RESET_LIMIT,
  PRO_FREE_RESET_LIMIT,
  ULTIMATE_PRO_FREE_RESET_LIMIT,
  paidFreeResetLimitForRow,
  paidFreeResetsUsed,
  paidFreeResetsRemaining,
  applyPaidFreeTradingReset
};
