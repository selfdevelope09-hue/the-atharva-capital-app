/** Leaderboard campaign — poster + Winners section copy (June 2026). */

import {
  LEADERBOARD_PERIOD_LABEL,
  LEADERBOARD_FREEZE_LABEL,
  LEADERBOARD_PAYOUT_LABEL,
  MONTHLY_LEADERBOARD_PRIZES_INR
} from '../utils/rewardConstants';

export const LEADERBOARD_PROMO_POSTER_URL = '/promo/leaderboard-june-2026-poster.png?v=20260601';

/** Full-screen poster on app open (Wallet paid plans campaign). */
export const STARTUP_PROMO_POSTER_URL = '/promo/paid-plans-poster.png?v=20260530';

export const LEADERBOARD_PERIOD = LEADERBOARD_PERIOD_LABEL;
export const LEADERBOARD_ENDS_LABEL = LEADERBOARD_FREEZE_LABEL;
export const WINNERS_ANNOUNCE_LABEL = LEADERBOARD_FREEZE_LABEL;
export const PAYOUT_LABEL = LEADERBOARD_PAYOUT_LABEL;

/** Leaderboard top banner — paid plans. */
export const LEADERBOARD_MONTHLY_EARN_INR = '₹11,000';
export const LEADERBOARD_PAID_PROMO_HEADLINE = `Earn ${LEADERBOARD_MONTHLY_EARN_INR} this month`;
export const LEADERBOARD_PAID_PROMO_SUB =
  'Climb the leaderboard for real UPI prizes. Basic, Pro, or Ultimate Pro — more daily trades, verified badge & bigger practice balance.';

const PRIZE_TONES = ['#f0b90b', '#c0c7d1', '#cd7f32', '#9aa4b2', '#9aa4b2'];

export const MONTHLY_PRIZES_INR = MONTHLY_LEADERBOARD_PRIZES_INR.map((p, i) => ({
  rank: p.rank,
  place: `${p.label} Prize`,
  amount: `₹${p.amount.toLocaleString('en-IN')}`,
  tone: PRIZE_TONES[Math.min(i, PRIZE_TONES.length - 1)]
}));

export const WINNERS_STEPS = [
  {
    step: 1,
    title: 'Winners list',
    body: `After ${WINNERS_ANNOUNCE_LABEL} the top 10 will appear in the Winners section.`,
    icon: '🏆'
  },
  {
    step: 2,
    title: 'Send QR code',
    body: 'Winners open Chat and message Atharva Darshanwar directly with their QR code for payout.',
    icon: '📱'
  },
  {
    step: 3,
    title: 'Payout',
    body: `Prizes are paid manually on ${PAYOUT_LABEL}.`,
    icon: '💳'
  }
];
