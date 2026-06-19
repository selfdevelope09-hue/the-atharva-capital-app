const BASIC_DAILY_OPENS = 20;
const PRO_DAILY_OPENS = 30;
const ULTIMATE_PRO_DAILY_OPENS = 50;
const BASIC_CREDS_BONUS = 200;
const PRO_CREDS_BONUS = 300;
const ULTIMATE_PRO_CREDS_BONUS = 500;
const FREE_START_BALANCE = 10000;
const BASIC_START_BALANCE = 20000;
const PRO_START_BALANCE = 50000;
const ULTIMATE_PRO_START_BALANCE = 250000;
const BASIC_PRICE_INR = 49;
const PRO_PRICE_INR = 99;
const ULTIMATE_PRO_PRICE_INR = 250;
const BASIC_FREE_RESET_LIMIT = 3;
const PRO_FREE_RESET_LIMIT = 5;
const ULTIMATE_PRO_FREE_RESET_LIMIT = 10;

function normalizePlanType(v) {
  const s = String(v || '').trim().toLowerCase();
  if (s === 'basic' || s === 'pro' || s === 'ultimate_pro') return s;
  return null;
}

function planConfig(planType) {
  const t = normalizePlanType(planType);
  if (t === 'ultimate_pro') {
    return {
      planType: 'ultimate_pro',
      label: 'Ultimate Pro',
      priceInr: ULTIMATE_PRO_PRICE_INR,
      dailyOpens: ULTIMATE_PRO_DAILY_OPENS,
      credsBonus: ULTIMATE_PRO_CREDS_BONUS,
      startBalance: ULTIMATE_PRO_START_BALANCE,
      freeResets: ULTIMATE_PRO_FREE_RESET_LIMIT,
      fastSupport: true
    };
  }
  if (t === 'pro') {
    return {
      planType: 'pro',
      label: 'Pro',
      priceInr: PRO_PRICE_INR,
      dailyOpens: PRO_DAILY_OPENS,
      credsBonus: PRO_CREDS_BONUS,
      startBalance: PRO_START_BALANCE,
      freeResets: PRO_FREE_RESET_LIMIT,
      fastSupport: true
    };
  }
  if (t === 'basic') {
    return {
      planType: 'basic',
      label: 'Basic',
      priceInr: BASIC_PRICE_INR,
      dailyOpens: BASIC_DAILY_OPENS,
      credsBonus: BASIC_CREDS_BONUS,
      startBalance: BASIC_START_BALANCE,
      freeResets: BASIC_FREE_RESET_LIMIT,
      fastSupport: false
    };
  }
  return null;
}

function isPaidRow(row) {
  if (!row || row.is_paid_member !== true) return false;
  const plan = normalizePlanType(row.paid_plan_type);
  if (!plan) return false;
  if (row.paid_member_until) {
    const untilMs = new Date(row.paid_member_until).getTime();
    if (Number.isFinite(untilMs) && untilMs <= Date.now()) return false;
  }
  return true;
}

function getDailyOpensForRow(row) {
  if (!isPaidRow(row)) return null;
  return planConfig(row.paid_plan_type)?.dailyOpens ?? BASIC_DAILY_OPENS;
}

function addOneMonth(fromDate = new Date()) {
  const d = new Date(fromDate);
  d.setMonth(d.getMonth() + 1);
  return d;
}

/** Balance after admin/mass trading reset (paid plan tier or free $10k). */
function virtualBalanceAfterTradingReset(row) {
  if (isPaidRow(row)) {
    const cfg = planConfig(row.paid_plan_type);
    if (cfg) return cfg.startBalance;
  }
  return FREE_START_BALANCE;
}

/** Postgres expression: set virtual_balance from paid_plan_type on reset. */
const VIRTUAL_BALANCE_ON_TRADING_RESET_SQL = `case
  when coalesce(is_paid_member, false) = true
    and lower(trim(coalesce(paid_plan_type, ''))) = 'ultimate_pro'
    and (paid_member_until is null or paid_member_until > now())
  then ${ULTIMATE_PRO_START_BALANCE}
  when coalesce(is_paid_member, false) = true
    and lower(trim(coalesce(paid_plan_type, ''))) = 'pro'
    and (paid_member_until is null or paid_member_until > now())
  then ${PRO_START_BALANCE}
  when coalesce(is_paid_member, false) = true
    and lower(trim(coalesce(paid_plan_type, ''))) = 'basic'
    and (paid_member_until is null or paid_member_until > now())
  then ${BASIC_START_BALANCE}
  else ${FREE_START_BALANCE}
end`;

module.exports = {
  BASIC_DAILY_OPENS,
  PRO_DAILY_OPENS,
  ULTIMATE_PRO_DAILY_OPENS,
  BASIC_CREDS_BONUS,
  PRO_CREDS_BONUS,
  ULTIMATE_PRO_CREDS_BONUS,
  FREE_START_BALANCE,
  BASIC_START_BALANCE,
  PRO_START_BALANCE,
  ULTIMATE_PRO_START_BALANCE,
  virtualBalanceAfterTradingReset,
  VIRTUAL_BALANCE_ON_TRADING_RESET_SQL,
  BASIC_PRICE_INR,
  PRO_PRICE_INR,
  ULTIMATE_PRO_PRICE_INR,
  BASIC_FREE_RESET_LIMIT,
  PRO_FREE_RESET_LIMIT,
  ULTIMATE_PRO_FREE_RESET_LIMIT,
  normalizePlanType,
  planConfig,
  isPaidRow,
  getDailyOpensForRow,
  addOneMonth
};
