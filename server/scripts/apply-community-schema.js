const fs = require('fs');
const path = require('path');
const { getPool } = require('../src/db/pool');

async function main() {
  const sqlPath = path.join(__dirname, '..', 'sql', 'community-chat-schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await getPool().query(sql);
  console.log('community-chat-schema applied');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
