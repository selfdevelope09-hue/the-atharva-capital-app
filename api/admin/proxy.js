const { proxyJsonToDigitalOcean } = require('../_lib/proxyToDigitalOcean.cjs');

function pickAdminPath(req) {
  const q = req.query || {};
  let p = q.path;
  if (Array.isArray(p)) p = p.filter(Boolean).join('/');
  else if (p != null) p = String(p);
  else p = '';
  p = p.replace(/^\/+|\/+$/g, '');
  if (p) return decodeURIComponent(p);

  const pathOnly = String(req.url || '').split('?')[0];
  const nested = pathOnly.match(/\/api\/admin\/(.+?)\/?$/);
  return nested ? decodeURIComponent(nested[1].trim()) : '';
}

/** Proxies all /api/admin/* requests to DigitalOcean (via vercel.json rewrite). */
module.exports = async (req, res) => {
  const path = pickAdminPath(req);
  if (!path || path === 'proxy') {
    const { json, applyApiCors, handleCorsPreflight } = require('../_lib/http');
    applyApiCors(req, res);
    if (handleCorsPreflight(req, res)) return;
    return json(res, 404, { ok: false, error: 'not_found', segment: 'admin' });
  }
  return proxyJsonToDigitalOcean(req, res, `/api/admin/${path}`);
};
