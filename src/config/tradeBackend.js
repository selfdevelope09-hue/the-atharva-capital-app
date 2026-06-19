import { resolveRealtimeServerUrl } from './realtimeServer';

/**
 * Socket.io trades on web only when the realtime URL is HTTPS/WSS-safe.
 * Otherwise HTTP BFF (same-origin → Vercel proxy → DO Postgres) is used.
 */
export function isRealtimeTradeMode() {
  if (typeof window === 'undefined') return true;
  const server = resolveRealtimeServerUrl();
  if (window.location.protocol === 'https:' && /^http:\/\//i.test(server)) {
    return false;
  }
  return true;
}
