const TV_DRAWINGS_KEY_PREFIX = 'tv_chart_drawings_v1';

export function tvLayoutStorageKey(userId, symbol) {
  const userPart = userId ? String(userId) : 'anon';
  const symPart = String(symbol || 'BTCUSDT')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return `${TV_DRAWINGS_KEY_PREFIX}:${userPart}:${symPart}`;
}

export function readTvLayout(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeTvLayout(key, payload) {
  try {
    localStorage.setItem(key, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function getChartApi(widget) {
  if (!widget) return null;
  try {
    if (typeof widget.activeChart === 'function') return widget.activeChart();
    if (typeof widget.chart === 'function') return widget.chart();
  } catch {
    return null;
  }
  return null;
}

export function loadLayoutIntoChart(widget, key) {
  const chart = getChartApi(widget);
  if (!chart || typeof chart.load !== 'function') return false;
  const saved = readTvLayout(key);
  if (!saved) return false;
  try {
    chart.load(saved);
    return true;
  } catch {
    return false;
  }
}

export function saveLayoutFromChart(widget, key) {
  const chart = getChartApi(widget);
  if (!chart || typeof chart.save !== 'function') return false;
  try {
    chart.save((data) => {
      if (data) writeTvLayout(key, data);
    });
    return true;
  } catch {
    return false;
  }
}

/** Bind autosave + visibility flush when chart API supports save/load (Charting Library). */
export function bindTvLayoutPersistence(widget, key, { forceSymbol } = {}) {
  if (!widget || !key) return () => {};
  let saveTimer = null;
  let intervalId = null;

  const flush = () => saveLayoutFromChart(widget, key);

  const onReady = () => {
    loadLayoutIntoChart(widget, key);
    if (forceSymbol) setChartSymbol(widget, forceSymbol);
    const chart = getChartApi(widget);
    if (chart && typeof chart.onAutoSaveNeeded === 'function') {
      chart.onAutoSaveNeeded(() => {
        if (saveTimer) window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(flush, 200);
      });
    }
    window.setTimeout(flush, 1500);
    intervalId = window.setInterval(flush, 12000);
  };

  if (typeof widget.onChartReady === 'function') {
    widget.onChartReady(onReady);
  } else {
    onReady();
  }

  const onHide = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  document.addEventListener('visibilitychange', onHide);

  return () => {
    flush();
    if (saveTimer) window.clearTimeout(saveTimer);
    if (intervalId) window.clearInterval(intervalId);
    document.removeEventListener('visibilitychange', onHide);
  };
}

export function setChartSymbol(widget, symbol) {
  const sym = String(symbol || 'BTCUSDT')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const chart = getChartApi(widget);
  if (!chart) return false;
  try {
    if (typeof chart.setSymbol === 'function') {
      chart.setSymbol(`BINANCE:${sym}`, () => {});
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** localStorage save_load_adapter for Charting Library widget options. */
export function createLocalStorageSaveLoadAdapter(userId, symbol) {
  const layoutKey = tvLayoutStorageKey(userId, symbol);
  const chartsKey = `${layoutKey}:charts`;

  function readCharts() {
    try {
      const raw = localStorage.getItem(chartsKey);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function writeCharts(list) {
    try {
      localStorage.setItem(chartsKey, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }

  return {
    getAllCharts: () =>
      Promise.resolve(
        readCharts().map((c) => ({
          id: c.id,
          name: c.name || 'Chart',
          symbol: c.symbol || symbol,
          resolution: c.resolution || '15',
          timestamp: c.timestamp || Math.floor(Date.now() / 1000)
        }))
      ),
    removeChart: (id) => {
      writeCharts(readCharts().filter((c) => String(c.id) !== String(id)));
      return Promise.resolve();
    },
    saveChart: (chartData) => {
      const id = chartData.id || `local_${Date.now()}`;
      const next = readCharts().filter((c) => String(c.id) !== String(id));
      next.unshift({
        id,
        name: chartData.name || 'Chart',
        symbol: chartData.symbol || symbol,
        resolution: chartData.resolution || '15',
        timestamp: Math.floor(Date.now() / 1000),
        content: chartData.content
      });
      writeCharts(next.slice(0, 20));
      if (chartData.content) {
        try {
          writeTvLayout(layoutKey, JSON.parse(chartData.content));
        } catch {
          /* content may already be object string */
        }
      }
      return Promise.resolve(id);
    },
    getChartContent: (id) => {
      const row = readCharts().find((c) => String(c.id) === String(id));
      if (row?.content) return Promise.resolve(row.content);
      const fallback = readTvLayout(layoutKey);
      if (fallback) return Promise.resolve(JSON.stringify(fallback));
      return Promise.resolve('');
    },
    getAllStudyTemplates: () => Promise.resolve([]),
    removeStudyTemplate: () => Promise.resolve(),
    saveStudyTemplate: () => Promise.resolve(),
    getStudyTemplateContent: () => Promise.resolve('')
  };
}
