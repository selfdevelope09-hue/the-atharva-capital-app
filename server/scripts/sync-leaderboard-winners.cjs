#!/usr/bin/env node
/** One-shot: sync top 10 winners from live leaderboard into platform_config. */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { syncLeaderboardWinnersFromLive } = require('../src/lib/leaderboardCampaign');

(async () => {
  const r = await syncLeaderboardWinnersFromLive();
  console.log('ok', r.synced, 'winners:', (r.winners || []).map((w) => `${w.rank}. ${w.name}`).join(' | '));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
