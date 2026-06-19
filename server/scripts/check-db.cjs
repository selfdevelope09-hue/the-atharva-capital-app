const { getPool } = require('../src/db/pool');

async function main() {
  const pool = getPool();
  const cols = await pool.query(
    `select column_name from information_schema.columns where table_name='dm_messages' order by 1`
  );
  console.log('dm_messages columns:', cols.rows.map((r) => r.column_name).join(', '));
  const showcase = await pool.query(
    `select uid, virtual_balance, pg_typeof(virtual_balance) as t, jsonb_typeof(positions) as pos_t
     from users where uid like 'showcase__%' limit 3`
  );
  console.log('showcase sample:', JSON.stringify(showcase.rows, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
