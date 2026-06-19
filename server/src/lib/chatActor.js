const { isPlatformAdminUid } = require('./platformAdminPg');

/**
 * Resolve which uid chat APIs should use (real user or showcase when admin is acting).
 */
async function resolveChatActor(req) {
  const authUid = req.user.uid;
  const asUid = String(
    req.query?.asUid || req.body?.asUid || req.headers['x-chat-as-uid'] || ''
  ).trim();
  if (!asUid || asUid === authUid) return authUid;
  if (asUid.startsWith('showcase__') && (await isPlatformAdminUid(authUid))) return asUid;
  const err = new Error('Forbidden');
  err.statusCode = 403;
  throw err;
}

function threadIncludesUid(thread, uid) {
  return Array.isArray(thread?.participants) && thread.participants.includes(uid);
}

module.exports = { resolveChatActor, threadIncludesUid };
