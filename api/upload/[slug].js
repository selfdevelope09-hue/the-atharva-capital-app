const { json, applyApiCors, handleCorsPreflight } = require('../_lib/http');
const { dataViaDigitalOcean, proxyJsonToDigitalOcean } = require('../_lib/proxyToDigitalOcean.cjs');

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  const slug = req.query && req.query.slug != null ? String(req.query.slug) : '';
  if (!slug) return json(res, 404, { ok: false, error: 'not_found' });
  if (dataViaDigitalOcean()) {
    return proxyJsonToDigitalOcean(req, res, `/api/upload/${slug}`);
  }
  return json(res, 503, { ok: false, error: 'Upload API requires DigitalOcean backend' });
};
