const { openTrade } = require('../src/services/trading/engine');
const { getUserByUid } = require('../src/db/usersRepo');

async function main() {
  const uid = process.argv[2] || 'showcase__P6XgRqxBPPFyynIE1jzn';
  const before = await getUserByUid(uid);
  console.log('before balance', before?.virtual_balance, 'positions', (before?.positions || []).length);
  const decoded = { uid: '8i1gWBZLj7NOdWTTj3Cg4sgCW4I2', email: 'test@test.com', name: 'Dev' };
  const result = await openTrade(uid, decoded, {
    symbol: 'BTCUSDT',
    side: 'BUY',
    leverage: 10,
    amount: 100,
    execPrice: 95000,
    orderType: 'Market'
  });
  console.log('result', JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error('THROW', e);
  process.exit(1);
});
