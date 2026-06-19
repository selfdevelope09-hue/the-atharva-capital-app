const { enableAllCommunityRooms } = require('../src/lib/roastCommunity');

enableAllCommunityRooms()
  .then(() => {
    console.log('All community group chats enabled.');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
