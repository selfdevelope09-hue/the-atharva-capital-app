const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { rowToClient, lastSeenFieldFromDb } = require('../../_lib/userRowMap');
const { json, readBody, applyApiCors, handleCorsPreflight } = require('../../_lib/http');
const { getFirestore } = require('../../_lib/firebaseAdmin');

function firestoreUserToClient(uid, d) {
  if (!d) return null;
  const off = d.showcasePresenceOfflineAt;
  let iso = null;
  if (off && typeof off.toDate === 'function') iso = off.toDate().toISOString();
  else if (off instanceof Date) iso = off.toISOString();
  return {
    uid,
    name: d.name || 'Trader',
    photoURL: d.photoURL || '',
    lastSeenAt: lastSeenFieldFromDb(
      d.lastSeenAt && typeof d.lastSeenAt.toDate === 'function'
        ? d.lastSeenAt.toDate().toISOString()
        : d.lastSeenAt
    ),
    presenceOnline: d.presenceOnline === true,
    showcasePresenceOnline: d.showcasePresenceOnline === true,
    showcasePresenceExplicitOffline: d.showcasePresenceOnline === false,
    showcasePresenceOfflineAt: iso ? lastSeenFieldFromDb(iso) : null
  };
}

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    await verifyBearer(req);
    const body = readBody(req);
    const uids = Array.isArray(body.uids) ? body.uids.map(String).filter(Boolean).slice(0, 80) : [];
    if (!uids.length) return json(res, 200, { ok: true, users: [] });

    const dbFs = (() => {
      try {
        return getFirestore();
      } catch {
        return null;
      }
    })();

    const users = [];
    const supaByUid = new Map();

    try {
      const supa = getSupabaseAdmin();
      const { data: rows, error } = await supa.from('users').select('*').in('uid', uids);
      if (error) throw error;
      for (const row of rows || []) {
        supaByUid.set(String(row.uid), row);
      }
    } catch {
      /* Supabase optional — Firestore-only users still load below */
    }

    for (const uid of uids) {
      let client = null;

      if (dbFs) {
        try {
          const fs = await dbFs.collection('users').doc(uid).get();
          if (fs.exists) {
            client = firestoreUserToClient(uid, fs.data());
          }
        } catch {
          /* ignore */
        }
      }

      const supaRow = supaByUid.get(uid);
      if (supaRow) {
        const fromSupa = rowToClient(supaRow);
        if (client) {
          users.push({
            ...fromSupa,
            ...client,
            uid,
            lastSeenAt: client.lastSeenAt || fromSupa.lastSeenAt,
            presenceOnline: client.presenceOnline || fromSupa.presenceOnline,
            showcasePresenceOnline:
              client.showcasePresenceOnline === true || fromSupa.showcasePresenceOnline === true,
            showcasePresenceExplicitOffline:
              client.showcasePresenceExplicitOffline === true ||
              fromSupa.showcasePresenceExplicitOffline === true,
            showcasePresenceOfflineAt:
              client.showcasePresenceOfflineAt || fromSupa.showcasePresenceOfflineAt
          });
        } else {
          users.push(fromSupa);
        }
      } else if (client) {
        users.push(client);
      }
    }

    return json(res, 200, { ok: true, users });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
