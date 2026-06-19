import { DAILY_OPENS_TARGET_FOR_USD_BONUS, DAILY_FULL_TRADES_USD_BONUS } from './rewardConstants';
import { getDailyOpenTradesUsed, tradingDayKey } from './tradingDayLimit';

export function getDailyTwelveRewardStatus(userData) {
  const used = getDailyOpenTradesUsed(userData);
  const key = tradingDayKey();
  const claimed =
    userData?.dailyTwelveRewardClaimedDate != null &&
    String(userData.dailyTwelveRewardClaimedDate).slice(0, 10) === key;
  return {
    used,
    target: DAILY_OPENS_TARGET_FOR_USD_BONUS,
    remaining: Math.max(0, DAILY_OPENS_TARGET_FOR_USD_BONUS - used),
    claimedToday: claimed,
    bonusUsd: DAILY_FULL_TRADES_USD_BONUS,
    done: used >= DAILY_OPENS_TARGET_FOR_USD_BONUS
  };
}
