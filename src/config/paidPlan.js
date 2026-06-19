import { platformOwnerChatPath } from './platformOwner';

export const PLAN_BASIC = 'basic';
export const PLAN_PRO = 'pro';
export const PLAN_ULTIMATE_PRO = 'ultimate_pro';

export const BASIC_PRICE_INR = 49;
export const PRO_PRICE_INR = 99;
export const ULTIMATE_PRO_PRICE_INR = 250;
export const BASIC_DAILY_OPENS = 20;
export const PRO_DAILY_OPENS = 30;
export const ULTIMATE_PRO_DAILY_OPENS = 50;
export const BASIC_CREDS_BONUS = 200;
export const PRO_CREDS_BONUS = 300;
export const ULTIMATE_PRO_CREDS_BONUS = 500;
export const BASIC_START_BALANCE_USD = 20000;
export const PRO_START_BALANCE_USD = 50000;
export const ULTIMATE_PRO_START_BALANCE_USD = 250000;
export const BASIC_FREE_RESETS = 3;
export const PRO_FREE_RESETS = 5;
export const ULTIMATE_PRO_FREE_RESETS = 10;

/** Display order for plan cards and compare tables. */
export const PLAN_ORDER = [PLAN_BASIC, PLAN_PRO, PLAN_ULTIMATE_PRO];

export const PAID_PLAN_CHAT_PROMPT = 'I want to subscribe to a paid plan';

export const FREE_PLAN_FEATURES = [
  '3 trade opens per day (IST)',
  'Up to +5 extra opens via rewarded ads',
  'Standard order book',
  'Community chat & leaderboard',
  'Creds rating system'
];

export const BASIC_PLAN_FEATURES = [
  `$${BASIC_START_BALANCE_USD.toLocaleString()} plan wallet balance — credited as soon as your plan is activated`,
  `${BASIC_DAILY_OPENS} trade opens per day — active immediately, no ads`,
  'Premium order book — active immediately',
  'Verified blue badge everywhere',
  `+${BASIC_CREDS_BONUS} Creds points — active immediately`,
  `${BASIC_FREE_RESETS} free full account resets (wallet → $${BASIC_START_BALANCE_USD.toLocaleString()}, trades cleared)`,
  'Community & leaderboard access'
];

export const PRO_PLAN_FEATURES = [
  `$${PRO_START_BALANCE_USD.toLocaleString()} plan wallet balance — credited as soon as your plan is activated`,
  `${PRO_DAILY_OPENS} trade opens per day — active immediately, no ads`,
  'Premium order book — active immediately',
  'Verified blue badge everywhere',
  `+${PRO_CREDS_BONUS} Creds points — active immediately`,
  `${PRO_FREE_RESETS} free full account resets (wallet → $${PRO_START_BALANCE_USD.toLocaleString()}, trades cleared)`,
  'Fast priority support from AuronX team'
];

export const ULTIMATE_PRO_PLAN_FEATURES = [
  `$${ULTIMATE_PRO_START_BALANCE_USD.toLocaleString()} plan wallet balance — credited as soon as your plan is activated`,
  `${ULTIMATE_PRO_DAILY_OPENS} trade opens per day — active immediately, no ads`,
  'Premium order book — active immediately',
  'Verified blue badge + diamond tier badge everywhere',
  `+${ULTIMATE_PRO_CREDS_BONUS} Creds points — active immediately`,
  `${ULTIMATE_PRO_FREE_RESETS} free full account resets (wallet → $${ULTIMATE_PRO_START_BALANCE_USD.toLocaleString()}, trades cleared)`,
  'Ultimate priority support from AuronX team'
];

export const PLAN_CATALOG = {
  basic: {
    id: PLAN_BASIC,
    label: 'Basic',
    priceInr: BASIC_PRICE_INR,
    dailyOpens: BASIC_DAILY_OPENS,
    credsBonus: BASIC_CREDS_BONUS,
    startBalanceUsd: BASIC_START_BALANCE_USD,
    freeResets: BASIC_FREE_RESETS,
    features: BASIC_PLAN_FEATURES,
    accent: '#3897f0'
  },
  pro: {
    id: PLAN_PRO,
    label: 'Pro',
    priceInr: PRO_PRICE_INR,
    dailyOpens: PRO_DAILY_OPENS,
    credsBonus: PRO_CREDS_BONUS,
    startBalanceUsd: PRO_START_BALANCE_USD,
    freeResets: PRO_FREE_RESETS,
    features: PRO_PLAN_FEATURES,
    accent: '#a855f7',
    cardBg: 'rgba(168,85,247,0.08)',
    btnGradient: 'linear-gradient(135deg, #a855f7, #7c3aed)'
  },
  ultimate_pro: {
    id: PLAN_ULTIMATE_PRO,
    label: 'Ultimate Pro',
    priceInr: ULTIMATE_PRO_PRICE_INR,
    dailyOpens: ULTIMATE_PRO_DAILY_OPENS,
    credsBonus: ULTIMATE_PRO_CREDS_BONUS,
    startBalanceUsd: ULTIMATE_PRO_START_BALANCE_USD,
    freeResets: ULTIMATE_PRO_FREE_RESETS,
    features: ULTIMATE_PRO_PLAN_FEATURES,
    accent: '#38bdf8',
    cardBg: 'rgba(56,189,248,0.1)',
    btnGradient: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
    fastSupport: true,
    diamondBadge: true
  }
};

