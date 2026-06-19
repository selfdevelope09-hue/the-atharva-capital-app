require('dotenv').config({ path: '/opt/auron-realtime/.env' });
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.PG_URL });
p.query(
  `select
    (select count(*)::int from users) as users,
    (select count(*)::int from dm_threads) as dm_threads,
    (select count(*)::int from dm_messages) as dm_messages`
)
  .then((r) => {
    console.log(JSON.stringify(r.rows[0]));
    return p.end();
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
