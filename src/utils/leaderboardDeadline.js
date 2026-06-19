import { LEADERBOARD_ENDS_LABEL } from '../content/leaderboardPromo';
import { formatDurationMs } from './istMarketWindows';

const TZ = 'Asia/Kolkata';

/** Parse "30 June, 11:59 PM" or "30 June (last day, IST)" → end instant in IST. */
function parseEndsLabel(label) {
  const raw = String(label || '');
  const m = raw.match(/(\d{1,2})\s+(\w+),?\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) {
    const dayOnly = raw.match(/(\d{1,2})\s+(\w+)/i);
    if (!dayOnly) return null;
    const months = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12
    };
    const mon = months[String(dayOnly[2]).slice(0, 3).toLowerCase()];
    if (!mon) return null;
    return { d: parseInt(dayOnly[1], 10), m: mon, hour: 23, minute: 59 };
  }
  const months = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12
  };
  const mon = months[String(m[2]).slice(0, 3).toLowerCase()];
  if (!mon) return null;
  let hour = parseInt(m[3], 10);
  const minute = parseInt(m[4], 10);
  const ampm = String(m[5]).toUpperCase();
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return { d: parseInt(m[1], 10), m: mon, hour, minute };
}

function istMidnightUtc(y, m, d) {
  let t = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 6 * 60 * 60 * 1000;
  for (let i = 0; i < 48; i += 1) {
    const dateKey = new Date(t).toLocaleDateString('sv-SE', { timeZone: TZ });
    const [yy, mm, dd] = dateKey.split('-').map(Number);
    if (yy === y && mm === m && dd === d) break;
    const tag = yy * 10000 + mm * 100 + dd;
    const want = y * 10000 + m * 100 + d;
    t += tag < want ? 60 * 60 * 1000 : -60 * 60 * 1000;
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date(t));
  const o = {};
  parts.forEach((p) => {
    if (p.type !== 'literal') o[p.type] = Number(p.value);
  });
  return t - ((o.hour * 60 + o.minute) * 60 + o.second) * 1000;
}

/** Epoch ms for campaign end (10:00 PM IST on date in LEADERBOARD_ENDS_LABEL). */
export function leaderboardCampaignEndMs(nowMs = Date.now()) {
  const parsed = parseEndsLabel(LEADERBOARD_ENDS_LABEL);
  if (!parsed) return null;
  const y = new Date(nowMs).toLocaleDateString('en-US', { timeZone: TZ, year: 'numeric' });
  const year = Number(y);
  const midnight = istMidnightUtc(year, parsed.m, parsed.d);
  return midnight + parsed.hour * 3600000 + parsed.minute * 60000;
}

export function leaderboardCampaignCountdown(nowMs = Date.now()) {
  const endMs = leaderboardCampaignEndMs(nowMs);
  if (!endMs) return null;
  const remaining = endMs - nowMs;
  if (remaining <= 0) return { ended: true, endMs, label: LEADERBOARD_ENDS_LABEL, remainingMs: 0, text: '0s' };
  return {
    ended: false,
    endMs,
    label: LEADERBOARD_ENDS_LABEL,
    remainingMs: remaining,
    text: formatDurationMs(remaining)
  };
}
