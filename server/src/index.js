const http = require('http');
const express = require('express');
const cors = require('cors');
const { port, corsOrigins, pgUrl } = require('./config/env');
const { initFirebase } = require('./lib/firebaseAdmin');
const { getPool } = require('./db/pool');
const { attachSocketIo } = require('./sockets');
const { publicRouter, router: apiRoutes } = require('./http/apiRoutes');
const adminRoutes = require('./http/adminRoutes');
const { registerTvRoutes } = require('./routes/tvHttp');
const { verifyHttpAuth } = require('./middleware/httpAuth');
const { UPLOAD_ROOT } = require('./lib/mediaUpload');
const { maybeAutoFinalizeLeaderboardCampaign } = require('./lib/leaderboardCampaign');

async function main() {
  if (!pgUrl) throw new Error('Missing PG_URL');

  initFirebase();
  await getPool().query('select 1');

  const app = express();
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '12mb' }));
  app.use(express.json({ limit: '12mb' }));
  app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: '7d', immutable: true }));

  registerTvRoutes(app, { verifyHttpAuth });

  app.get('/health', async (_req, res) => {
    try {
      await getPool().query('select 1');
      res.json({ ok: true, service: 'auron-realtime', ts: new Date().toISOString() });
    } catch (e) {
      res.status(503).json({ ok: false, error: e?.message });
    }
  });

  app.use(publicRouter);
  app.use(apiRoutes);
  app.use(adminRoutes);

  const httpServer = http.createServer(app);
  attachSocketIo(httpServer, { corsOrigins });

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Auron realtime server listening on :${port}`);
  });

  setInterval(() => {
    maybeAutoFinalizeLeaderboardCampaign().catch((e) => {
      console.warn('leaderboard campaign tick', e?.message || e);
    });
  }, 30000);
  maybeAutoFinalizeLeaderboardCampaign().catch(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
