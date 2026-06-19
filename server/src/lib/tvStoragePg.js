const crypto = require('crypto');
const { getPool } = require('../db/pool');

const TV_CLIENT_ID = 'auronx';
const CHART_KEY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function tvError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parseUrlQuery(req) {
  const params = new URLSearchParams();
  const q = req?.query;
  if (q && typeof q === 'object') {
    for (const [k, v] of Object.entries(q)) {
      if (k === 'version' || k === 'resource' || k === 'slug') continue;
      if (v != null && String(v) !== '') params.set(k, String(v));
    }
  }
  const raw = String(req?.originalUrl || req?.url || '');
  if (raw.includes('?')) {
    for (const [k, v] of new URLSearchParams(raw.slice(raw.indexOf('?') + 1))) {
      if (!params.has(k)) params.set(k, v);
    }
  }
  return params;
}

async function issueChartUserKey(uid) {
  const uidStr = String(uid);
  const expiresAt = Date.now() + CHART_KEY_TTL_MS;
  const { rows } = await getPool().query(
    `select chart_user_id from tv_chart_keys where uid = $1 order by expires_at desc limit 1`,
    [uidStr]
  );
  if (rows[0]?.chart_user_id) {
    const chartUserId = String(rows[0].chart_user_id);
    await getPool().query(`update tv_chart_keys set expires_at = $2 where chart_user_id = $1`, [
      chartUserId,
      expiresAt
    ]);
    return { chartUserId, clientId: TV_CLIENT_ID, expiresAt };
  }
  const chartUserId = crypto.randomBytes(18).toString('hex');
  await getPool().query(
    `insert into tv_chart_keys (chart_user_id, uid, expires_at) values ($1, $2, $3)`,
    [chartUserId, uidStr, expiresAt]
  );
  return { chartUserId, clientId: TV_CLIENT_ID, expiresAt };
}

async function resolveChartUserKey(chartUserId) {
  const id = String(chartUserId || '').trim();
  if (!id || id.length > 64) throw tvError('Invalid chart user', 401);
  const { rows } = await getPool().query(
    `select uid, expires_at from tv_chart_keys where chart_user_id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) throw tvError('Chart session expired — refresh Trade page', 401);
  if (Number(row.expires_at) < Date.now()) {
    await getPool().query(`delete from tv_chart_keys where chart_user_id = $1`, [id]);
    throw tvError('Chart session expired — refresh Trade page', 401);
  }
  return { uid: String(row.uid || ''), chartUserId: id };
}

async function handleCharts(req, res, readBody) {
  const q = parseUrlQuery(req);
  const clientId = q.get('client') || '';
  const chartUserId = q.get('user') || '';
  const chartId = q.get('chart') || '';
  if (String(clientId) !== TV_CLIENT_ID) throw tvError('Invalid client', 403);
  const { chartUserId: userKey } = await resolveChartUserKey(chartUserId);

  if (req.method === 'GET') {
    if (!chartId) {
      const { rows } = await getPool().query(
        `select id, name, symbol, resolution, updated_at from tv_charts
         where client_id = $1 and user_key = $2
         order by updated_at desc limit 40`,
        [TV_CLIENT_ID, userKey]
      );
      const data = rows.map((r) => ({
        id: r.id,
        name: r.name || 'Chart',
        symbol: r.symbol || '',
        resolution: r.resolution || '',
        timestamp: Math.floor(Number(r.updated_at || 0) / 1000)
      }));
      return res.json({ status: 'ok', data });
    }
    const { rows } = await getPool().query(
      `select * from tv_charts where id = $1 and client_id = $2 and user_key = $3`,
      [chartId, TV_CLIENT_ID, userKey]
    );
    const row = rows[0];
    if (!row) return res.json({ status: 'error', message: 'Chart not found' });
    return res.json({
      status: 'ok',
      data: {
        id: row.id,
        name: row.name || 'Chart',
        timestamp: Math.floor(Number(row.updated_at || 0) / 1000),
        content: row.content || ''
      }
    });
  }

  if (req.method === 'DELETE') {
    if (!chartId) return res.json({ status: 'error', message: 'Wrong chart id' });
    const del = await getPool().query(
      `delete from tv_charts where id = $1 and client_id = $2 and user_key = $3 returning id`,
      [chartId, TV_CLIENT_ID, userKey]
    );
    if (!del.rowCount) return res.json({ status: 'error', message: 'Chart not found' });
    return res.json({ status: 'ok' });
  }

  if (req.method === 'POST') {
    const body = readBody(req) || {};
    const name = String(body.name || 'Chart').slice(0, 120);
    const symbol = String(body.symbol || '').slice(0, 64);
    const resolution = String(body.resolution || '').slice(0, 32);
    const content = String(body.content || '');
    const now = Date.now();
    if (!chartId) {
      const id = crypto.randomUUID();
      await getPool().query(
        `insert into tv_charts (id, client_id, user_key, name, symbol, resolution, content, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, TV_CLIENT_ID, userKey, name, symbol, resolution, content, now, now]
      );
      return res.json({ status: 'ok', id });
    }
    const up = await getPool().query(
      `update tv_charts set name=$4, symbol=$5, resolution=$6, content=$7, updated_at=$8
       where id=$1 and client_id=$2 and user_key=$3 returning id`,
      [chartId, TV_CLIENT_ID, userKey, name, symbol, resolution, content, now]
    );
    if (!up.rowCount) return res.json({ status: 'error', message: 'Chart not found' });
    return res.json({ status: 'ok' });
  }

  return res.status(405).json({ status: 'error', message: 'Wrong request' });
}

