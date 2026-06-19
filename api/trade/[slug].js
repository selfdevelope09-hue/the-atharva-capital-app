const { json, applyApiCors, handleCorsPreflight } = require('../_lib/http');

const HANDLERS = {
  open: require('../_routes/trade/open'),
  close: require('../_routes/trade/close'),
  'update-position': require('../_routes/trade/update-position')
};

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  const slug = req.query && req.query.slug != null ? String(req.query.slug) : '';
  const handler = HANDLERS[slug];
  if (!handler) return json(res, 404, { ok: false, error: 'not_found', segment: 'trade', slug });
  return handler(req, res);
};
