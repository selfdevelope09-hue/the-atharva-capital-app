const TRADING_DAY_TZ = 'Asia/Kolkata';
const MAX_DAILY_OPENS = 3;
const MAX_AD_TRADE_BONUS_SLOTS = 5;
const { isPaidRow, getDailyOpensForRow } = require('./paidPlan');

function getBaseDailyOpens(row) {
  const paid = getDailyOpensForRow(row);
  if (paid != null) return paid;
  return MAX_DAILY_OPENS;
}

function tradingDayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TRADING_DAY_TZ });
}

function yesterdayTradingDayKey() {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toLocaleDateString('en-CA', { timeZone: TRADING_DAY_TZ });
}

module.exports = {
  TRADING_DAY_TZ,
  MAX_DAILY_OPENS,
  MAX_AD_TRADE_BONUS_SLOTS,
  DAILY_OPENS_FOR_USD_BONUS: 8,
  USD_BONUS_ON_TWELVE_OPENS: 1000,
  tradingDayKey,
  yesterdayTradingDayKey,
  isPaidRow,
  getBaseDailyOpens
};
