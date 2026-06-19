function asArr(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    const vals = Object.values(v);
    if (vals.length && vals.some((x) => x && typeof x === 'object')) return vals;
  }
  return [];
}

function deriveTradeStats(row) {
  const closed = asArr(row?.closed_positions);
  const open = asArr(row?.positions);
  let profitTrades = 0;
  const symbols = new Set();
  closed.forEach((p) => {
    const sym = String(p?.symbol || p?.pair || '').toUpperCase();
    if (sym) symbols.add(sym);
    const pnl = Number(p?.realizedPnl ?? p?.grossPnl ?? 0);
    if (Number.isFinite(pnl) && pnl > 0) profitTrades += 1;
  });
  open.forEach((p) => {
    const sym = String(p?.symbol || p?.pair || '').toUpperCase();
    if (sym) symbols.add(sym);
  });
  const totalTrades = closed.length;
  const winRate = totalTrades > 0 ? (profitTrades / totalTrades) * 100 : 0;
  return {
    totalTrades,
    profitTrades,
    winRate,
    uniquePairsTradedCount: symbols.size
  };
}

function isShowcaseAccount(d) {
  const x = d || {};
  return (
    x.isShowcase === true ||
    x.is_showcase_profile === true ||
    String(x.uid || '').startsWith('showcase__')
  );
}

function calculateUserCreds(userData) {
  const d = userData || {};
  const activeDays = Math.max(0, Number(d.activeDays ?? d.credsActiveDays) || 0);
  const totalMinutesOnline = Math.max(0, Number(d.totalMinutesOnline ?? d.total_minutes_online) || 0);
  const totalTrades = Math.max(0, Number(d.totalTrades) || 0);
  const profitTrades = Math.max(0, Number(d.profitTrades) || 0);
  const winRate = Math.max(0, Number(d.winRate) || 0);
  const uniquePairsTradedCount = Math.max(0, Number(d.uniquePairsTradedCount) || 0);
  const currentStreakDays = Math.max(0, Number(d.currentStreakDays ?? d.credsStreakDays) || 0);
  const liquidationsCount = Math.max(0, Number(d.liquidationsCount ?? d.credsLiquidationsCount) || 0);

  let finalCreds = 100;
  finalCreds += activeDays * 5;
  finalCreds += Math.floor(totalMinutesOnline / 30) * 5;
  finalCreds += totalTrades * 1;
  finalCreds += profitTrades * 3;
  finalCreds += winRate * 2;
  if (uniquePairsTradedCount >= 5) finalCreds += 15;
  finalCreds += currentStreakDays * 10;
  finalCreds -= liquidationsCount * 20;
  finalCreds += Math.max(0, Number(d.credsPaidBonus ?? d.creds_paid_bonus) || 0);
  if (finalCreds < 0) finalCreds = 0;

  let score = Math.round(finalCreds);
  return score;
}

function badgeTierForScore(finalCreds) {
  const s = Number(finalCreds) || 0;
  if (s >= 501) return { tier: 'alpha', label: '👑 Alpha Whale', min: 501 };
  if (s >= 301) return { tier: 'gold', label: '🥇 Gold Trader', min: 301 };
  if (s >= 151) return { tier: 'silver', label: '🥈 Silver Trader', min: 151 };
  return { tier: 'bronze', label: '🥉 Bronze Trader', min: 0 };
}

function buildCredsProfileFromRow(row) {
  const trade = deriveTradeStats(row);
  const userData = {
    activeDays: row.creds_active_days,
    totalMinutesOnline: row.total_minutes_online,
    totalTrades: trade.totalTrades,
    profitTrades: trade.profitTrades,
    winRate: trade.winRate,
    uniquePairsTradedCount: trade.uniquePairsTradedCount,
    currentStreakDays: row.creds_streak_days,
    liquidationsCount: row.creds_liquidations_count,
    credsPaidBonus: row.creds_paid_bonus
  };
  const credsScore = calculateUserCreds(userData);
  const badge = badgeTierForScore(credsScore);
  return {
    uid: row.uid,
    name: row.name || 'Trader',
    photoURL: row.photo_url || '',
    credsScore,
    badgeLabel: badge.label,
    badgeTier: badge.tier,
    isPaidMember: row.is_paid_member === true,
    paidPlanType: row.paid_plan_type ? String(row.paid_plan_type) : null,
    ...trade,
    activeDays: userData.activeDays,
    totalMinutesOnline: userData.totalMinutesOnline,
    currentStreakDays: userData.currentStreakDays,
    liquidationsCount: userData.liquidationsCount
  };
}

module.exports = {
  calculateUserCreds,
  isShowcaseAccount,
  badgeTierForScore,
  deriveTradeStats,
  buildCredsProfileFromRow
};
