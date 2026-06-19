import { useCallback, useContext, useState } from 'react';
import { AuthContext } from '../authContext';
import { isRealtimeTradeMode } from '../config/tradeBackend';
import { isRealtimeConnected } from '../api/realtimeSocket';
import { socketTradeOpen, socketTradeClose } from '../api/realtimeTrade';

/**
 * Buy/sell via DigitalOcean Socket.io (ack-based).
 * Wallet updates arrive on `wallet:update` — AuthProvider listens when realtime mode is on.
 */
export function useTradeSocket() {
  const { realtimeConnected, refreshUser } = useContext(AuthContext);
  const [busy, setBusy] = useState(false);

  const canTrade = isRealtimeTradeMode() && realtimeConnected && isRealtimeConnected();

  const openTrade = useCallback(
    async (payload) => {
      if (!isRealtimeTradeMode()) {
        throw new Error('Realtime trading is not enabled');
      }
      setBusy(true);
      try {
        const ack = await socketTradeOpen(payload);
        refreshUser?.().catch(() => {});
        window.dispatchEvent(new CustomEvent('auron-leaderboard-reload'));
        return ack;
      } finally {
        setBusy(false);
      }
    },
    [refreshUser]
  );

  const closeTrade = useCallback(
    async (payload) => {
      if (!isRealtimeTradeMode()) {
        throw new Error('Realtime trading is not enabled');
      }
      setBusy(true);
      try {
        const ack = await socketTradeClose(payload);
        refreshUser?.().catch(() => {});
        window.dispatchEvent(new CustomEvent('auron-leaderboard-reload'));
        return ack;
      } finally {
        setBusy(false);
      }
    },
    [refreshUser]
  );

  return {
    canTrade,
    busy,
    openTrade,
    closeTrade,
    realtimeConnected
  };
}
