const { json, applyApiCors, handleCorsPreflight } = require('../_lib/http');
const { dataViaDigitalOcean, proxyJsonToDigitalOcean } = require('../_lib/proxyToDigitalOcean.cjs');

const HANDLERS = {
  me: require('../_routes/data/me'),
  leaderboard: require('../_routes/data/leaderboard'),
  'leaderboard-winners': require('../_routes/data/leaderboard-winners'),
  presence: require('../_routes/data/presence'),
  'presence-minute': require('../_routes/data/presence-minute'),
  'creds-ratings': require('../_routes/data/creds-ratings'),
  'user-public': require('../_routes/data/user-public'),
  'users-bulk': require('../_routes/data/users-bulk')
};

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  const slug = req.query && req.query.slug != null ? String(req.query.slug) : '';
  if (dataViaDigitalOcean() && slug) {
    const publicSlugs = new Set(['app-login', 'leaderboard-winners']);
    return proxyJsonToDigitalOcean(req, res, `/api/data/${slug}`, {
      requireAuth: !publicSlugs.has(slug)
    });
  }
  const handler = HANDLERS[slug];
  if (!handler) return json(res, 404, { ok: false, error: 'not_found', segment: 'data', slug });
  return handler(req, res);
};
