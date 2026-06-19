const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { json, readBody, applyApiCors, handleCorsPreflight } = require('../../_lib/http');
const { isUidRemoved } = require('../../_lib/removedUsers.cjs');

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const decoded = await verifyBearer(req);
    if (await isUidRemoved(decoded.uid)) {
      return json(res, 403, {
        ok: false,
        error: 'Account removed',
        accountRemoved: true,
        platformBlocked: true
      });
    }
    const body = readBody(req);
    const threadId = String(body.threadId || '').trim();
    const text = String(body.text || '').trim();
    const imageUrl = String(body.imageUrl || '').trim();
    const activeOtherId = String(body.activeOtherId || '').trim();
    const replyTo = body.replyTo && typeof body.replyTo === 'object' ? body.replyTo : null;
    const fromName = String(body.fromName || 'Trader');
    if (!threadId || !activeOtherId || (!text && !imageUrl)) {
      return json(res, 400, { ok: false, error: 'Missing fields' });
    }
    const supa = getSupabaseAdmin();
    const { data: t, error: te } = await supa.from('dm_threads').select('*').eq('id', threadId).maybeSingle();
    if (te) throw te;
    if (!t?.participants?.includes(decoded.uid) || !t.participants.includes(activeOtherId)) {
      return json(res, 403, { ok: false, error: 'Forbidden' });
    }

    const ins = await supa.from('dm_messages').insert({
      thread_id: threadId,
      from_uid: decoded.uid,
      from_name: fromName,
      text: text || '',
      image_url: imageUrl || null,
      reply_to: replyTo
    });
    if (ins.error) throw ins.error;

    const unread = { ...(t.unread_by_user || {}) };
    unread[activeOtherId] = Number(unread[activeOtherId] || 0) + 1;
    const up = await supa
      .from('dm_threads')
      .update({
        last_preview: (imageUrl ? (text ? text.slice(0, 100) : '📷 Photo') : text.slice(0, 120)),
        last_from_name: fromName,
        unread_by_user: unread,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId);
    if (up.error) throw up.error;
    return json(res, 200, { ok: true });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
