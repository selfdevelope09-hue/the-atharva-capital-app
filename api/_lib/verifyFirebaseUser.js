const { getAuth } = require('./firebaseAdmin');

async function verifyBearer(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    const err = new Error('Missing auth token');
    err.status = 401;
    throw err;
  }
  const auth = getAuth();
  return auth.verifyIdToken(token);
}

module.exports = { verifyBearer };
