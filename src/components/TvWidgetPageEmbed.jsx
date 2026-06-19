import React, { useEffect, useMemo, useRef } from 'react';

/**
 * Same-origin iframe → public/tv-widget-chart.html (tv.js with left drawing toolbar).
 * Remounts on symbol change so the chart always matches the selected pair.
 */
export default function TvWidgetPageEmbed({
  symbol = 'BTCUSDT',
  minHeight = 380,
  fillParent = false,
  firebaseUid = null
}) {
  const sym = String(symbol || 'BTCUSDT')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const minH = Math.max(240, Number(minHeight) > 0 ? Number(minHeight) : 380);
  const iframeRef = useRef(null);

  const src = useMemo(() => {
    const q = new URLSearchParams({
      symbol: sym,
      interval: '15',
      userId: firebaseUid ? String(firebaseUid) : 'anon'
    });
    return `/tv-widget-chart.html?${q.toString()}`;
  }, [sym, firebaseUid]);

  useEffect(() => {
    const iframe = iframeRef.current;
    return () => {
      try {
        iframe?.contentWindow?.postMessage({ type: 'tv-persist-now' }, window.location.origin);
      } catch {
        /* ignore */
      }
    };
  }, [sym]);

  const boxStyle = fillParent
    ? {
        position: 'relative',
        width: '100%',
        height: '100%',
        flex: 1,
        minHeight: 0,
        background: '#0b0e11',
        touchAction: 'manipulation'
      }
    : {
        position: 'relative',
        width: '100%',
        height: minH,
        minHeight: minH,
        background: '#0b0e11',
        touchAction: 'manipulation'
      };

  const iframeStyle = fillParent
    ? { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, display: 'block' }
    : { width: '100%', height: minH, border: 0, display: 'block' };

  return (
    <div className="trade-tv-embed-root trade-tv-wrap--tvjs" style={boxStyle}>
      <iframe
        key={sym}
        ref={iframeRef}
        title={`Chart ${sym}`}
        src={src}
        style={iframeStyle}
        loading="eager"
        fetchPriority="high"
        allow="clipboard-write; fullscreen"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
