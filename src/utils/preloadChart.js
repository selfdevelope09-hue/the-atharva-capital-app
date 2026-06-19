const TV_JS = 'https://s3.tradingview.com/tv.js';
let started = false;

/** Warm TradingView + trade route so /trade chart opens faster. */
export function preloadChartAssets() {
  if (started || typeof document === 'undefined') return;
  started = true;

  const head = document.head;
  if (!head) return;

  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = 'https://s3.tradingview.com';
  preconnect.crossOrigin = 'anonymous';
  head.appendChild(preconnect);

  const dns = document.createElement('link');
  dns.rel = 'dns-prefetch';
  dns.href = 'https://s3.tradingview.com';
  head.appendChild(dns);

  if (!document.querySelector(`link[rel="prefetch"][href="${TV_JS}"]`)) {
    const prefetch = document.createElement('link');
    prefetch.rel = 'prefetch';
    prefetch.href = TV_JS;
    prefetch.as = 'script';
    head.appendChild(prefetch);
  }

  if (!document.querySelector(`script[src="${TV_JS}"]`)) {
    const s = document.createElement('script');
    s.src = TV_JS;
    s.async = true;
    document.head.appendChild(s);
  }

  const prefetchWidget = document.createElement('link');
  prefetchWidget.rel = 'prefetch';
  prefetchWidget.href = '/tv-widget-chart.html';
  head.appendChild(prefetchWidget);

}
