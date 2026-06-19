import { auth } from '../firebaseClient';

const PROD_ORIGIN = 'https://www.theatharvacapital.com';

export function resolveTvStorageApiBase() {
  const fromEnv = String(process.env.REACT_APP_BFF_BASE_URL || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && !/^(localhost|127\.0\.0\.1)$/i.test(host)) {
      return window.location.origin.replace(/\/$/, '');
    }
  }
  return PROD_ORIGIN;
}

function cacheKey(uid) {
  return `auron_tv_chart_${uid}`;
}

/** Stable TradingView storage user id per Firebase uid (maps on server). */
export async function fetchTvChartUserId() {
  const u = auth.currentUser;
  if (!u) return null;

  try {
    const raw = sessionStorage.getItem(cacheKey(u.uid));
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached?.chartUserId && Number(cached.expiresAt) > Date.now() + 60000) {
        return {
          chartUserId: cached.chartUserId,
          clientId: cached.clientId || 'auronx',
          expiresAt: cached.expiresAt
        };
      }
    }
  } catch {
    /* ignore */
  }

  const token = await u.getIdToken();
  const base = resolveTvStorageApiBase();
  const res = await fetch(`${base}/api/tv/chart-key`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok || !data.chartUserId) {
    throw new Error(data.error || 'Could not enable chart save');
  }
  const out = {
    chartUserId: data.chartUserId,
    clientId: data.clientId || 'auronx',
    expiresAt: data.expiresAt
  };
  try {
    sessionStorage.setItem(cacheKey(u.uid), JSON.stringify(out));
  } catch {
    /* ignore */
  }
  return out;
}
