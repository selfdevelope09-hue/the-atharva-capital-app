const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

let initialized = false;

function loadServiceAccount() {
  const filePath = path.join(__dirname, '../../serviceAccount.json');
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('Missing serviceAccount.json or FIREBASE_SERVICE_ACCOUNT_JSON');
  }
  return JSON.parse(raw);
}

function initFirebase() {
  if (initialized) return admin;
  if (!admin.apps.length) {
    const sa = loadServiceAccount();
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  initialized = true;
  return admin;
}

function getAuth() {
  return initFirebase().auth();
}

module.exports = { initFirebase, getAuth };
