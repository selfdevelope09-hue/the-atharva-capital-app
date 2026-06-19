const {
  issueChartUserKey,
  handleCharts,
  handleStudyTemplates,
  tvError
} = require('../lib/tvStoragePg');

function readFormBody(req) {
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string' && b.trim()) {
    try {
      return JSON.parse(b);
    } catch {
      return Object.fromEntries(new URLSearchParams(b).entries());
    }
  }
  return {};
}

function registerTvRoutes(app, { verifyHttpAuth }) {
  app.get('/api/tv/chart-key', verifyHttpAuth, async (req, res) => {
    try {
      const issued = await issueChartUserKey(req.user.uid);
      res.json({ ok: true, ...issued });
    } catch (e) {
      res.status(Number(e.status) || 500).json({ ok: false, error: e.message || 'error' });
    }
  });

  app.post('/api/tv/chart-key', verifyHttpAuth, async (req, res) => {
    try {
      const issued = await issueChartUserKey(req.user.uid);
      res.json({ ok: true, ...issued });
    } catch (e) {
      res.status(Number(e.status) || 500).json({ ok: false, error: e.message || 'error' });
    }
  });

  const storageHandler = async (req, res) => {
    try {
      const resource = String(req.params.resource || '');
      if (resource === 'charts') return handleCharts(req, res, readFormBody);
      if (resource === 'study_templates') return handleStudyTemplates(req, res, readFormBody);
      return res.status(404).json({ status: 'error', message: 'not_found' });
    } catch (e) {
      const status = Number(e.status) || 500;
      return res.status(status).json({ status: 'error', message: e.message || 'error' });
    }
  };

  app.get('/api/tv-storage/:version/:resource', storageHandler);
  app.post('/api/tv-storage/:version/:resource', storageHandler);
  app.delete('/api/tv-storage/:version/:resource', storageHandler);
}

module.exports = { registerTvRoutes };
