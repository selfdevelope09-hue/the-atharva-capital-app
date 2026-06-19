const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { isPlatformAdminUid } = require('../../_lib/platformAdmin.cjs');
const { ensureTradingSchema } = require('../../_lib/ensureTradingSchema.cjs');
const { json, applyApiCors, handleCorsPreflight } = require('../../_lib/http');

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const decoded = await verifyBearer(req);
    const ok = await isPlatformAdminUid(decoded.uid);
    if (!ok) return json(res, 403, { ok: false, error: 'Admin only' });

    const ran = await ensureTradingSchema();
    if (!ran) {
      return json(res, 503, {
        ok: false,
        error:
          'DATABASE_URL not set on server. Add Supabase Postgres URI to Vercel env, or run supabase/trading_columns_migration.sql in Supabase SQL Editor.'
      });
    }
    return json(res, 200, { ok: true, message: 'Trading columns migration applied on public.users' });
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message || 'error' });
  }
};
