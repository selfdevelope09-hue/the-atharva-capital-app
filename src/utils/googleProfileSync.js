import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { isFirestoreDisabled } from '../config/dataBackend';
import { bff } from '../api/serverBff';
import { toUidList } from './userDoc';

/** If own user doc has map/non-array followers/following, migrate so arrayUnion works. */
export const maybeMigrateFollowArrays = async (uid) => {
  if (!uid || isFirestoreDisabled()) return;
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const d = snap.data();
    const patch = {};
    if (d.followers != null && !Array.isArray(d.followers)) patch.followers = toUidList(d.followers);
    if (d.following != null && !Array.isArray(d.following)) patch.following = toUidList(d.following);
    if (Object.keys(patch).length) await updateDoc(ref, patch);
  } catch (e) {
    console.warn('maybeMigrateFollowArrays', e);
  }
};

export const syncGoogleProfileToFirestore = async (u) => {
  const isGoogle = u.providerData?.some((p) => p.providerId === 'google.com');
  if (!isGoogle || !u.uid) return false;
  if (isFirestoreDisabled()) {
    try {
      const patch = {};
      const dn = u.displayName?.trim();
      if (dn) patch.name = dn;
      const authPhoto = String(u.photoURL || '').trim();
      if (authPhoto) patch.photoURL = authPhoto;
      if (!Object.keys(patch).length) return false;
      await bff('/api/data/me', { method: 'PATCH', body: JSON.stringify(patch) });
      return true;
    } catch (e) {
      console.warn('syncGoogleProfileToServer', e);
      return false;
    }
  }
  try {
    const ref = doc(db, 'users', u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const ex = snap.data();
    const patch = {};
    const dn = u.displayName?.trim();
    if (dn && !String(ex.name || '').trim()) patch.name = dn;
    const authPhoto = String(u.photoURL || '').trim();
    const exPhoto = String(ex.photoURL || '').trim();
    const exIsGoogle = /googleusercontent\.com|ggpht\.com/i.test(exPhoto);
    if (authPhoto && (!exPhoto || exIsGoogle) && exPhoto !== authPhoto) {
      patch.photoURL = authPhoto;
    } else if (authPhoto && !exPhoto) {
      patch.photoURL = authPhoto;
    }
    if (Object.keys(patch).length === 0) return false;
    await updateDoc(ref, patch);
    return true;
  } catch (e) {
    console.warn('syncGoogleProfileToFirestore', e);
    return false;
  }
};
