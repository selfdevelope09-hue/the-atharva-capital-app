import React, { useEffect, useRef, useState } from 'react';
import {
  bindTvLayoutPersistence,
  saveLayoutFromChart,
  tvLayoutStorageKey
} from '../utils/tvLayoutPersistence';

const TV_JS = 'https://s3.tradingview.com/tv.js';

function waitForTradingViewWidget(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      if (typeof window !== 'undefined' && window.TradingView?.widget) {
        resolve();
        return;
      }
      if (Date.now() - t0 > timeoutMs) {
        reject(new Error('TradingView widget API not ready'));
        return;
      }
      window.setTimeout(tick, 80);
    };
    tick();
  });
}

function loadTvJs() {
  if (typeof window !== 'undefined' && window.TradingView?.widget) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${TV_JS}"]`);
    if (existing) {
      waitForTradingViewWidget().then(resolve).catch(reject);
      return;
    }
    const s = document.createElement('script');
    s.src = TV_JS;
    s.async = true;
    s.onload = () => waitForTradingViewWidget().then(resolve).catch(reject);
    s.onerror = () => reject(new Error('Could not load TradingView'));
    document.head.appendChild(s);
  });
}

function teardownWidget(hostEl, widgetRef, unbindPersistRef) {
  unbindPersistRef.current?.();
  unbindPersistRef.current = null;
  try {
    widgetRef.current?.remove?.();
  } catch {
    /* ignore */
  }
  widgetRef.current = null;
  if (hostEl) hostEl.innerHTML = '';
}

/**
 * TradingView tv.js widget — recreates on symbol change so pair chips always match the chart.
 */
export default function TvJsWidgetEmbed({
  symbol = 'BTCUSDT',
  minHeight = 380,
  fillParent = false,
  firebaseUid = null,
  persist = false,
  onFailed
}) {
  const sym = String(symbol || 'BTCUSDT')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const minH = Math.max(240, Number(minHeight) > 0 ? Number(minHeight) : 380);
  const hostRef = useRef(null);
  const widgetRef = useRef(null);
  const unbindPersistRef = useRef(null);
  const prevSymRef = useRef('');
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    setErr('');
    const hostEl = hostRef.current;

    const run = async () => {
      try {
        await loadTvJs();
        if (cancelled || !hostEl) return;

        const prevSym = prevSymRef.current;
        if (persist && prevSym && prevSym !== sym && widgetRef.current) {
          saveLayoutFromChart(widgetRef.current, tvLayoutStorageKey(firebaseUid, prevSym));
        }

        teardownWidget(hostEl, widgetRef, unbindPersistRef);

        const containerId = `tvjs_${sym}_${Date.now()}`;
        const el = document.createElement('div');
        el.id = containerId;
        el.style.width = '100%';
        el.style.height = fillParent ? '100%' : `${minH}px`;
        el.style.minHeight = fillParent ? '0' : `${minH}px`;
        hostEl.appendChild(el);

        const widget = new window.TradingView.widget({
          autosize: true,
          width: '100%',
          height: fillParent ? '100%' : minH,
          symbol: `BINANCE:${sym}`,
          interval: '15',
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#1e2329',
          enable_publishing: false,
          hide_side_toolbar: false,
          hide_top_toolbar: false,
          withdateranges: true,
          allow_symbol_change: false,
          load_last_chart: false,
          save_image: true,
          container_id: containerId
        });
        widgetRef.current = widget;
        prevSymRef.current = sym;

        if (persist) {
          const key = tvLayoutStorageKey(firebaseUid, sym);
          unbindPersistRef.current = bindTvLayoutPersistence(widget, key, { forceSymbol: sym });
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e?.message || 'Chart failed');
          onFailed?.();
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      if (!persist) {
        teardownWidget(hostEl, widgetRef, unbindPersistRef);
        prevSymRef.current = '';
      }
    };
  }, [sym, minH, fillParent, persist, firebaseUid, onFailed]);

  useEffect(
    () => () => {
      const hostEl = hostRef.current;
      if (persist && prevSymRef.current && widgetRef.current) {
        saveLayoutFromChart(widgetRef.current, tvLayoutStorageKey(firebaseUid, prevSymRef.current));
      }
      teardownWidget(hostEl, widgetRef, unbindPersistRef);
      prevSymRef.current = '';
    },
    [persist, firebaseUid]
  );

  const boxStyle = fillParent
    ? {
        width: '100%',
        height: '100%',
        flex: 1,
        minHeight: 0,
        background: '#0b0e11',
        touchAction: 'manipulation'
      }
    : {
        width: '100%',
        height: minH,
        minHeight: minH,
        background: '#0b0e11',
        touchAction: 'manipulation'
      };

  if (err) {
    return <div style={{ padding: 12, color: '#f0b90b', fontSize: 12 }}>Chart temporarily unavailable. Retrying…</div>;
  }

  return <div ref={hostRef} className="trade-tv-js-host" style={boxStyle} />;
}
