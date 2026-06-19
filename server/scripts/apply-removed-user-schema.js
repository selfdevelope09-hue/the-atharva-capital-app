const path = require('path');
const fs = require('fs');
const { getPool } = require('../src/db/pool');

async function main() {
  const sqlPath = path.join(__dirname, '..', 'sql', 'removed-user-schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await getPool().query(sql);
  console.log('removed-user-schema applied');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
