import React, { useState } from 'react';
import BinanceMiniChart from './BinanceMiniChart';

function buildChartEmbedUrl(sym) {
  const params = new URLSearchParams({
    autosize: 'true',
    symbol: `BINANCE:${sym}`,
    interval: '15',
    timezone: 'Etc/UTC',
    theme: 'dark',
    style: '1',
    locale: 'en',
    enable_publishing: 'false',
    allow_symbol_change: 'true',
    calendar: 'false',
    support_host: 'https://www.theatharvacapital.com'
  });
  return `https://s.tradingview.com/embed-widget/advanced-chart/?${params.toString()}`;
}

/**
 * Full-height TradingView chart (iframe). Parent must set explicit height or fillParent flex.
 */
export default function TradingViewWebEmbed({
  symbol = 'BTCUSDT',
  minHeight = 380,
  fillParent = false
}) {
  const sym = String(symbol || 'BTCUSDT')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const minH = Math.max(240, Number(minHeight) > 0 ? Number(minHeight) : 380);
  const [useFallback, setUseFallback] = useState(false);
  const iframeSrc = buildChartEmbedUrl(sym);

  if (useFallback) {
    return <BinanceMiniChart symbol={sym} minHeight={minH} />;
  }

  const boxStyle = fillParent
    ? {
        position: 'relative',
        width: '100%',
        height: '100%',
        flex: 1,
        minHeight: 0,
        background: '#0b0e11',
        touchAction: 'none'
      }
    : {
        position: 'relative',
        width: '100%',
        height: minH,
        minHeight: minH,
        maxHeight: minH,
        background: '#0b0e11',
        touchAction: 'none'
      };

  const iframeStyle = fillParent
    ? {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 0,
        display: 'block',
        background: '#131722'
      }
    : {
        width: '100%',
        height: minH,
        border: 0,
        display: 'block',
        verticalAlign: 'top',
        background: '#131722'
      };

  return (
    <div className="trade-tv-embed-root" style={boxStyle}>
      <iframe
        key={iframeSrc}
        title={`TradingView ${sym}`}
        src={iframeSrc}
        onError={() => setUseFallback(true)}
        style={iframeStyle}
        allow="clipboard-write; fullscreen"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
