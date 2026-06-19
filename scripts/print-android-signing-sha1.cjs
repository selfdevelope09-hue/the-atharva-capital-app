/**
 * Prints SHA-1 / SHA-256 for the release upload keystore (paste into Firebase Android app).
 * Usage: node scripts/print-android-signing-sha1.cjs
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const propsPath = path.join(__dirname, '..', 'android', 'keystore.properties');
if (!fs.existsSync(propsPath)) {
  console.error('Missing android/keystore.properties — copy from keystore.properties.example');
  process.exit(1);
}
const props = Object.fromEntries(
  fs
    .readFileSync(propsPath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    })
);
const storeFile = path.join(__dirname, '..', 'android', props.storeFile || 'auronx-upload.keystore');
const alias = props.keyAlias || 'auronx';
const storePass = props.storePassword;
const keyPass = props.keyPassword || storePass;

if (!storePass) {
  console.error('keystore.properties missing storePassword');
  process.exit(1);
}

console.log('\n=== Release keystore fingerprints (Firebase → Android app → Add fingerprint) ===\n');
console.log('Keystore:', storeFile);
console.log('Alias:', alias);
console.log('Package: com.theatharvacapital.auronxtrade\n');

try {
  const out = execSync(
    `keytool -list -v -keystore "${storeFile}" -alias ${alias} -storepass ${storePass} -keypass ${keyPass}`,
    { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }
  );
  const sha1 = (out.match(/SHA1:\s*([^\n]+)/i) || [])[1];
  const sha256 = (out.match(/SHA256:\s*([^\n]+)/i) || [])[1];
  if (sha1) console.log('SHA-1:  ', sha1.trim());
  if (sha256) console.log('SHA-256:', sha256.trim());
  console.log('\nAlso add Play App Signing SHA-1 from Play Console → Setup → App integrity → App signing key.\n');
  console.log('Then: download new google-services.json → android/app/google-services.json → rebuild APK.\n');
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
