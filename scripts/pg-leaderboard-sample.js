const { Pool } = require('pg');
(async () => {
  const pgUrl = process.env.PG_URL || process.env.DATABASE_URL;
  const pool = new Pool({
    connectionString: pgUrl,
    ssl: pgUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
  });
  const { rows } = await pool.query(`
    select uid, name, virtual_balance, lifetime_realized_pnl,
      jsonb_array_length(coalesce(closed_positions,'[]'::jsonb)) as closed_n
    from users
    order by lifetime_realized_pnl desc nulls last
    limit 5
  `);
  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
})();
