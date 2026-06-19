import {
  ADSTERA_HOME_TOP,
  ADSTERA_MARKETS_TOP,
  ADSTERA_LEADERBOARD_TOP,
  ADSTERA_LEADERBOARD_AFTER_5
} from '../config/adsteraSlots';

export const ALL_ADSTERA_SLOTS = [
  ADSTERA_HOME_TOP,
  ADSTERA_MARKETS_TOP,
  ADSTERA_LEADERBOARD_TOP,
  ADSTERA_LEADERBOARD_AFTER_5
];

const ALL_CONTAINER_IDS = new Set(ALL_ADSTERA_SLOTS.map((s) => s.containerId));
const CONTAINER_ID_RE = /^container-[a-f0-9]{32}$/i;
const AD_SCRIPT_RE = /effectivecpmnetwork\.com|\/invoke\.js/i;
const AD_IFRAME_RE =
  /effectivecpm|effectivecpmnetwork|adsterra|adstera|partnerads|clickadilla|highcpm|adskeeper|adsrv|doubleclick|googlesyndication|taboola|outbrain/i;

export function normalizeAdsteraPath(pathname = '') {
  return String(pathname || '').split('?')[0].replace(/\/$/, '') || '/';
}

/** Banner slot for the active route; other pages use the home unit. */
export function bannerSlotForPath(pathname = '') {
  const p = normalizeAdsteraPath(pathname);
  if (p === '/' || p === '/home') return ADSTERA_HOME_TOP;
  if (p === '/markets') return ADSTERA_MARKETS_TOP;
  if (p === '/leaderboard' || p.startsWith('/leaderboard/')) return ADSTERA_LEADERBOARD_TOP;
  return ADSTERA_HOME_TOP;
}

/** @deprecated use bannerSlotForPath */
export function adsteraSlotForPath(pathname = '') {
  const p = normalizeAdsteraPath(pathname);
  if (p === '/' || p === '/home') return ADSTERA_HOME_TOP;
  if (p === '/markets') return ADSTERA_MARKETS_TOP;
  if (p === '/leaderboard' || p.startsWith('/leaderboard/')) return ADSTERA_LEADERBOARD_TOP;
  return null;
}

function isLeakedAdIframe(iframe) {
  if (iframe.closest('[data-adstera-frame]')) return false;
  if (iframe.closest('[data-site-banner]')) return false;

  const src = String(iframe.src || iframe.getAttribute('src') || '');
  if (src.includes('/ads/')) return false;
  if (AD_IFRAME_RE.test(src)) return true;

  const parent = iframe.parentElement;
  if (!parent) return false;
  if (parent.id && ALL_CONTAINER_IDS.has(parent.id)) return true;
  if (parent.closest('[data-adstera-root]')) return true;
  if (parent.id && CONTAINER_ID_RE.test(parent.id)) return true;
  return false;
}

/** Remove leaked Adstera scripts/containers from the main SPA document (not inside /ads/ iframes). */
export function purgeAllAdstera() {
  if (typeof document === 'undefined') return;

  document.querySelectorAll('script').forEach((node) => {
    const src = String(node.src || node.getAttribute('src') || '');
    if (AD_SCRIPT_RE.test(src)) node.remove();
  });

  ALL_CONTAINER_IDS.forEach((id) => {
    document.querySelectorAll(`#${CSS.escape(id)}`).forEach((el) => el.remove());
  });

  document.querySelectorAll('[id^="container-"]').forEach((el) => {
    if (CONTAINER_ID_RE.test(el.id)) el.remove();
  });

  document.querySelectorAll('[data-adstera-root]').forEach((el) => {
    el.innerHTML = '';
  });

  document.querySelectorAll('.adstera-slot, .adstera-page-top, .adstera-page-frame').forEach((el) => {
    if (el.querySelector('iframe[src*="/ads/"]')) return;
    el.innerHTML = '';
  });

  document.querySelectorAll('iframe').forEach((iframe) => {
    if (isLeakedAdIframe(iframe)) iframe.remove();
  });
}
