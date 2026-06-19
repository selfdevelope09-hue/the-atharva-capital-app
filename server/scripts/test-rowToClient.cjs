const { getUserByUid } = require('../src/db/usersRepo');
const { rowToClient } = require('../src/lib/userRowMap');

async function main() {
  const uid = process.argv[2] || 'showcase__P6XgRqxBPPFyynIE1jzn';
  const row = await getUserByUid(uid);
  try {
    const client = rowToClient(row);
    console.log('rowToClient ok', client.uid, client.virtualBalance);
  } catch (e) {
    console.error('rowToClient FAIL', e);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
