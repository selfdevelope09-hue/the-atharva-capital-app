import { useEffect, useMemo, useState } from 'react';
import { useHotPrices } from './useHotPrices';
import { useRealtimeTicks } from './useRealtimeTicks';
import { isDocumentVisible } from './useDocumentVisible';
import { isRealtimeTradeMode } from '../config/tradeBackend';
import {
  getAllPricesSnapshot,
  getHotPricesSnapshot,
  subscribeAllPrices,
  subscribeHotPrices
} from '../context/priceStore';
import { normalizeBinanceSymbol } from '../utils/marketSymbol';

const DASHBOARD_PRICE_MS = 900;

/**
 * Fast marks for open positions: hot WS + socket ticks + 200ms snapshot poll.
 */
export function useMergedLivePrices(extraSymbols = []) {
  const symbols = useMemo(() => {
    const set = new Set();
    for (const raw of extraSymbols || []) {
      const s = normalizeBinanceSymbol(raw);
      if (s) set.add(s);
    }
    return Array.from(set);
  }, [extraSymbols.join(',')]);

  const hot = useHotPrices();
  const socketTicks = useRealtimeTicks(isRealtimeTradeMode() ? symbols : []);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const bump = () => {
      if (!isDocumentVisible()) return;
      setPulse((x) => x + 1);
    };
    const unsubHot = subscribeHotPrices(bump);
    const unsubAll = subscribeAllPrices(bump);
    const id = window.setInterval(bump, DASHBOARD_PRICE_MS);
    const onVis = () => {
      if (isDocumentVisible()) bump();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      unsubHot();
      unsubAll();
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [symbols.join(',')]);

  return useMemo(() => {
    void pulse;
    const hotSnap = getHotPricesSnapshot();
    const allSnap = getAllPricesSnapshot();
    const merged = { ...allSnap, ...hotSnap, ...hot, ...socketTicks };
    for (const sym of symbols) {
      if (!merged[sym]) {
        merged[sym] = socketTicks[sym] || hotSnap[sym] || allSnap[sym];
      }
    }
    return merged;
  }, [pulse, hot, socketTicks, symbols]);
}
