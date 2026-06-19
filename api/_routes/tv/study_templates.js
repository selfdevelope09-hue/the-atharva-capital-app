const { json, applyApiCors, handleCorsPreflight } = require('../../_lib/http');
const {
  TV_CLIENT_ID,
  tvError,
  parseUrlQuery,
  readFormFields,
  resolveChartUserKey,
  templatesCol
} = require('../../_lib/tvStorage.cjs');

function tvJson(res, status, payload) {
  return json(res, status, payload);
}

function assertClient(clientId) {
  if (String(clientId || '') !== TV_CLIENT_ID) throw tvError('Invalid client', 403);
}

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;

  try {
    const q = parseUrlQuery(req);
    const clientId = q.get('client') || '';
    const chartUserId = q.get('user') || '';
    const templateName = q.get('template') || '';

    assertClient(clientId);
    const { chartUserId: userKey } = await resolveChartUserKey(chartUserId);

    if (req.method === 'GET') {
      if (!templateName) {
        const snap = await templatesCol()
          .where('clientId', '==', TV_CLIENT_ID)
          .where('userKey', '==', userKey)
          .limit(80)
          .get();
        const data = snap.docs.map((d) => String((d.data() || {}).name || d.id));
        return tvJson(res, 200, { status: 'ok', data });
      }

      const snap = await templatesCol()
        .where('clientId', '==', TV_CLIENT_ID)
        .where('userKey', '==', userKey)
        .get();
      const doc = snap.docs.find((d) => String((d.data() || {}).name || '') === String(templateName));
      if (!doc) return tvJson(res, 200, { status: 'error', message: 'Template not found' });
      const row = doc.data() || {};
      return tvJson(res, 200, {
        status: 'ok',
        data: { name: row.name, content: row.content || '' }
      });
    }

    if (req.method === 'DELETE') {
      if (!templateName) return tvJson(res, 200, { status: 'error', message: 'Wrong template name' });
      const snap = await templatesCol()
        .where('clientId', '==', TV_CLIENT_ID)
        .where('userKey', '==', userKey)
        .get();
      const doc = snap.docs.find((d) => String((d.data() || {}).name || '') === String(templateName));
      if (!doc) return tvJson(res, 200, { status: 'error', message: 'Template not found' });
      await doc.ref.delete();
      return tvJson(res, 200, { status: 'ok' });
    }

    if (req.method === 'POST') {
      const body = readFormFields(req);
      const name = String(body.name || templateName || '').slice(0, 120);
      const content = String(body.content || '');
      if (!name) return tvJson(res, 200, { status: 'error', message: 'Missing template name' });

      const snap = await templatesCol()
        .where('clientId', '==', TV_CLIENT_ID)
        .where('userKey', '==', userKey)
        .get();
      const existing = snap.docs.find((d) => String((d.data() || {}).name || '') === name);

      const now = Date.now();
      if (!existing) {
        await templatesCol().add({
          clientId: TV_CLIENT_ID,
          userKey,
          name,
          content,
          createdAt: now,
          updatedAt: now
        });
      } else {
        await existing.ref.set({ content, updatedAt: now }, { merge: true });
      }
      return tvJson(res, 200, { status: 'ok' });
    }

    return tvJson(res, 405, { status: 'error', message: 'Wrong request' });
  } catch (e) {
    const status = Number(e.status) || 500;
    return tvJson(res, status, { status: 'error', message: e.message || 'Server error' });
  }
};
