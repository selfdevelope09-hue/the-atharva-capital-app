const { getPool } = require('../db/pool');
const { VIRTUAL_BALANCE_ON_TRADING_RESET_SQL } = require('./paidPlan');

/**
 * Monthly reset: all real + showcase users, plan-tier wallet balance, trades/P/L cleared,
 * showcase board rows kept (pnl/trade_count → 0).
 */
async function runMonthlyTradingReset() {
  const { rowCount: postgresUsersUpdated } = await getPool().query(
    `update users set
      virtual_balance = ${VIRTUAL_BALANCE_ON_TRADING_RESET_SQL},
      lifetime_realized_pnl = 0,
      positions = '[]'::jsonb,
      closed_positions = '[]'::jsonb,
      portfolio = '[]'::jsonb,
      daily_trades_date = null,
      daily_trades_count = 0,
      daily_ad_trade_bonus = 0,
      daily_twelve_reward_claimed_date = null,
      reset_at = now(),
      updated_at = now()`
  );
  const { rowCount: showcaseRowsUpdated } = await getPool().query(
    `update leaderboard_showcase set
      pnl = 0,
      trade_count = 0,
      updated_at = now()`
  );
  return {
    ok: true,
    postgresUsersUpdated,
    supabaseUsersUpdated: postgresUsersUpdated,
    firestoreUsersUpdated: 0,
    showcaseRowsUpdated,
    leaderboardUnfrozen: true,
    balanceNote:
      'Free $10,000 · Basic paid $20,000 · Pro paid $50,000 (active plan). Real + showcase; showcase names kept.'
  };
}

module.exports = { runMonthlyTradingReset };
