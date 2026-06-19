const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { json, applyApiCors, handleCorsPreflight } = require('../../_lib/http');
const { issueChartUserKey } = require('../../_lib/tvStorage.cjs');

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const decoded = await verifyBearer(req);
    const issued = await issueChartUserKey(decoded.uid);
    return json(res, 200, { ok: true, ...issued });
  } catch (e) {
    const status = Number(e.status) || 500;
    return json(res, status, { ok: false, error: e.message || 'Unauthorized' });
  }
};