PLAN_CATALOG.basic.cardBg = 'rgba(0,149,246,0.08)';
PLAN_CATALOG.basic.btnGradient = 'linear-gradient(135deg, #0095F6, #1877f2)';

export function normalizePlanType(v) {
  const s = String(v || '').trim().toLowerCase();
  if (s === PLAN_BASIC || s === PLAN_PRO || s === PLAN_ULTIMATE_PRO) return s;
  return null;
}

export function isPaidMember(userData) {
  if (!userData || typeof userData !== 'object') return false;
  if (userData.isPaidMember !== true && userData.is_paid_member !== true) return false;
  const plan = normalizePlanType(userData.paidPlanType ?? userData.paid_plan_type);
  if (!plan) return false;
  const until = userData.paidMemberUntil ?? userData.paid_member_until;
  if (until) {
    const ms = new Date(until).getTime();
    if (Number.isFinite(ms) && ms <= Date.now()) return false;
  }
  return true;
}

/** Badge display — allows legacy rows with isPaidMember but missing plan type. */
export function showPaidBadge(userData) {
  if (!userData || typeof userData !== 'object') return false;
  if (userData.isPaidMember !== true && userData.is_paid_member !== true) return false;
  const until = userData.paidMemberUntil ?? userData.paid_member_until;
  if (until) {
    const ms = new Date(until).getTime();
    if (Number.isFinite(ms) && ms <= Date.now()) return false;
  }
  return true;
}

export function getDisplayPlanType(userData) {
  const t = normalizePlanType(userData?.paidPlanType ?? userData?.paid_plan_type);
  if (t) return t;
  return showPaidBadge(userData) ? PLAN_BASIC : null;
}

export function getPaidPlanType(userData) {
  if (!isPaidMember(userData)) return null;
  return normalizePlanType(userData.paidPlanType ?? userData.paid_plan_type);
}

export function getPlanConfig(userData) {
  const t = getPaidPlanType(userData);
  return t ? PLAN_CATALOG[t] : null;
}

export function getPlanLabel(userData) {
  return getPlanConfig(userData)?.label || null;
}

export function getDailyOpensForUser(userData) {
  const cfg = getPlanConfig(userData);
  if (cfg) return cfg.dailyOpens;
  return null;
}

export function paidPlanDaysLeft(userData) {
  const until = userData?.paidMemberUntil ?? userData?.paid_member_until;
  if (!until) return null;
  const ms = new Date(until).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function paidFreeResetLimit(userData) {
  const cfg = getPlanConfig(userData);
  return cfg?.freeResets ?? 0;
}

export function getPlanAdminLabel(planType) {
  const t = normalizePlanType(planType);
  return t ? PLAN_CATALOG[t].label : null;
}

export function paidFreeResetsUsed(userData) {
  return Math.max(0, Number(userData?.paidFreeResetsUsed ?? userData?.paid_free_resets_used) || 0);
}

export function paidFreeResetsRemaining(userData) {
  const limit = paidFreeResetLimit(userData);
  if (!limit) return 0;
  return Math.max(0, limit - paidFreeResetsUsed(userData));
}

export function paidBalanceResetLabel(userData) {
  const raw = userData?.paidBalanceResetAt ?? userData?.paid_balance_reset_at;
  if (!raw) return null;
  try {
    return new Date(raw).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
  } catch {
    return null;
  }
}

export function paidPlanChatPath(planType) {
  const base = platformOwnerChatPath();
  const plan = normalizePlanType(planType);
  const msg = encodeURIComponent(
    plan ? `I want to subscribe to the ${PLAN_CATALOG[plan].label} plan (₹${PLAN_CATALOG[plan].priceInr}/mo)` : PAID_PLAN_CHAT_PROMPT
  );
  return `${base}&msg=${msg}`;
}

/** @deprecated use BASIC_DAILY_OPENS */
export const PAID_DAILY_OPENS = BASIC_DAILY_OPENS;
export const PAID_PLAN_PRICE_INR = BASIC_PRICE_INR;
export const PAID_CREDS_BONUS = BASIC_CREDS_BONUS;
export const PAID_PLAN_FEATURES = BASIC_PLAN_FEATURES;
