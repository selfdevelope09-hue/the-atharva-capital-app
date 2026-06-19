const { isPlatformAdminUid } = require('./platformAdminPg');

/** Admin opens/closes trades on showcase__* profiles (Open as User). */
async function resolveTradeActorUid(authUid, body) {
  const asUid = String(body?.asUid || '').trim();
  if (!asUid || asUid === authUid) return authUid;
  if (asUid.startsWith('showcase__') && (await isPlatformAdminUid(authUid))) return asUid;
  const err = new Error('Forbidden');
  err.statusCode = 403;
  throw err;
}

function isShowcaseTradeUid(uid) {
  return String(uid || '').startsWith('showcase__');
}

module.exports = { resolveTradeActorUid, isShowcaseTradeUid };
