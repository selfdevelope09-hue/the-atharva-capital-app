const { getFirestore } = require('./firebaseAdmin');

async function getBlockedUidSet() {
  try {
    const snap = await getFirestore().collection('config').doc('blockedUsers').get();
    if (!snap.exists) return new Set();
    const uids = Array.isArray(snap.data()?.uids) ? snap.data().uids.map(String) : [];
    return new Set(uids);
  } catch {
    return new Set();
  }
}

module.exports = { getBlockedUidSet };
