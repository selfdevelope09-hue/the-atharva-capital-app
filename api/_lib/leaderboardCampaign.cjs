const CAMPAIGN_KEY = '2026-06';
/** 1 July 2026 00:00 IST — end of June campaign window. */
const CAMPAIGN_END_MS = 1782846000000;

function isAppSettingsLeaderboardFrozen(st) {
  if (!st?.leaderboard_frozen || !st.leaderboard_snapshot?.rows?.length) return false;
  const month = st.leaderboard_snapshot?.monthIst || st.frozen_month_ist || '';
  if (month !== CAMPAIGN_KEY) return false;
  if (Date.now() < CAMPAIGN_END_MS) return false;
  return true;
}

module.exports = { CAMPAIGN_KEY, CAMPAIGN_END_MS, isAppSettingsLeaderboardFrozen };
