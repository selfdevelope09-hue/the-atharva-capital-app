const fs = require('fs');
const path = require('path');
const { getPool } = require('../src/db/pool');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'paid-free-reset-schema.sql'), 'utf8');
  await getPool().query(sql);
  console.log('paid-free-reset-schema applied.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
