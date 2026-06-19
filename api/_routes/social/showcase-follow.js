const { getFirestore, getAuth } = require('../../_lib/firebaseAdmin');
const { applyApiCors, handleCorsPreflight } = require('../../_lib/http');

const PRIMARY_STOCK_TIP_OWNER_UID = '8i1gWBZLj7NOdWTTj3Cg4sgCW4I2';

function json(res, status, payload) {
  res.status(status).setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function isEditorUid(db, uid) {
  if (!uid) return false;
  if (uid === PRIMARY_STOCK_TIP_OWNER_UID) return true;
  try {
    const snap = await db.collection('config').doc('stockTipEditors').get();
    const uids = Array.isArray(snap.data()?.uids) ? snap.data().uids : [];
    return uids.includes(uid);
  } catch (e) {
    return false;
  }
}

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return json(res, 401, { ok: false, error: 'Missing auth token' });

  const body = req.body || {};
  const actorShowcaseUid = String(body.actorShowcaseUid || '').trim();
  const targetUid = String(body.targetUid || '').trim();
  const action = String(body.action || '').trim().toLowerCase();
  if (!actorShowcaseUid || !targetUid) {
    return json(res, 400, { ok: false, error: 'Missing actorShowcaseUid/targetUid' });
  }
  if (!['follow', 'unfollow'].includes(action)) {
    return json(res, 400, { ok: false, error: 'Invalid action' });
  }
  if (actorShowcaseUid === targetUid) {
    return json(res, 400, { ok: false, error: 'Showcase profile cannot follow itself' });
  }

  try {
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(token);
    const db = getFirestore();
    const canEdit = await isEditorUid(db, decoded.uid);
    if (!canEdit) return json(res, 403, { ok: false, error: 'Editor access required' });

    const actorRef = db.collection('users').doc(actorShowcaseUid);
    const targetRef = db.collection('users').doc(targetUid);

    await db.runTransaction(async (tx) => {
      const [actorSnap, targetSnap] = await Promise.all([tx.get(actorRef), tx.get(targetRef)]);
      if (!actorSnap.exists) throw new Error('Actor showcase profile not found');
      if (!targetSnap.exists) throw new Error('Target profile not found');
      const actorData = actorSnap.data() || {};
      const targetData = targetSnap.data() || {};
      if (actorData.isShowcaseProfile !== true) throw new Error('actorShowcaseUid is not a showcase profile');

      const actorFollowing = Array.isArray(actorData.following) ? actorData.following : [];
      const targetFollowers = Array.isArray(targetData.followers) ? targetData.followers : [];

      if (action === 'follow') {
        tx.set(
          actorRef,
          { following: Array.from(new Set([...actorFollowing, targetUid])) },
          { merge: true }
        );
        tx.set(
          targetRef,
          { followers: Array.from(new Set([...targetFollowers, actorShowcaseUid])) },
          { merge: true }
        );
      } else {
        tx.set(
          actorRef,
          { following: actorFollowing.filter((x) => x !== targetUid) },
          { merge: true }
        );
        tx.set(
          targetRef,
          { followers: targetFollowers.filter((x) => x !== actorShowcaseUid) },
          { merge: true }
        );
      }
    });

    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message || 'Failed to update showcase follow' });
  }
};
