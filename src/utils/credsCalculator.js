/** Client-side creds math (mirrors server/src/lib/credsCalculator.js). */

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function deriveTradeStatsFromUser(userData) {
  const closed = Array.isArray(userData?.closedPositions) ? userData.closedPositions : [];
  const open = Array.isArray(userData?.positions) ? userData.positions : [];
  let profitTrades = 0;
  const symbols = new Set();
  closed.forEach((p) => {
    const sym = String(p?.symbol || p?.pair || '').toUpperCase();
    if (sym) symbols.add(sym);
    const pnl = num(p?.realizedPnl ?? p?.grossPnl);
    if (pnl > 0) profitTrades += 1;
  });
  open.forEach((p) => {
    const sym = String(p?.symbol || p?.pair || '').toUpperCase();
    if (sym) symbols.add(sym);
  });
  const totalTrades = closed.length;
  const winRate = totalTrades > 0 ? (profitTrades / totalTrades) * 100 : 0;
  return { totalTrades, profitTrades, winRate, uniquePairsTradedCount: symbols.size };
}

export function isShowcaseCredsAccount(userData) {
  return (
    userData?.isShowcase === true ||
    userData?.isShowcaseProfile === true ||
    String(userData?.uid || '').startsWith('showcase__')
  );
}

export function calculateUserCreds(userData) {
  const trade = deriveTradeStatsFromUser(userData);
  const activeDays = num(userData?.credsActiveDays ?? userData?.activeDays);
  const totalMinutesOnline = num(userData?.totalMinutesOnline);
  const currentStreakDays = num(userData?.credsStreakDays ?? userData?.currentStreakDays);
  const liquidationsCount = num(userData?.credsLiquidationsCount ?? userData?.liquidationsCount);

  let finalCreds = 100;
  finalCreds += activeDays * 5;
  finalCreds += Math.floor(totalMinutesOnline / 30) * 5;
  finalCreds += trade.totalTrades * 1;
  finalCreds += trade.profitTrades * 3;
  finalCreds += trade.winRate * 2;
  if (trade.uniquePairsTradedCount >= 5) finalCreds += 15;
  finalCreds += currentStreakDays * 10;
  finalCreds -= liquidationsCount * 20;
  finalCreds += Math.max(0, num(userData?.credsPaidBonus ?? userData?.creds_paid_bonus));
  if (finalCreds < 0) finalCreds = 0;
  let score = Math.round(finalCreds);
  return score;
}

export function badgeTierForScore(finalCreds) {
  const s = num(finalCreds);
  if (s >= 501) return { tier: 'alpha', label: '👑 Alpha Whale' };
  if (s >= 301) return { tier: 'gold', label: '🥇 Gold Trader' };
  if (s >= 151) return { tier: 'silver', label: '🥈 Silver Trader' };
  return { tier: 'bronze', label: '🥉 Bronze Trader' };
}

export function badgeForUserData(userData) {
  return badgeTierForScore(calculateUserCreds(userData));
}