async function handleStudyTemplates(req, res, readBody) {
  const q = parseUrlQuery(req);
  const clientId = q.get('client') || '';
  const chartUserId = q.get('user') || '';
  const templateName = q.get('template') || '';
  if (String(clientId) !== TV_CLIENT_ID) throw tvError('Invalid client', 403);
  const { chartUserId: userKey } = await resolveChartUserKey(chartUserId);

  if (req.method === 'GET') {
    if (!templateName) {
      const { rows } = await getPool().query(
        `select name from tv_study_templates where client_id = $1 and user_key = $2 order by updated_at desc limit 80`,
        [TV_CLIENT_ID, userKey]
      );
      return res.json({ status: 'ok', data: rows.map((r) => r.name) });
    }
    const { rows } = await getPool().query(
      `select name, content from tv_study_templates where client_id = $1 and user_key = $2 and name = $3`,
      [TV_CLIENT_ID, userKey, templateName]
    );
    const row = rows[0];
    if (!row) return res.json({ status: 'error', message: 'Template not found' });
    return res.json({ status: 'ok', data: { name: row.name, content: row.content || '' } });
  }

  if (req.method === 'DELETE') {
    if (!templateName) return res.json({ status: 'error', message: 'Wrong template name' });
    const del = await getPool().query(
      `delete from tv_study_templates where client_id = $1 and user_key = $2 and name = $3 returning id`,
      [TV_CLIENT_ID, userKey, templateName]
    );
    if (!del.rowCount) return res.json({ status: 'error', message: 'Template not found' });
    return res.json({ status: 'ok' });
  }

  if (req.method === 'POST') {
    const body = readBody(req) || {};
    const name = String(body.name || templateName || '').slice(0, 120);
    const content = String(body.content || '');
    if (!name) return res.json({ status: 'error', message: 'Missing template name' });
    const now = Date.now();
    const { rows: existing } = await getPool().query(
      `select id from tv_study_templates where client_id = $1 and user_key = $2 and name = $3`,
      [TV_CLIENT_ID, userKey, name]
    );
    if (existing[0]?.id) {
      await getPool().query(
        `update tv_study_templates set content = $2, updated_at = $3 where id = $1`,
        [existing[0].id, content, now]
      );
    } else {
      await getPool().query(
        `insert into tv_study_templates (id, client_id, user_key, name, content, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [crypto.randomUUID(), TV_CLIENT_ID, userKey, name, content, now, now]
      );
    }
    return res.json({ status: 'ok' });
  }

  return res.status(405).json({ status: 'error', message: 'Wrong request' });
}

module.exports = {
  TV_CLIENT_ID,
  tvError,
  issueChartUserKey,
  resolveChartUserKey,
  handleCharts,
  handleStudyTemplates,
  parseUrlQuery
};
