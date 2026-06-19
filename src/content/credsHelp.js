/** Copy for “How creds are calculated” — same rules for everyone on the ratings board. */

export const CREDS_FORMULA_LINES = [
  { label: 'Base score', detail: 'Everyone starts at 100 points.' },
  { label: 'Active days', detail: '+5 points for each day you were active on the app (IST calendar day, tab focused for at least one minute).' },
  { label: 'Screen time', detail: '+5 points for every 30 full minutes online while the app tab is open and focused.' },
  { label: 'Total trades', detail: '+1 point per closed virtual trade.' },
  { label: 'Profitable trades', detail: '+3 points per closed trade with positive realized P/L.' },
  { label: 'Win rate', detail: '+2 points × your win rate % (profitable closes ÷ total closes × 100).' },
  { label: 'Diversification', detail: '+15 bonus if you traded 5 or more different pairs/symbols.' },
  { label: 'Daily streak', detail: '+10 points per day in your current active-day streak.' },
  { label: 'Liquidations', detail: '−20 points per liquidated position.' },
  { label: 'Floor', detail: 'Score cannot go below 0.' }
];

export const CREDS_TIER_LINES = [
  '🥉 Bronze Trader — 0 to 150',
  '🥈 Silver Trader — 151 to 300',
  '🥇 Gold Trader — 301 to 500',
  '👑 Alpha Whale — 501+'
];
