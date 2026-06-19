import { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../authContext';
import { getRealtimeSocket } from '../api/realtimeSocket';
import { isRealtimeTradeMode } from '../config/tradeBackend';
import { socketSubscribeTicks } from '../api/realtimeTrade';
import { TRADING_PAIRS_USDT } from '../config/tradingPairs';

/**
 * Live prices via Socket.io `tick` events (zero Firestore).
 * Falls back to empty map when realtime trade mode is off — use PriceContext instead.
 */
export function useRealtimeTicks(extraSymbols = []) {
  const { realtimeConnected } = useContext(AuthContext);
  const [ticks, setTicks] = useState({});

  const symbols = useMemo(() => {
    const set = new Set([...TRADING_PAIRS_USDT, ...extraSymbols.map((s) => String(s).toUpperCase())]);
    return Array.from(set);
  }, [extraSymbols.join(',')]);

  useEffect(() => {
    if (!isRealtimeTradeMode() || !realtimeConnected) return undefined;

    const socket = getRealtimeSocket();
    if (!socket) return undefined;

    socketSubscribeTicks(symbols);

    const onTick = (tick) => {
      if (!tick?.symbol) return;
      const sym = String(tick.symbol).toUpperCase();
      setTicks((prev) => ({
        ...prev,
        [sym]: {
          price: String(tick.price),
          change: tick.change24h != null ? String(tick.change24h) : prev[sym]?.change
        }
      }));
    };

    socket.on('tick', onTick);
    return () => {
      socket.off('tick', onTick);
    };
  }, [realtimeConnected, symbols.join(',')]);

  return ticks;
}
