const { json, applyApiCors, handleCorsPreflight } = require('../../_lib/http');
const { dataViaDigitalOcean, proxyJsonToDigitalOcean } = require('../../_lib/proxyToDigitalOcean.cjs');

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });
  if (dataViaDigitalOcean()) {
    return proxyJsonToDigitalOcean(req, res, '/api/data/leaderboard-winners', { requireAuth: false });
  }
  return json(res, 200, { ok: true, finalized: false, winners: [] });
};
