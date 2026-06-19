const { json, applyApiCors, handleCorsPreflight } = require('../_lib/http');
const { dataViaDigitalOcean, proxyJsonToDigitalOcean } = require('../_lib/proxyToDigitalOcean.cjs');

const HANDLERS = {
  ensure: require('../_routes/chat/ensure'),
  'mark-read': require('../_routes/chat/mark-read'),
  messages: require('../_routes/chat/messages'),
  send: require('../_routes/chat/send'),
  threads: require('../_routes/chat/threads'),
  typing: require('../_routes/chat/typing')
};

/** Flat slugs → nested DigitalOcean paths (avoids extra Vercel serverless functions). */
const DO_CHAT_UPSTREAM = {
  'community-messages': '/api/chat/community/messages',
  'community-send': '/api/chat/community/send',
  'community-mark-read': '/api/chat/community/mark-read',
  'community-unread': '/api/chat/community/unread',
  'community-delete': '/api/chat/community/delete',
  'roast-leaderboard': '/api/chat/roast-leaderboard'
};

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  const slug = req.query && req.query.slug != null ? String(req.query.slug) : '';
  if (dataViaDigitalOcean() && slug) {
    const upstream = DO_CHAT_UPSTREAM[slug] || `/api/chat/${slug}`;
    return proxyJsonToDigitalOcean(req, res, upstream);
  }
  const handler = HANDLERS[slug];
  if (!handler) return json(res, 404, { ok: false, error: 'not_found', segment: 'chat', slug });
  return handler(req, res);
};
