const admin = require('firebase-admin');

let app;

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON');
  }
  return JSON.parse(raw);
}

function getAdminApp() {
  if (app) return app;
  if (admin.apps.length > 0) {
    app = admin.apps[0];
    return app;
  }
  app = admin.initializeApp({
    credential: admin.credential.cert(getServiceAccount())
  });
  return app;
}

function getFirestore() {
  return getAdminApp().firestore();
}

function getAuth() {
  return getAdminApp().auth();
}

module.exports = { getFirestore, getAuth };
