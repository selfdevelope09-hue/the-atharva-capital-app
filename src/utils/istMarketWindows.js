/** Asia/Kolkata calendar windows for leaderboard + countdown copy. */

const TZ = 'Asia/Kolkata';

function istParts(ms) {
  const d = new Date(ms);
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = f.formatToParts(d);
  const o = {};
  parts.forEach((p) => {
    if (p.type !== 'literal') o[p.type] = p.value;
  });
  const wk = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    y: Number(o.year),
    m: Number(o.month),
    d: Number(o.day),
    dow: wk[o.weekday] ?? 0,
    hour: Number(o.hour),
    minute: Number(o.minute),
    second: Number(o.second)
  };
}

/** UTC epoch ms for IST wall-clock y-m-d 00:00:00 (India has no DST). */
function istMidnightUtc(y, m, d) {
  let t = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 6 * 60 * 60 * 1000;
  for (let i = 0; i < 48; i++) {
    const dateKey = new Date(t).toLocaleDateString('sv-SE', { timeZone: TZ });
    const [yy, mm, dd] = dateKey.split('-').map(Number);
    if (yy === y && mm === m && dd === d) break;
    const tag = yy * 10000 + mm * 100 + dd;
    const want = y * 10000 + m * 100 + d;
    t += tag < want ? 60 * 60 * 1000 : -60 * 60 * 1000;
  }
  const p = istParts(t);
  return t - ((p.hour * 60 + p.minute) * 60 + p.second) * 1000;
}

function addDaysUtc(y, m, d, delta) {
  const t = istMidnightUtc(y, m, d);
  return t + delta * 24 * 60 * 60 * 1000;
}

/**
 * Monday 00:00 IST (inclusive) → next Monday 00:00 IST (exclusive).
 * @returns {{ start: number, end: number }}
 */
export function istCalendarWeekRange(nowMs = Date.now()) {
  const p = istParts(nowMs);
  const mondayDow = 1;
  const daysFromMonday = (p.dow - mondayDow + 7) % 7;
  const start = addDaysUtc(p.y, p.m, p.d, -daysFromMonday);
  const end = start + 7 * 24 * 60 * 60 * 1000;
  return { start, end };
}

/**
 * 1st 00:00 IST (inclusive) → 1st of next month 00:00 IST (exclusive).
 */
export function istCalendarMonthRange(nowMs = Date.now()) {
  const p = istParts(nowMs);
  const start = istMidnightUtc(p.y, p.m, 1);
  const ny = p.m === 12 ? p.y + 1 : p.y;
  const nm = p.m === 12 ? 1 : p.m + 1;
  const end = istMidnightUtc(ny, nm, 1);
  return { start, end };
}

export function formatDurationMs(ms) {
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h || d) parts.push(`${h}h`);
  if (m || h || d) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}
