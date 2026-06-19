import { io } from 'socket.io-client';
import { auth } from '../firebaseClient';
import { isRealtimeSocketEnabled, resolveRealtimeServerUrl } from '../config/realtimeServer';

const STATUS_EVENT = 'auron-realtime-status';

let socket = null;
let connectPromise = null;
let coreListenersAttached = false;

function dispatchStatus(detail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail }));
}

function attachCoreListeners(sock) {
  if (coreListenersAttached) return;
  coreListenersAttached = true;
  sock.on('connect', () => {
    dispatchStatus({ connected: true, id: sock.id });
  });
  sock.on('disconnect', (reason) => {
    dispatchStatus({ connected: false, reason });
  });
  sock.on('connect_error', (err) => {
    dispatchStatus({ connected: false, error: err?.message || String(err) });
  });
}

async function freshAuthToken(forceRefresh = false) {
  const u = auth.currentUser;
  if (!u) throw new Error('Not signed in');
  return u.getIdToken(forceRefresh);
}

/**
 * Connect Socket.io to DigitalOcean after Firebase login.
 * Sends Firebase ID token in the handshake `auth` payload.
 */
export async function connectRealtimeSocket() {
  if (!isRealtimeSocketEnabled()) return null;

  const u = auth.currentUser;
  if (!u) {
    await disconnectRealtimeSocket();
    return null;
  }

  if (socket?.connected) return socket;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    try {
      const token = await freshAuthToken();
      const url = resolveRealtimeServerUrl();

      if (socket) {
        socket.auth = { token };
        if (!socket.connected) socket.connect();
        return socket;
      }

      socket = io(url, {
        autoConnect: false,
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 20000
      });

      attachCoreListeners(socket);

      socket.io.on('reconnect_attempt', async () => {
        try {
          if (!auth.currentUser) return;
          socket.auth = { token: await freshAuthToken(true) };
        } catch {
          /* ignore — server may reject until next attempt */
        }
      });

      socket.connect();

      return await new Promise((resolve) => {
        if (socket.connected) {
          resolve(socket);
          return;
        }
        const onConnect = () => {
          socket.off('connect_error', onError);
          resolve(socket);
        };
        const onError = () => {
          socket.off('connect', onConnect);
          resolve(socket);
        };
        socket.once('connect', onConnect);
        socket.once('connect_error', onError);
      });
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

/** Disconnect and tear down the singleton socket (logout / auth cleared). */
export async function disconnectRealtimeSocket() {
  connectPromise = null;
  coreListenersAttached = false;
  if (socket) {
    socket.removeAllListeners();
    socket.io?.removeAllListeners?.();
    socket.disconnect();
    socket = null;
  }
  dispatchStatus({ connected: false, reason: 'logout' });
}

export function getRealtimeSocket() {
  return socket;
}

export function isRealtimeConnected() {
  return !!socket?.connected;
}

export function subscribeRealtimeStatus(callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = (e) => callback(e.detail || {});
  window.addEventListener(STATUS_EVENT, handler);
  return () => window.removeEventListener(STATUS_EVENT, handler);
}
