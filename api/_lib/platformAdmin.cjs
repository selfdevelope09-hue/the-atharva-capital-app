const { getFirestore } = require('./firebaseAdmin');

const PRIMARY_FALLBACK = '8i1gWBZLj7NOdWTTj3Cg4sgCW4I2';

/**
 * @param {string} uid
 * @returns {Promise<boolean>}
 */
async function isPlatformAdminUid(uid) {
  if (!uid) return false;
  const db = getFirestore();
  const snap = await db.collection('config').doc('stockTipEditors').get();
  const list = snap.exists && Array.isArray(snap.data()?.uids) ? snap.data().uids.map(String) : [];
  if (list.includes(uid)) return true;
  return uid === PRIMARY_FALLBACK;
}

module.exports = { isPlatformAdminUid, PRIMARY_FALLBACK };
