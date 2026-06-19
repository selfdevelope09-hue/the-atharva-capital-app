require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.PG_URL });
  const r = await pool.query('select count(*)::int as n from users');
  console.log('PG_OK users_count=' + r.rows[0].n);
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
