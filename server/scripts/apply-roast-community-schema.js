const fs = require('fs');
const path = require('path');
const { getPool } = require('../src/db/pool');

async function main() {
  const sqlPath = path.join(__dirname, '..', 'sql', 'roast-community-schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await getPool().query(sql);
  console.log('roast-community-schema applied');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
