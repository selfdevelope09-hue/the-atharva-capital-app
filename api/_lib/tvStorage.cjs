const crypto = require('crypto');
const { getFirestore } = require('./firebaseAdmin');

const TV_CLIENT_ID = 'auronx';
const CHART_KEY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function tvError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parseUrlQuery(req) {
  const raw = String(req.url || '');
  const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
  return new URLSearchParams(q);
}

function readFormFields(req) {
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string' && b.trim()) {
    return Object.fromEntries(new URLSearchParams(b).entries());
  }
  return {};
}

async function issueChartUserKey(uid) {
  const key = crypto.randomBytes(18).toString('hex');
  const expiresAt = Date.now() + CHART_KEY_TTL_MS;
  await getFirestore()
    .collection('tvChartKeys')
    .doc(key)
    .set({ uid, expiresAt, createdAt: Date.now() });
  return { chartUserId: key, clientId: TV_CLIENT_ID, expiresAt };
}

async function resolveChartUserKey(chartUserId) {
  const id = String(chartUserId || '').trim();
  if (!id || id.length > 64) throw tvError('Invalid chart user', 401);
  const snap = await getFirestore().collection('tvChartKeys').doc(id).get();
  if (!snap.exists) throw tvError('Chart session expired — refresh Trade page', 401);
  const data = snap.data() || {};
  if (Number(data.expiresAt) < Date.now()) {
    await snap.ref.delete().catch(() => {});
    throw tvError('Chart session expired — refresh Trade page', 401);
  }
  return { uid: String(data.uid || ''), chartUserId: id };
}

function chartsCol() {
  return getFirestore().collection('tvCharts');
}

function templatesCol() {
  return getFirestore().collection('tvStudyTemplates');
}

module.exports = {
  TV_CLIENT_ID,
  tvError,
  parseUrlQuery,
  readFormFields,
  issueChartUserKey,
  resolveChartUserKey,
  chartsCol,
  templatesCol
};
