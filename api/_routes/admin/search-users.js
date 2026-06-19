const admin = require('firebase-admin');
const { getFirestore, getAuth } = require('../../_lib/firebaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { isPlatformAdminUid } = require('../../_lib/platformAdmin.cjs');
const { json, readBody, applyApiCors, handleCorsPreflight } = require('../../_lib/http');

const LIMIT = 25;
const FIRESTORE_SCAN_PAGE = 250;
const FIRESTORE_SCAN_MAX = 1500;

function tokenize(q) {
  return String(q || '')
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[%_,.]/g, '').trim())
    .filter((w) => w.length >= 2);
}

function isReal(uid) {
  return uid && !String(uid).startsWith('showcase__');
}

function mapFirestoreDoc(uid, d) {
  return {
    uid,
    name: d.name || 'Trader',
    email: d.email || '',
    virtualBalance: Number(d.virtualBalance) || 0,
    lifetimeRealizedPnl: Number(d.lifetimeRealizedPnl) || 0
  };
}

function rowMatchesTokens(row, words) {
  const hay = `${row.name || ''} ${row.email || ''}`.toLowerCase();
  if (!words.length) return false;
  return words.every((w) => hay.includes(w));
}

async function searchFirestoreUsers(words, exactUid) {
  const db = getFirestore();
  const byUid = new Map();

  if (exactUid && isReal(exactUid)) {
    const snap = await db.collection('users').doc(exactUid).get();
    if (snap.exists) {
      byUid.set(exactUid, mapFirestoreDoc(exactUid, snap.data() || {}));
    } else {
      try {
        const au = await getAuth().getUser(exactUid);
        byUid.set(
          exactUid,
          mapFirestoreDoc(exactUid, {
            name: au.displayName || au.email?.split('@')[0] || 'Trader',
            email: au.email || '',
            virtualBalance: 10000,
            lifetimeRealizedPnl: 0
          })
        );
      } catch {
        /* not in Auth */
      }
    }
  }

  if (!words.length) return Array.from(byUid.values()).slice(0, LIMIT);

  let lastDoc = null;
  let scanned = 0;

  for (;;) {
    let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(FIRESTORE_SCAN_PAGE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    snap.docs.forEach((docSnap) => {
      scanned += 1;
      const uid = docSnap.id;
      if (!isReal(uid)) return;
      const row = mapFirestoreDoc(uid, docSnap.data() || {});
      if (rowMatchesTokens(row, words)) byUid.set(uid, row);
    });

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < FIRESTORE_SCAN_PAGE || scanned >= FIRESTORE_SCAN_MAX || byUid.size >= LIMIT) break;
  }

  return Array.from(byUid.values())
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .slice(0, LIMIT);
}

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const decoded = await verifyBearer(req);
    const ok = await isPlatformAdminUid(decoded.uid);
    if (!ok) return json(res, 403, { ok: false, error: 'Admin only' });

    if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      return json(res, 500, { ok: false, error: 'Firebase admin not configured on server' });
    }

    const body = readBody(req);
    const q = String(body.q || body.query || '').trim();
    if (q.length < 2) return json(res, 200, { ok: true, users: [] });

    const words = tokenize(q);
    const exactUid = q.length >= 8 && !/\s/.test(q) ? q.trim() : '';

    const users = await searchFirestoreUsers(words, exactUid);
    return json(res, 200, { ok: true, users, source: 'firestore' });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
