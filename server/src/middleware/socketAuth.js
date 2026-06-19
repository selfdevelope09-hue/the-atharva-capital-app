const { getAuth } = require('../lib/firebaseAdmin');
const { blockedUids } = require('../config/env');
const { isUidRemoved } = require('../lib/removedUsers');

async function socketAuthMiddleware(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Missing auth token'));

    const decoded = await getAuth().verifyIdToken(token);
    if (blockedUids.has(decoded.uid)) {
      return next(new Error('Account restricted'));
    }
    if (await isUidRemoved(decoded.uid)) {
      return next(new Error('Account removed'));
    }

    socket.uid = decoded.uid;
    socket.decoded = decoded;
    next();
  } catch (e) {
    next(new Error(e?.message || 'Invalid token'));
  }
}

module.exports = { socketAuthMiddleware };
