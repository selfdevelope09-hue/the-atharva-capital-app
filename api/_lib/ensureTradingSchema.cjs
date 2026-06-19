const fs = require('fs');
const path = require('path');

let schemaAttempted = false;
let schemaReady = false;

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL || process.env.SUPABASE_DB_URL) {
    return process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  }
  const pass = process.env.SUPABASE_DB_PASSWORD;
  const supa = String(process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '');
  const m = supa.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (!pass || !m) return null;
  const ref = m[1];
  const region = process.env.SUPABASE_DB_REGION || 'ap-south-1';
  return `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
}

/** Add trading JSONB columns on public.users (needs DATABASE_URL on Vercel). Safe to re-run. */
async function ensureTradingSchema() {
  if (schemaReady) return true;
  const url = buildDatabaseUrl();
  if (!url) return false;
  if (schemaAttempted) return false;
  schemaAttempted = true;
  const run = async () => {
    const { Client } = require('pg');
    const sqlPath = path.join(__dirname, '..', '..', 'supabase', 'trading_columns_migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const client = new Client({
      connectionString: url,
      ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });
    await client.connect();
    await client.query(sql);
    await client.end();
  };
  try {
    await Promise.race([
      run(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('schema_migration_timeout')), 6000);
      })
    ]);
    schemaReady = true;
    console.log('[ensureTradingSchema] users trading columns OK');
    return true;
  } catch (e) {
    console.error('[ensureTradingSchema]', e?.message || e);
    return false;
  }
}

function isMissingTradingColumnError(err) {
  const raw = String(err?.message || err || '');
  return /column .* does not exist/i.test(raw) || /Could not find the .* column/i.test(raw);
}

module.exports = { ensureTradingSchema, isMissingTradingColumnError };
