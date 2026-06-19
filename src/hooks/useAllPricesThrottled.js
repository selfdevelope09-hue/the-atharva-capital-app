import { useEffect, useState } from 'react';
import { getAllPricesSnapshot, ingest24hrTickers, subscribeAllPrices } from '../context/priceStore';

const BINANCE_24HR_URL = 'https://api.binance.com/api/v3/ticker/24hr';

/** Markets list — full USDT map, throttled UI updates (not every WS tick). */
export function useAllPricesThrottled(intervalMs = 1500) {
  const [prices, setPrices] = useState(() => getAllPricesSnapshot());

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      if (!cancelled) setPrices(getAllPricesSnapshot());
    };
    const refreshRest = async () => {
      try {
        const res = await fetch(BINANCE_24HR_URL);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) ingest24hrTickers(data);
      } catch {
        /* ignore */
      }
    };
    pull();
    refreshRest();
    const unsub = subscribeAllPrices(pull);
    const id = window.setInterval(pull, Math.max(800, intervalMs));
    const restId = window.setInterval(refreshRest, 45000);
    return () => {
      cancelled = true;
      unsub();
      clearInterval(id);
      clearInterval(restId);
    };
  }, [intervalMs]);

  return prices;
}
