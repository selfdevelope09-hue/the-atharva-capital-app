import { auth } from '../firebaseClient';
import { isPostgresDataMode } from '../config/dataBackend';
import { resolveRealtimeServerUrl } from '../config/realtimeServer';

const PROD_BFF_ORIGIN = 'https://www.theatharvacapital.com';
const BFF_TIMEOUT_MS = 12000;
const BFF_ME_TIMEOUT_MS = 15000;
const BFF_TRADE_TIMEOUT_MS = 50000;

function isNativeCapacitor() {
  try {
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function resolveBffBase() {
  if (isPostgresDataMode()) {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host && !/^(localhost|127\.0\.0\.1)$/i.test(host)) {
        return window.location.origin.replace(/\/$/, '');
      }
    }
    return resolveRealtimeServerUrl().replace(/\/$/, '');
  }
  const fromEnv = String(process.env.REACT_APP_BFF_BASE_URL || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') {
    if (isNativeCapacitor()) return PROD_BFF_ORIGIN;
    const host = window.location.hostname;
    if (host && !/^(localhost|127\.0\.0\.1)$/i.test(host)) {
      return window.location.origin.replace(/\/$/, '');
    }
  }
  return PROD_BFF_ORIGIN;
}

/** No trailing slash. Required for Capacitor (https://localhost) and local `npm start` when APIs are on Vercel. */
const BFF_BASE = resolveBffBase();
function resolveBffUrl(path) {
  const p = String(path || '');
  if (/^https?:\/\//i.test(p)) return p;
  if (!p.startsWith('/')) return `${BFF_BASE}/${p}`;
  return `${BFF_BASE}${p}`;
}

async function getToken() {
  await auth.authStateReady();
  const u = auth.currentUser;
  if (!u) throw new Error('Not signed in');
  return u.getIdToken();
}

/**
 * Authenticated fetch to Vercel `/api/*` routes (Firebase ID token).
 * @param {string} path e.g. `/api/data/me`
 * @param {RequestInit} options
 */
/** Unauthenticated API (e.g. AuronX ID login). */
export async function bffPublic(path, options = {}) {
  const { timeoutMs, ...fetchOptions } = options;
  const headers = { ...fetchOptions.headers };
  if (fetchOptions.body != null && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const url = resolveBffUrl(path);
  const controller = new AbortController();
  const limit = Number(timeoutMs) > 0 ? Number(timeoutMs) : BFF_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), limit);
  let r;
  try {
    r = await fetch(url, { ...fetchOptions, headers, signal: controller.signal });
  } catch (e) {
    if (e?.name === 'AbortError') {
      const err = new Error('Request timed out. Check your connection and try again.');
      err.status = 408;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data?.error || `HTTP ${r.status}`);
    err.status = r.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export async function bff(path, options = {}) {
  const { timeoutMs, ...fetchOptions } = options;
  const token = await getToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    ...fetchOptions.headers
  };
  if (fetchOptions.body != null && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const url = resolveBffUrl(path);
  const controller = new AbortController();
  const limit = Number(timeoutMs) > 0 ? Number(timeoutMs) : BFF_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), limit);
  let r;
  try {
    r = await fetch(url, { ...fetchOptions, headers, signal: controller.signal });
  } catch (e) {
    if (e?.name === 'AbortError') {
      const err = new Error('Request timed out. Check your connection and try again.');
      err.status = 408;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(j.error || r.statusText || `HTTP ${r.status}`);
    err.status = r.status;
    err.payload = j;
    throw err;
  }
  return j;
}

/** Open/close trades — longer timeout (cold start + Supabase + optional Firestore seed). */
export function bffTrade(path, options = {}) {
  return bff(path, { ...options, timeoutMs: BFF_TRADE_TIMEOUT_MS });
}
