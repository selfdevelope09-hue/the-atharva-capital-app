import React, { useEffect, useRef } from 'react';
import {
  buildHotMiniTickerWsUrl,
  ingest24hrTickers,
  ingestTickerPayload
} from './priceStore';

export const PriceContext = React.createContext({});

const BINANCE_24HR_URL = 'https://api.binance.com/api/v3/ticker/24hr';
const RECONNECT_MS = 3000;

/**
 * Binance prices: one REST bootstrap (all USDT), WS only for featured pairs (lighter).
 * Use useHotPrices() on Trade/Dashboard/Ticker; Markets uses useAllPricesThrottled().
 */
export function PriceProvider({ children }) {
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let restAbort = null;

    const bootstrapRest = async () => {
      try {
        restAbort = new AbortController();
        const res = await fetch(BINANCE_24HR_URL, { signal: restAbort.signal });
        if (!res.ok) throw new Error(`Binance ${res.status}`);
        const data = await res.json();
        if (mountedRef.current) ingest24hrTickers(data);
      } catch {
        /* keep WS / prior snapshot */
      }
    };

    const connectWs = () => {
      if (!mountedRef.current) return;
      try {
        if (wsRef.current) {
          wsRef.current.onclose = null;
          wsRef.current.close();
        }
      } catch {
        /* ignore */
      }
      const ws = new WebSocket(buildHotMiniTickerWsUrl());
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          ingestTickerPayload(msg);
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        if (reconnectTimerRef.current == null) {
          reconnectTimerRef.current = window.setTimeout(() => {
            reconnectTimerRef.current = null;
            connectWs();
          }, RECONNECT_MS);
        }
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };
    };

    bootstrapRest();
    connectWs();

    return () => {
      mountedRef.current = false;
      if (restAbort) restAbort.abort();
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      try {
        if (wsRef.current) {
          wsRef.current.onclose = null;
          wsRef.current.close();
        }
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    };
  }, []);

  return <PriceContext.Provider value={{}}>{children}</PriceContext.Provider>;
}
