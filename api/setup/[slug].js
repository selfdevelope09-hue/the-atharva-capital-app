const { json, applyApiCors, handleCorsPreflight } = require('../_lib/http');
const { hasSupabaseTradingColumns } = require('../_lib/checkSupabaseTradingSchema.cjs');
const { supabaseConfigured } = require('../_lib/supabaseConfigured.cjs');
const { ensureTradingSchema } = require('../_lib/ensureTradingSchema.cjs');
const { useFirebaseOnly } = require('../_lib/firebaseOnly.cjs');

const HANDLERS = {
  status: async (req, res) => {
    if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });
    const configured = supabaseConfigured();
    let columnsOk = false;
    if (configured) {
      try {
        columnsOk = await hasSupabaseTradingColumns();
      } catch {
        columnsOk = false;
      }
    }
    const firebaseOnly = useFirebaseOnly();
    return json(res, 200, {
      ok: true,
      firebaseOnly,
      supabaseConfigured: configured,
      tradingColumnsOk: firebaseOnly ? null : columnsOk,
      needsSql:
        firebaseOnly
          ? null
          : configured && !columnsOk
            ? 'Run supabase/trading_columns_migration.sql in Supabase SQL Editor (or set DATABASE_URL on Vercel).'
            : null,
      message: firebaseOnly
        ? 'Production uses Firebase (Firestore) only for trades, profile, and portfolio.'
        : undefined
    });
  },
  migrate: async (req, res) => {
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
    const ran = await ensureTradingSchema();
    const columnsOk = ran ? await hasSupabaseTradingColumns() : await hasSupabaseTradingColumns().catch(() => false);
    return json(res, ran ? 200 : 503, {
      ok: ran && columnsOk,
      migrated: ran,
      tradingColumnsOk: columnsOk,
      hint: ran
        ? 'Trading columns ready'
        : 'Add DATABASE_URL or SUPABASE_DB_PASSWORD on Vercel, or run SQL in Supabase dashboard'
    });
  }
};

function pickSlug(req) {
  const pathOnly = String(req.url || '').split('?')[0];
  const m = pathOnly.match(/\/api\/setup\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]).trim() : '';
}

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  const slug = pickSlug(req);
  const handler = HANDLERS[slug];
  if (!handler) return json(res, 404, { ok: false, error: 'not_found', slug });
  return handler(req, res);
};
