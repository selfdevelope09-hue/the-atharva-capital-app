/** Calendar day for daily trade caps (India). */

import {

  isPaidMember,

  getDailyOpensForUser,

  BASIC_DAILY_OPENS,

  PRO_DAILY_OPENS

} from '../config/paidPlan';



export const TRADING_DAY_TZ = 'Asia/Kolkata';

export const MAX_DAILY_OPENS = 3;

export const MAX_AD_TRADE_BONUS_SLOTS = 5;



export function tradingDayKey() {

  return new Date().toLocaleDateString('en-CA', { timeZone: TRADING_DAY_TZ });

}



export function getDailyOpenTradesUsed(userData) {

  if (!userData || typeof userData !== 'object') return 0;

  const key = tradingDayKey();

  const saved = userData.dailyTradesDate != null ? String(userData.dailyTradesDate).slice(0, 10) : '';

  if (saved !== key) return 0;

  const n = Number(userData.dailyTradesCount);

  if (!Number.isFinite(n) || n < 0) return 0;

  return n;

}



export function getAdTradeBonusEarned(userData) {

  if (isPaidMember(userData)) return 0;

  if (!userData || typeof userData !== 'object') return 0;

  const key = tradingDayKey();

  const saved = userData.dailyTradesDate != null ? String(userData.dailyTradesDate).slice(0, 10) : '';

  if (saved !== key) return 0;

  const n = Number(userData.dailyAdTradeBonus);

  if (!Number.isFinite(n) || n < 0) return 0;

  return Math.min(MAX_AD_TRADE_BONUS_SLOTS, n);

}



export function getBaseDailyOpenLimit(userData) {

  const paidOpens = getDailyOpensForUser(userData);

  if (paidOpens != null) return paidOpens;

  return MAX_DAILY_OPENS;

}



export function getEffectiveDailyOpenLimit(userData) {

  if (!userData || typeof userData !== 'object') return MAX_DAILY_OPENS;

  return getBaseDailyOpenLimit(userData) + getAdTradeBonusEarned(userData);

}



export function getDailyOpenTradesRemaining(userData) {

  const cap = getEffectiveDailyOpenLimit(userData);

  const used = getDailyOpenTradesUsed(userData);

  return Math.max(0, cap - used);

}



export function getAdTradeBonusRemainingSlots(userData) {

  if (isPaidMember(userData)) return 0;

  return Math.max(0, MAX_AD_TRADE_BONUS_SLOTS - getAdTradeBonusEarned(userData));

}



export { isPaidMember, BASIC_DAILY_OPENS as PAID_DAILY_OPENS, BASIC_DAILY_OPENS, PRO_DAILY_OPENS };


