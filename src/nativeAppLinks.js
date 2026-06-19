import { Capacitor } from '@capacitor/core';

const ALLOWED_HTTP_HOSTS = new Set(['theatharvacapital.com', 'www.theatharvacapital.com']);

/** Map app URL opens (auronx://… or matched https host) onto the SPA path in the Capacitor shell. */
function navigateDeepLink(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return;

  try {
    let pathPlus = '';

    if (/^auronx:\/\//i.test(urlStr)) {
      const u = new URL(urlStr);
      const base = !u.pathname || u.pathname === '/' ? '/' : u.pathname.startsWith('/') ? u.pathname : `/${u.pathname}`;
      pathPlus = `${base}${u.search}${u.hash}`;
    } else {
      const u = new URL(urlStr);
      const host = u.hostname.toLowerCase();
      if (!ALLOWED_HTTP_HOSTS.has(host)) return;
      pathPlus = `${u.pathname}${u.search}${u.hash}`;
    }

    const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (pathPlus === cur) return;
    window.location.replace(pathPlus);
  } catch {
    /* ignore */
  }
}

/** Register cold start + warm deep links (Play / Snapchat bios: auronx://open or full site URL). */
export async function attachCapacitorDeepLinks() {
  if (!Capacitor.isNativePlatform()) return undefined;

  const { App } = await import('@capacitor/app');

  try {
    const launch = await App.getLaunchUrl();
    if (launch?.url) navigateDeepLink(launch.url);
  } catch {
    /* no launch URL */
  }

  return App.addListener('appUrlOpen', ({ url }) => navigateDeepLink(url));
}
