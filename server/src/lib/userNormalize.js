/** Postgres row → app-shaped user doc (camelCase). */
function rowToAppUser(row) {
  if (!row) return null;
  const positions = Array.isArray(row.positions) ? row.positions : [];
  const closedPositions = Array.isArray(row.closed_positions) ? row.closed_positions : [];
  return {
    uid: row.uid,
    email: row.email || '',
    name: row.name || 'Trader',
    photoURL: row.photo_url || '',
    bio: row.bio || '',
    virtualBalance: Number(row.virtual_balance),
    lifetimeRealizedPnl: Number(row.lifetime_realized_pnl) || 0,
    followers: row.followers || [],
    following: row.following || [],
    watchlist: row.watchlist || [],
    presenceOnline: !!row.presence_online,
    lastSeenAt: row.last_seen_at,
    positions,
    closedPositions,
    portfolio: row.portfolio || [],
    dailyTradesDate: row.daily_trades_date || '',
    dailyTradesCount: Number(row.daily_trades_count) || 0,
    dailyAdTradeBonus: Number(row.daily_ad_trade_bonus) || 0,
    dailyTwelveRewardClaimedDate: row.daily_twelve_reward_claimed_date || '',
    isPaidMember: row.is_paid_member === true,
    paidPlanType: row.paid_plan_type ? String(row.paid_plan_type) : null,
    paidMemberUntil: row.paid_member_until ? new Date(row.paid_member_until).toISOString() : null,
    credsPaidBonus: Number(row.creds_paid_bonus) || 0
  };
}

module.exports = { rowToAppUser };
