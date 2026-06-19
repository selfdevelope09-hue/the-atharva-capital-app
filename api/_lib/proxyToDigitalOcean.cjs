const { json, readBody, applyApiCors, handleCorsPreflight } = require('./http');

function digitalOceanApiOrigin() {
  return String(
    process.env.DIGITALOCEAN_API_URL ||
      process.env.REALTIME_SERVER_URL ||
      'http://64.227.188.248:3000'
  ).replace(/\/$/, '');
}

function viaDigitalOcean(envName) {
  const raw = process.env[envName];
  if (raw === undefined || raw === '') return true;
  const v = String(raw).toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes';
}

function tradeViaDigitalOcean() {
  return viaDigitalOcean('TRADE_VIA_DIGITALOCEAN');
}

function dataViaDigitalOcean() {
  if (viaDigitalOcean('DATA_VIA_DIGITALOCEAN')) return true;
  // Trades live on DO Postgres — leaderboard/me must read the same DB.
  if (tradeViaDigitalOcean() && digitalOceanApiOrigin()) return true;
  return false;
}

/**
 * Forward authenticated JSON API calls to the DigitalOcean realtime server (Postgres).
 */
function buildUpstreamBody(req) {
  const ct = String(req.headers['content-type'] || '');
  if (req.method === 'GET' || req.method === 'HEAD') return { body: undefined, contentType: null };
  if (ct.includes('application/x-www-form-urlencoded')) {
    const b = readBody(req);
    if (typeof b === 'string') return { body: b, contentType: ct };
    return {
      body: new URLSearchParams(b).toString(),
      contentType: 'application/x-www-form-urlencoded'
    };
  }
  return { body: JSON.stringify(readBody(req)), contentType: 'application/json' };
}

async function proxyJsonToDigitalOcean(req, res, path, { requireAuth = true } = {}) {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  const auth = req.headers.authorization || '';
  if (requireAuth && !auth) return json(res, 401, { ok: false, error: 'Unauthorized' });

  const qs =
    req.url && String(req.url).includes('?') ? String(req.url).slice(String(req.url).indexOf('?')) : '';
  const url = `${digitalOceanApiOrigin()}${path}${qs}`;
  const { body, contentType } = buildUpstreamBody(req);
  const init = {
    method: req.method,
    headers: {}
  };
  if (auth) init.headers.Authorization = auth;
  if (contentType) init.headers['Content-Type'] = contentType;
  if (body !== undefined) init.body = body;

  let upstream;
  try {
    upstream = await fetch(url, init);
  } catch (e) {
    return json(res, 502, {
      ok: false,
      error: e?.message || 'Upstream API unreachable',
      path
    });
  }
  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok && !payload.error) {
    payload.error = payload.message || `Upstream HTTP ${upstream.status}`;
  }
  return json(res, upstream.status, payload);
}

module.exports = {
  digitalOceanApiOrigin,
  tradeViaDigitalOcean,
  dataViaDigitalOcean,
  proxyJsonToDigitalOcean,
  viaDigitalOcean
};
