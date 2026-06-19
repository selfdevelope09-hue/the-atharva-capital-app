const { json, applyApiCors, handleCorsPreflight } = require('../_lib/http');

const HANDLERS = {
  'monthly-tick': require('../_routes/cron/monthly-tick')
};

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  const slug = req.query && req.query.slug != null ? String(req.query.slug) : '';
  const handler = HANDLERS[slug];
  if (!handler) return json(res, 404, { ok: false, error: 'not_found', segment: 'cron', slug });
  return handler(req, res);
};
