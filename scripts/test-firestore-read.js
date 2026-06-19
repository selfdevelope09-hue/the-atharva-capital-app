const fs = require('fs');
const admin = require('firebase-admin');
const sa = JSON.parse(fs.readFileSync('serviceAccount.json', 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
admin
  .firestore()
  .collection('users')
  .limit(1)
  .get()
  .then((s) => {
    console.log('FIRESTORE_OK', s.size);
    process.exit(0);
  })
  .catch((e) => {
    console.log('FIRESTORE_ERR', e.code || '', String(e.message).slice(0, 200));
    process.exit(1);
  });
