const { applyApiCors, handleCorsPreflight, json } = require('../../_lib/http');
const { dataViaDigitalOcean, proxyJsonToDigitalOcean } = require('../../_lib/proxyToDigitalOcean.cjs');

const HANDLERS = {
  charts: require('../../_routes/tv/charts'),
  study_templates: require('../../_routes/tv/study_templates')
};

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;

  const resource = req.query && req.query.resource != null ? String(req.query.resource) : '';
  const version = req.query && req.query.version != null ? String(req.query.version) : '';
  if (version !== '1.0' && version !== '1.1') {
    return json(res, 404, { status: 'error', message: 'Unsupported API version' });
  }

  if (dataViaDigitalOcean() && resource) {
    return proxyJsonToDigitalOcean(req, res, `/api/tv-storage/${version}/${resource}`, {
      requireAuth: false
    });
  }

  const handler = HANDLERS[resource];
  if (!handler) return json(res, 404, { status: 'error', message: 'not_found' });
  return handler(req, res);
};
