import { useSyncExternalStore } from 'react';
import {
  getHotPricesSnapshot,
  getHotPricesVersion,
  subscribeHotPrices
} from '../context/priceStore';

/** Live prices for featured pairs only — avoids re-rendering on every Binance tick globally. */
export function useHotPrices() {
  return useSyncExternalStore(
    subscribeHotPrices,
    () => getHotPricesSnapshot(),
    () => getHotPricesSnapshot()
  );
}

export function useHotPricesVersion() {
  return useSyncExternalStore(
    subscribeHotPrices,
    () => getHotPricesVersion(),
    () => getHotPricesVersion()
  );
}
