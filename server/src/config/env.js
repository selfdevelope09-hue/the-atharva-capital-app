require('dotenv').config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const corsOrigins = String(process.env.CORS_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

module.exports = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  pgUrl: process.env.PG_URL || process.env.DATABASE_URL,
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  blockedUids: new Set(
    String(process.env.BLOCKED_UIDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  ),
  corsOrigins: corsOrigins.length ? corsOrigins : ['*'],
  get pgUrlRequired() {
    return required('PG_URL');
  },
  get firebaseSaRequired() {
    return required('FIREBASE_SERVICE_ACCOUNT_JSON');
  }
};
