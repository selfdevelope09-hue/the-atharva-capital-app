const { getPool } = require('../db/pool');
const { rowToClient } = require('./userRowMap');
const { sumClosedRealizedPnl } = require('./tradingMath');
const { EFFECTIVE_PNL_SQL } = require('./leaderboardPnl');

function mapUserToLeaderboardRow(row, showcasePnl = 0) {
  const c = rowToClient(row);
  const realizedPnlTotal = Math.max(
    Number(c.lifetimeRealizedPnl) || 0,
    sumClosedRealizedPnl(c.closedPositions),
    Number(showcasePnl) || 0
  );
  const extra = {};
  if (row.is_showcase_profile || String(c.uid || '').startsWith('showcase__')) {
    extra.showcasePresenceOnline = row.showcase_presence_online === true;
    extra.showcasePresenceExplicitOffline = row.showcase_presence_online === false;
    if (row.showcase_presence_offline_at) {
      extra.showcasePresenceOfflineAt = new Date(row.showcase_presence_offline_at).toISOString();
    }
  }
  return { ...c, ...extra, id: c.uid, realizedPnlTotal };
}

/** Live board: users + showcase P/L (whichever is higher per profile). */
async function queryLiveLeaderboardRows(limit = 500) {
  const TOP = Math.max(10, Math.min(800, limit));
  const { rows: topRows } = await getPool().query(
    `select u.uid, u.email, u.name, u.photo_url, u.bio, u.virtual_balance, u.lifetime_realized_pnl,
      u.followers, u.following, u.watchlist, u.presence_online, u.last_seen_at,
      u.positions, u.closed_positions, u.portfolio,
      u.daily_trades_date, u.daily_trades_count, u.daily_ad_trade_bonus, u.daily_twelve_reward_claimed_date,
      coalesce(u.is_showcase_profile, false) as is_showcase_profile,
      coalesce(u.is_paid_member, false) as is_paid_member,
      u.paid_plan_type, u.paid_member_until,
      u.showcase_presence_online, u.showcase_presence_offline_at,
      coalesce(u.account_removed, false) as account_removed,
      coalesce(ls.pnl, 0) as showcase_board_pnl
     from users u
     left join leaderboard_showcase ls on ls.profile_uid = u.uid
     order by ${EFFECTIVE_PNL_SQL} desc nulls last,
     u.virtual_balance desc nulls last,
     u.updated_at desc nulls last
     limit $1`,
    [TOP]
  );

  const byUid = new Map();
  for (const row of topRows) {
    byUid.set(row.uid, mapUserToLeaderboardRow(row, row.showcase_board_pnl));
  }

  const { rows: extraShowcase } = await getPool().query(
    `select ls.profile_uid, ls.pnl, ls.display_name
     from leaderboard_showcase ls
     where ls.profile_uid is not null
       and not exists (
         select 1 from users u where u.uid = ls.profile_uid
       )
     order by ls.pnl desc nulls last
     limit 40`
  );

  for (const sc of extraShowcase) {
    const uid = sc.profile_uid;
    if (!uid || byUid.has(uid)) continue;
    const { rows: uRows } = await getPool().query(
      `select uid, email, name, photo_url, bio, virtual_balance, lifetime_realized_pnl,
        followers, following, watchlist, presence_online, last_seen_at,
        positions, closed_positions, portfolio,
        daily_trades_date, daily_trades_count, daily_ad_trade_bonus, daily_twelve_reward_claimed_date,
        coalesce(is_showcase_profile, false) as is_showcase_profile,
        coalesce(is_paid_member, false) as is_paid_member,
        paid_plan_type, paid_member_until,
        showcase_presence_online, showcase_presence_offline_at,
        coalesce(account_removed, false) as account_removed
       from users where uid = $1`,
      [uid]
    );
    if (uRows[0]) {
      byUid.set(uid, mapUserToLeaderboardRow(uRows[0], sc.pnl));
    }
  }

  const rows = Array.from(byUid.values());
  rows.sort((a, b) => {
    const diff = b.realizedPnlTotal - a.realizedPnlTotal;
    if (diff !== 0) return diff;
    return (b.virtualBalance || 0) - (a.virtualBalance || 0);
  });
  return rows.slice(0, TOP);
}

module.exports = { queryLiveLeaderboardRows, mapUserToLeaderboardRow };
