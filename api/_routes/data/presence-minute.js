const { json, applyApiCors, handleCorsPreflight } = require('../../_lib/http');

/** Local Vercel fallback — production proxies to DigitalOcean. */
module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  return json(res, 503, { ok: false, error: 'presence_minute_requires_do' });
};
