import React, { useEffect, useRef, useState } from 'react';
import { createBinanceDatafeed } from '../trading/binanceDatafeed';
import { resolveTvStorageApiBase } from '../utils/tvChartStorage';
import {
  bindTvLayoutPersistence,
  createLocalStorageSaveLoadAdapter,
  saveLayoutFromChart,
  tvLayoutStorageKey
} from '../utils/tvLayoutPersistence';

const CL_SCRIPT = '/charting_library/charting_library.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Charting Library script missing'));
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
 * Self-hosted TradingView Charting Library — full recreate on symbol change.
 */
export default function TvChartingLibraryEmbed({
  symbol = 'BTCUSDT',
  minHeight = 380,
  chartUserId = null,
  firebaseUid = null,
  fillParent = false,
  onMissingLibrary
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
        await loadScript(CL_SCRIPT);
        if (cancelled || !hostEl) return;
        if (!window.TradingView?.widget) {
          onMissingLibrary?.();
          return;
        }

        const storageUid = firebaseUid || chartUserId || 'anon';
        const prevSym = prevSymRef.current;
        if (prevSym && prevSym !== sym && widgetRef.current) {
          saveLayoutFromChart(widgetRef.current, tvLayoutStorageKey(storageUid, prevSym));
        }

        teardownWidget(hostEl, widgetRef, unbindPersistRef);

        const apiBase = resolveTvStorageApiBase();

        const enabledFeatures = [
          'study_templates',
          'side_toolbar_in_fullscreen_mode',
          'header_in_fullscreen_mode',
          'header_saveload',
          'items_favoriting',
          'save_chart_properties_to_local_storage',
          'use_localstorage_for_settings',
          'saveload_separate_drawings_storage',
          'drawing_templates',
          'create_volume_indicator_by_default'
        ];
        if (chartUserId) {
          enabledFeatures.push('chart_template_storage');
        }

        const disabledFeatures = [
          'trading_account_manager',
          'trading_notifications',
          'open_account_manager'
        ];

        const options = {
          symbol: `BINANCE:${sym}`,
          interval: '15',
          container: hostEl,
          library_path: '/charting_library/',
          locale: 'en',
          theme: 'dark',
          autosize: true,
          fullscreen: false,
          timezone: 'Etc/UTC',
          datafeed: createBinanceDatafeed(),
          load_last_chart: false,
          auto_save_delay: 3,
          enabled_features: enabledFeatures,
          disabled_features: disabledFeatures,
          save_load_adapter: createLocalStorageSaveLoadAdapter(storageUid, sym),
          overrides: {
            'paneProperties.background': '#0b0e11',
            'paneProperties.backgroundType': 'solid'
          },
          custom_css_url: '/chart-tv-custom.css'
        };

        if (chartUserId) {
          options.charts_storage_url = `${apiBase}/api/tv-storage`;
          options.charts_storage_api_version = '1.1';
          options.client_id = 'auronx';
          options.user_id = chartUserId;
        }

        const widget = new window.TradingView.widget(options);
        widgetRef.current = widget;
        prevSymRef.current = sym;
        unbindPersistRef.current = bindTvLayoutPersistence(
          widget,
          tvLayoutStorageKey(storageUid, sym),
          { forceSymbol: sym }
        );
      } catch (e) {
        if (!cancelled) {
          setErr(e.message || 'Chart failed');
          onMissingLibrary?.();
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [sym, chartUserId, firebaseUid, onMissingLibrary]);

  useEffect(
    () => () => {
      const hostEl = hostRef.current;
      const storageUid = firebaseUid || chartUserId || 'anon';
      if (prevSymRef.current && widgetRef.current) {
        saveLayoutFromChart(widgetRef.current, tvLayoutStorageKey(storageUid, prevSymRef.current));
      }
      teardownWidget(hostEl, widgetRef, unbindPersistRef);
      prevSymRef.current = '';
    },
    [firebaseUid, chartUserId]
  );

  const hostStyle = fillParent
    ? {
        width: '100%',
        height: '100%',
        minHeight: 0,
        flex: 1,
        background: '#0b0e11',
        touchAction: 'manipulation'
      }
    : {
        width: '100%',
        height: '100%',
        minHeight: minH,
        background: '#0b0e11',
        touchAction: 'manipulation'
      };

  if (err) {
    return (
      <div style={{ padding: 16, color: '#f0b90b', fontSize: 13, minHeight: minH }}>{err}</div>
    );
  }

  return <div ref={hostRef} className="trade-tv-cl-host" style={hostStyle} />;
}
