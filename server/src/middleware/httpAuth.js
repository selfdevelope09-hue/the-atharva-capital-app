const { getAuth } = require('../lib/firebaseAdmin');
const { blockedUids } = require('../config/env');
const { isUidRemoved } = require('../lib/removedUsers');

async function verifyHttpAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ ok: false, error: 'Missing auth token' });
      return;
    }
    const decoded = await getAuth().verifyIdToken(token);
    if (blockedUids.has(decoded.uid)) {
      res.status(403).json({ ok: false, error: 'Account restricted', platformBlocked: true });
      return;
    }
    if (await isUidRemoved(decoded.uid)) {
      res.status(403).json({
        ok: false,
        error: 'Account removed',
        accountRemoved: true,
        platformBlocked: true
      });
      return;
    }
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ ok: false, error: e?.message || 'Invalid token' });
  }
}

module.exports = { verifyHttpAuth };
