import { useEffect } from 'react';

/**
 * Repeated async poll with a dynamic delay (e.g. slower when tab hidden).
 */
export function useAdaptivePoll(effect, delayMsFn, deps = [], enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let timer;

    const loop = async () => {
      if (cancelled) return;
      try {
        await effect();
      } catch {
        /* caller handles errors */
      }
      if (cancelled) return;
      const ms = Math.max(1500, Number(delayMsFn()) || 15000);
      timer = window.setTimeout(loop, ms);
    };

    loop();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);
}
