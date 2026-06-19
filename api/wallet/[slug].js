const { json, applyApiCors, handleCorsPreflight } = require('../_lib/http');
const { dataViaDigitalOcean, proxyJsonToDigitalOcean } = require('../_lib/proxyToDigitalOcean.cjs');

const HANDLERS = {
  'account-reset': require('../_routes/wallet/account-reset'),
  'paid-free-reset': require('../_routes/wallet/paid-free-reset'),
  'ad-trade-bonus': require('../_routes/wallet/ad-trade-bonus'),
  'virtual-balance-delta': require('../_routes/wallet/virtual-balance-delta')
};

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  const slug = req.query && req.query.slug != null ? String(req.query.slug) : '';
  if (dataViaDigitalOcean() && slug) {
    return proxyJsonToDigitalOcean(req, res, `/api/wallet/${slug}`);
  }
  const handler = HANDLERS[slug];
  if (!handler) return json(res, 404, { ok: false, error: 'not_found', segment: 'wallet', slug });
  return handler(req, res);
};
