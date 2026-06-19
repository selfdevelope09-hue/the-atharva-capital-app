/**
 * Adds missing Supabase columns for trades + chat (safe to run multiple times).
 * Needs Postgres URI once — Supabase Dashboard → Project Settings → Database → Connection string → URI.
 *
 * Windows PowerShell:
 *   $env:DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-....pooler.supabase.com:6543/postgres"
 *   npm run db:migrate-trading
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

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

async function main() {
  loadEnvLocal();
  const url = buildDatabaseUrl();
  if (!url) {
    console.error(`
Missing DATABASE_URL.

Do this once:
1) Supabase.com → your project → Settings (gear) → Database
2) Under "Connection string" choose URI, copy (you need the database password)
3) Create ".env.local" with either:
   DATABASE_URL=postgresql://...
   OR
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_DB_PASSWORD=your_db_password

4) Run again: npm run db:migrate-trading
`);
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '..', 'supabase', 'trading_columns_migration.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client({
    connectionString: url,
    ssl: url.includes('localhost') ? false : { rejectUnauthorized: false }
  });
  await client.connect();
  await client.query(sql);
  try {
    await client.query(
      'alter table public.dm_messages add column if not exists image_url text;'
    );
    console.log('Also applied dm_messages.image_url (chat photos).');
  } catch (e) {
    const msg = String(e.message || '');
    if (/relation .*dm_messages.*does not exist/i.test(msg)) {
      console.warn(
        'Skipped dm_messages (table missing). If you use Supabase chat, run full supabase/schema.sql first.'
      );
    } else if (!/duplicate column/i.test(msg)) {
      await client.end();
      throw e;
    }
  }
  await client.end();
  console.log('Done — users table has positions / balance / daily-trade columns.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
