const { json, applyApiCors, handleCorsPreflight } = require('../_lib/http');
const { dataViaDigitalOcean, proxyJsonToDigitalOcean } = require('../_lib/proxyToDigitalOcean.cjs');

const HANDLERS = {
  'follow-bff': require('../_routes/social/follow-bff'),
  'showcase-follow': require('../_routes/social/showcase-follow')
};

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  const slug = req.query && req.query.slug != null ? String(req.query.slug) : '';
  if (dataViaDigitalOcean() && slug === 'follow-bff') {
    return proxyJsonToDigitalOcean(req, res, `/api/social/follow-bff`);
  }
  const handler = HANDLERS[slug];
  if (!handler) return json(res, 404, { ok: false, error: 'not_found', segment: 'social', slug });
  return handler(req, res);
};
