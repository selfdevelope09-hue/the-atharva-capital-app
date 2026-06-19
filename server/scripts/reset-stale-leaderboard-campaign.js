const { ensureActiveLeaderboardCampaign } = require('../src/lib/leaderboardCampaign');
const { initFirebase } = require('../src/lib/firebaseAdmin');
const { getPool } = require('../src/db/pool');

async function clearFirestoreFreeze() {
  try {
    initFirebase();
    const admin = require('firebase-admin');
    await admin.firestore().collection('config').doc('leaderboardFreeze').set(
      { frozen: false, snapshot: [], message: '' },
      { merge: true }
    );
    console.log('Firestore leaderboardFreeze cleared');
  } catch (e) {
    console.warn('Firestore freeze clear skipped:', e?.message || e);
  }
}

async function clearSupabaseAppSettingsFreeze() {
  try {
    await getPool().query(
      `update app_settings set
        leaderboard_frozen = false,
        frozen_message = '',
        leaderboard_snapshot = null
       where id = 'global'`
    );
    console.log('app_settings leaderboard freeze cleared');
  } catch (e) {
    console.warn('app_settings clear skipped:', e?.message || e);
  }
}

async function main() {
  const cfg = await ensureActiveLeaderboardCampaign();
  console.log('leaderboard campaign:', cfg?.campaignKey, 'finalized:', cfg?.finalized);
  await clearFirestoreFreeze();
  await clearSupabaseAppSettingsFreeze();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
