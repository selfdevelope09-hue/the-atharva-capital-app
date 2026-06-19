const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function main() {
  const pgUrl = process.env.PG_URL || process.env.DATABASE_URL;
  if (!pgUrl) throw new Error('Missing PG_URL');
  const sql = fs.readFileSync(path.join(__dirname, '../sql/creds-schema.sql'), 'utf8');
  const pool = new Pool({
    connectionString: pgUrl,
    ssl: pgUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
  });
  await pool.query(sql);
  await pool.end();
  console.log('creds-schema applied.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
