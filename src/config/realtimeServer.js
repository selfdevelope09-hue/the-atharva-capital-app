/**
 * DigitalOcean realtime server (Socket.io).
 * Override via REACT_APP_REALTIME_SERVER_URL in .env / Vercel.
 */

const DEFAULT_REALTIME_ORIGIN = 'http://64.227.188.248:3000';

export function resolveRealtimeServerUrl() {
  const fromEnv = String(process.env.REACT_APP_REALTIME_SERVER_URL || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return DEFAULT_REALTIME_ORIGIN;
}

/** Set REACT_APP_REALTIME_SOCKET_ENABLED=false to disable without removing code. */
export function isRealtimeSocketEnabled() {
  const flag = String(process.env.REACT_APP_REALTIME_SOCKET_ENABLED ?? 'true').toLowerCase();
  return flag !== 'false' && flag !== '0';
}
