/** True only when the real TradingView Charting Library JS is deployed (not SPA index.html). */

let cachedResult = null;
let cachePromise = null;

export async function isChartingLibraryAvailable() {
  if (cachedResult !== null) return cachedResult;
  if (cachePromise) return cachePromise;
  if (process.env.REACT_APP_HAS_CHARTING_LIBRARY !== 'true') {
    cachedResult = false;
    return false;
  }
  cachePromise = probeChartingLibraryFile();
  return cachePromise;
}

async function probeChartingLibraryFile() {
  const url = '/charting_library/charting_library.js';
  try {
    const res = await fetch(url, { method: 'GET', cache: 'force-cache' });
    if (!res.ok) {
      cachedResult = false;
      return false;
    }
    const ct = String(res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html')) {
      cachedResult = false;
      return false;
    }
    const head = (await res.text()).slice(0, 800);
    const trimmed = head.trimStart();
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
      cachedResult = false;
      return false;
    }
    cachedResult =
      (head.includes('TradingView') || head.includes('charting_library')) && head.length > 800;
    return cachedResult;
  } catch {
    cachedResult = false;
    return false;
  } finally {
    cachePromise = null;
  }
}
