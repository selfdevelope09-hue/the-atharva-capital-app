const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const pgUrl = process.env.PG_URL;
  if (!pgUrl) throw new Error('Missing PG_URL');
  const sql = fs.readFileSync(path.join(__dirname, '../sql/unlimited-pnl-schema.sql'), 'utf8');
  const pool = new Pool({ connectionString: pgUrl });
  await pool.query(sql);
  await pool.end();
  console.log('unlimited-pnl-schema applied');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
