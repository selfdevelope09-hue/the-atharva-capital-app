import { getRealtimeSocket, isRealtimeConnected, connectRealtimeSocket } from './realtimeSocket';

const TRADE_TIMEOUT_MS = 20000;
const TRADE_OPEN_TIMEOUT_MS = 12000;

function emitWithAck(event, payload, timeoutMs = TRADE_TIMEOUT_MS) {
  return new Promise(async (resolve, reject) => {
    let socket = getRealtimeSocket();
    if (!socket?.connected) {
      try {
        socket = await connectRealtimeSocket();
      } catch (e) {
        reject(e);
        return;
      }
    }
    if (!socket?.connected) {
      reject(new Error('Realtime server not connected. Check your connection.'));
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error('Trade request timed out. Try again.'));
    }, timeoutMs);

    socket.emit(event, payload, (ack) => {
      clearTimeout(timer);
      if (!ack || ack.ok === false) {
        reject(new Error(ack?.error || 'Trade failed'));
        return;
      }
      resolve(ack);
    });
  });
}

export async function socketTradeOpen(body) {
  return emitWithAck('trade:open', body, TRADE_OPEN_TIMEOUT_MS);
}

export async function socketUpdatePositionTpSl(body) {
  return emitWithAck('trade:update-position', body, TRADE_TIMEOUT_MS);
}

export async function socketTradeClose(body) {
  return emitWithAck('trade:close', body);
}

export async function socketUserSync() {
  return emitWithAck('user:sync', {});
}

export function socketSubscribeTicks(symbols) {
  const socket = getRealtimeSocket();
  if (!socket?.connected) return;
  socket.emit('ticks:subscribe', { symbols }, () => {});
}

export { isRealtimeConnected };
