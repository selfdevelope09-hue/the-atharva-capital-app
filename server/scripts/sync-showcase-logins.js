/**
 * One-shot: set every showcase AuronX ID from display name + password atharva2530.
 * Usage: node scripts/sync-showcase-logins.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { syncAllShowcaseAppLogins } = require('../src/lib/appLogin');

(async () => {
  const { updated, total } = await syncAllShowcaseAppLogins();
  console.log(`showcase logins synced: ${updated}/${total}`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
