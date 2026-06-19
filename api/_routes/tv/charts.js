const { json, applyApiCors, handleCorsPreflight } = require('../../_lib/http');
const {
  TV_CLIENT_ID,
  tvError,
  parseUrlQuery,
  readFormFields,
  resolveChartUserKey,
  chartsCol
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
    const chartId = q.get('chart') || '';

    assertClient(clientId);
    const { chartUserId: userKey } = await resolveChartUserKey(chartUserId);

    if (req.method === 'GET') {
      if (!chartId) {
        const snap = await chartsCol()
          .where('clientId', '==', TV_CLIENT_ID)
          .where('userKey', '==', userKey)
          .get();
        const data = snap.docs
          .map((d) => {
            const row = d.data() || {};
            return {
              id: d.id,
              name: row.name || 'Chart',
              symbol: row.symbol || '',
              resolution: row.resolution || '',
              timestamp: Math.floor(Number(row.updatedAt || 0) / 1000)
            };
          })
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 40);
        return tvJson(res, 200, { status: 'ok', data });
      }

      const doc = await chartsCol().doc(String(chartId)).get();
      if (!doc.exists) return tvJson(res, 200, { status: 'error', message: 'Chart not found' });
      const row = doc.data() || {};
      if (row.userKey !== userKey || row.clientId !== TV_CLIENT_ID) {
        return tvJson(res, 200, { status: 'error', message: 'Chart not found' });
      }
      return tvJson(res, 200, {
        status: 'ok',
        data: {
          id: doc.id,
          name: row.name || 'Chart',
          timestamp: Math.floor(Number(row.updatedAt || 0) / 1000),
          content: row.content || ''
        }
      });
    }

    if (req.method === 'DELETE') {
      if (!chartId) return tvJson(res, 200, { status: 'error', message: 'Wrong chart id' });
      const ref = chartsCol().doc(String(chartId));
      const doc = await ref.get();
      if (!doc.exists || doc.data().userKey !== userKey) {
        return tvJson(res, 200, { status: 'error', message: 'Chart not found' });
      }
      await ref.delete();
      return tvJson(res, 200, { status: 'ok' });
    }

    if (req.method === 'POST') {
      const body = readFormFields(req);
      const name = String(body.name || 'Chart').slice(0, 120);
      const symbol = String(body.symbol || '').slice(0, 64);
      const resolution = String(body.resolution || '').slice(0, 32);
      const content = String(body.content || '');
      const now = Date.now();

      if (!chartId) {
        const ref = await chartsCol().add({
          clientId: TV_CLIENT_ID,
          userKey,
          name,
          symbol,
          resolution,
          content,
          createdAt: now,
          updatedAt: now
        });
        return tvJson(res, 200, { status: 'ok', id: ref.id });
      }

      const ref = chartsCol().doc(String(chartId));
      const doc = await ref.get();
      if (!doc.exists || doc.data().userKey !== userKey) {
        return tvJson(res, 200, { status: 'error', message: 'Chart not found' });
      }
      await ref.set(
        {
          clientId: TV_CLIENT_ID,
          userKey,
          name,
          symbol,
          resolution,
          content,
          updatedAt: now
        },
        { merge: true }
      );
      return tvJson(res, 200, { status: 'ok' });
    }

    return tvJson(res, 405, { status: 'error', message: 'Wrong request' });
  } catch (e) {
    const status = Number(e.status) || 500;
    return tvJson(res, status, { status: 'error', message: e.message || 'Server error' });
  }
};
