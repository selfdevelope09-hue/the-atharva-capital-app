const { json, applyApiCors, handleCorsPreflight } = require('../_lib/http');
const { dataViaDigitalOcean, proxyJsonToDigitalOcean } = require('../_lib/proxyToDigitalOcean.cjs');

const HANDLERS = {
  'chart-key': require('../_routes/tv/chart-key')
};

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  const slug = req.query && req.query.slug != null ? String(req.query.slug) : '';
  if (dataViaDigitalOcean() && slug === 'chart-key') {
    return proxyJsonToDigitalOcean(req, res, `/api/tv/${slug}`);
  }
  const handler = HANDLERS[slug];
  if (!handler) return json(res, 404, { ok: false, error: 'not_found', segment: 'tv', slug });
  return handler(req, res);
};
