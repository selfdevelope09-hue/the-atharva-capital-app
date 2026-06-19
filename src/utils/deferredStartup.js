/** Run after first paint so login/home open fast for new visitors. */
export function runDeferredStartup(pathname) {
  if (typeof window === 'undefined') return;

  const run = () => {
    if (pathname === '/trade' || pathname.startsWith('/trade')) {
      import('./preloadChart').then((m) => m.preloadChartAssets?.()).catch(() => {});
    }
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 2500 });
  } else {
    window.setTimeout(run, 800);
  }
}
