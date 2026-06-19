import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, disableNetwork } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { isFirestoreDisabled } from './config/dataBackend';

const firebaseConfig = {
  apiKey: 'AIzaSyB4bz_8fGhrCqyyV-N_pA7s7dzVMKIPn_w',
  authDomain: 'theatharvacapital-trading.firebaseapp.com',
  projectId: 'theatharvacapital-trading',
  storageBucket: 'theatharvacapital-trading.firebasestorage.app',
  messagingSenderId: '644668465681',
  appId: '1:644668465681:web:664ff835f83c55765007b0'
};

const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

/** Restore session from disk immediately (faster return visits). */
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

/** Postgres mode: block all Firestore reads/writes from the web app (auth + storage only). */
if (typeof window !== 'undefined' && isFirestoreDisabled()) {
  disableNetwork(db).catch(() => {});
}

/** Explicit bucket avoids wrong default in some hosting builds. */
export const storage = getStorage(firebaseApp, `gs://${firebaseConfig.storageBucket}`);
export { firebaseApp };
