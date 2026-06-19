const TRADING_DAY_TZ = 'Asia/Kolkata';
const MAX_DAILY_OPENS = 3;
const MAX_AD_TRADE_BONUS_SLOTS = 5;

function tradingDayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TRADING_DAY_TZ });
}

module.exports = {
  tradingDayKey,
  MAX_DAILY_OPENS,
  MAX_AD_TRADE_BONUS_SLOTS,
  TRADING_DAY_TZ
};
