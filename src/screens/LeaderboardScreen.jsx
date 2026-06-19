import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
  onSnapshot,
  where,
  documentId
} from 'firebase/firestore';
import { AuthContext } from '../authContext';
import { db } from '../firebaseClient';
import {
  activateBffQuotaFallback,
  isBffDataMode,
  isBffLeaderboardMode,
  isSupabaseFallbackEnabled
} from '../config/dataBackend';
import { bff } from '../api/serverBff';
import { shouldFallbackFromFirestoreToSupabase } from '../utils/firestoreQuota';
import { T } from '../app/theme';
import { Card } from '../components/ui/AppPrimitives';
import LeaderboardRowAvatar from '../components/LeaderboardRowAvatar';
import LeaderboardChatLink from '../components/LeaderboardChatLink';
import LeaderboardOwnerBadge from '../components/LeaderboardOwnerBadge';
import LeaderboardManagerBadge from '../components/LeaderboardManagerBadge';
import PaidMemberBadge, { PlanTierChip } from '../components/PaidMemberBadge';
import { showPaidBadge, getDisplayPlanType } from '../config/paidPlan';
import { isPlatformOwnerRow } from '../config/platformOwner';
import { isPlatformManagerRow } from '../config/platformManager';
import { toUidList } from '../utils/userDoc';
import { maybeMigrateFollowArrays } from '../utils/googleProfileSync';
import { resolveLeaderboardPnlTotal } from '../utils/positionUtils';
import { enrichLeaderboardRows } from '../utils/leaderboardRow';
import { istCalendarWeekRange, istCalendarMonthRange, formatDurationMs } from '../utils/istMarketWindows';
import {
  LEADERBOARD_PAID_PROMO_HEADLINE,
  LEADERBOARD_PAID_PROMO_SUB
} from '../content/leaderboardPromo';
import { PLAN_CATALOG, PLAN_ORDER } from '../config/paidPlan';
import { LEADERBOARD_CACHE_KEY, LEADERBOARD_CACHE_TTL_MS } from '../utils/leaderboardClientCache';
import {
  countLeaderboardRowsOnline,
  isLeaderboardRowPresenceOnline,
  leaderboardPresenceTitle,
  mergeLeaderboardRowPresence,
  presencePatchFromUserDoc,
  presencePatchFromShowcaseRow
} from '../utils/leaderboardPresence';
import { isShowcaseUid } from '../utils/showcasePresence';
import { withTradeAsBody } from '../utils/chatAsUid';
import PaidFreeResetButton from '../components/PaidFreeResetButton';

const LB_ROW_DIVIDER = '1px solid rgba(42,46,57,0.32)';

const LEADERBOARD_PAGE_SIZE = 20;
const TOP_QUERY_LIMIT = 180;

function mergeLeaderboardRow(row, presencePatch) {
  const merged = mergeLeaderboardRowPresence(row, presencePatch);
  if (!presencePatch || typeof presencePatch !== 'object') return merged;
  return {
    ...merged,
    isPaidMember: merged.isPaidMember ?? presencePatch.isPaidMember,
    paidPlanType: merged.paidPlanType ?? presencePatch.paidPlanType,
    paidMemberUntil: merged.paidMemberUntil ?? presencePatch.paidMemberUntil
  };
}

function TraderNameBadges({ row, badgeSize = 18 }) {
  if (!row) return null;
  return (
    <>
      {isPlatformOwnerRow(row) ? <LeaderboardOwnerBadge /> : null}
      {isPlatformManagerRow(row) ? <LeaderboardManagerBadge /> : null}
      {showPaidBadge(row) ? <PaidMemberBadge size={badgeSize} /> : null}
      {showPaidBadge(row) && getDisplayPlanType(row) ? (
        <PlanTierChip planType={getDisplayPlanType(row)} />
      ) : null}
    </>
  );
}

const LeaderboardAvatarWithPresence = ({ row, nowMs, size = 28 }) => {
  const online = isLeaderboardRowPresenceOnline(row, nowMs);
  const label = leaderboardPresenceTitle(row, nowMs);
  const dotSize = size >= 34 ? 11 : 9;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }} title={label}>
      <LeaderboardRowAvatar
        photoURL={row.photoURL}
        name={row.name || 'Trader'}
        seed={row.id || row.uid}
        size={size}
      />
      <span
        role="status"
        aria-label={label}
        style={{
          position: 'absolute',
          right: -1,
          bottom: -1,
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: online ? T.green : 'rgba(132,142,156,0.55)',
          border: '2px solid #0b0e11',
          boxShadow: online ? '0 0 8px rgba(2,192,118,0.55)' : 'none',
          pointerEvents: 'none'
        }}
      />
    </span>
  );
};

const LeaderboardOnlineSummary = ({ count }) => (
  <div
    title={`${count} trader${count === 1 ? '' : 's'} online`}
    style={{
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      padding: '6px 10px',
      borderRadius: 999,
      border: `1px solid ${count > 0 ? 'rgba(2,192,118,0.35)' : T.border}`,
      background: count > 0 ? 'rgba(2,192,118,0.1)' : 'rgba(132,142,156,0.08)'
    }}
  >
    <span
      aria-hidden
      style={{
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: count > 0 ? T.green : 'rgba(132,142,156,0.45)',
        boxShadow: count > 0 ? '0 0 8px rgba(2,192,118,0.5)' : 'none',
        flexShrink: 0
      }}
    />
    <span
      style={{
        color: count > 0 ? T.green : T.text,
        fontWeight: 800,
        fontSize: 14,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1
      }}
    >
      {count}
    </span>
    <span style={{ color: T.text, fontSize: 11, fontWeight: 600, lineHeight: 1 }}>online</span>
  </div>
);

const LeaderboardFollowButton = ({ targetId }) => {
  const { user, userData, refreshUser, actingAsUid, isActingAsShowcase } = useContext(AuthContext);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const isSelf = user?.uid === targetId;
  const following = toUidList(userData?.following).includes(targetId);

  const onToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    if (isSelf || !targetId) return;
    setBusy(true);
    try {
      await maybeMigrateFollowArrays(user.uid);
      if (isBffDataMode()) {
        await bff('/api/social/follow-bff', {
          method: 'POST',
          body: JSON.stringify(
            withTradeAsBody(
              { targetUid: targetId, action: following ? 'unfollow' : 'follow' },
              actingAsUid,
              isActingAsShowcase
            )
          )
        });
      } else {
        try {
          const meRef = doc(db, 'users', user.uid);
          const themRef = doc(db, 'users', targetId);
          if (following) {
            await updateDoc(themRef, { followers: arrayRemove(user.uid) });
            await updateDoc(meRef, { following: arrayRemove(targetId) });
          } else {
            await updateDoc(themRef, { followers: arrayUnion(user.uid) });
            await updateDoc(meRef, { following: arrayUnion(targetId) });
          }
        } catch (e) {
          if (shouldFallbackFromFirestoreToSupabase(e) && isSupabaseFallbackEnabled()) {
            activateBffQuotaFallback();
            await bff('/api/social/follow-bff', {
              method: 'POST',
              body: JSON.stringify(
                withTradeAsBody(
                  { targetUid: targetId, action: following ? 'unfollow' : 'follow' },
                  actingAsUid,
                  isActingAsShowcase
                )
              )
            });
          } else throw e;
        }
      }
      await refreshUser();
    } catch (err) {
      console.error(err);
      window.alert(
        err?.code === 'permission-denied'
          ? 'Could not save follow right now. Please sign in, refresh the profile, and try again.'
          : err?.message || 'Follow failed'
      );
    }
    setBusy(false);
  };

  if (!targetId) return null;
  if (isSelf) {
    return (
      <span style={{ color: T.text, fontSize: 11, fontWeight: 600, textAlign: 'center' }}>You</span>
    );
  }
  if (!user) {
    return (
      <Link
        to="/login"
        onClick={(e) => e.stopPropagation()}
        state={{ from: '/leaderboard' }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '5px 8px',
          borderRadius: 6,
          background: T.yellow,
          color: '#000',
          fontSize: 10,
          fontWeight: 800,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          minHeight: 28,
          boxSizing: 'border-box'
        }}
      >
        Follow
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      style={{
        padding: '5px 8px',
        borderRadius: 6,
        border: following ? `1px solid ${T.border}` : 'none',
        background: following ? T.card2 : T.yellow,
        color: following ? T.white : '#000',
        fontSize: 10,
        fontWeight: 800,
        cursor: busy ? 'wait' : 'pointer',
        whiteSpace: 'nowrap',
        minWidth: 72,
        minHeight: 28,
        boxSizing: 'border-box'
      }}
    >
      {busy ? '…' : following ? 'Following' : 'Follow'}
    </button>
  );
};

export const LeaderboardScreen = () => {
  const { user, refreshUser, actingAsUid } = useContext(AuthContext);
  const [bffModeRev, setBffModeRev] = useState(0);
  const storyCardRef = useRef(null);
  const [boardRows, setBoardRows] = useState(() => {
    try {
      const raw = localStorage.getItem(LEADERBOARD_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.rows) && parsed.rows.length) return parsed.rows;
    } catch {
      /* ignore */
    }
    return [];
  });
  const boardRowsRef = useRef([]);
  boardRowsRef.current = boardRows;
  const [loading, setLoading] = useState(() => {
    try {
      const raw = localStorage.getItem(LEADERBOARD_CACHE_KEY);
      if (!raw) return true;
      const parsed = JSON.parse(raw);
      return !(Array.isArray(parsed?.rows) && parsed.rows.length > 0);
    } catch {
      return true;
    }
  });
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState('all_traders');
  const [search, setSearch] = useState('');
  const [pnlRankMode, setPnlRankMode] = useState('winners');
  const [shareMsg, setShareMsg] = useState('');
  const [visibleCount, setVisibleCount] = useState(LEADERBOARD_PAGE_SIZE);
  const [leaderboardFrozen, setLeaderboardFrozen] = useState(false);
  const [frozenBannerMsg, setFrozenBannerMsg] = useState('');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [presenceNow, setPresenceNow] = useState(() => Date.now());
  const [presenceByUid, setPresenceByUid] = useState({});
  const [blockedUidSet, setBlockedUidSet] = useState(() => new Set());
  const [boardError, setBoardError] = useState('');

  const loadBoardFromFirestore = useCallback(async () => {
    const sortReal = (list) =>
      list.sort((a, b) => {
        const diff = b.realizedPnlTotal - a.realizedPnlTotal;
        if (diff !== 0) return diff;
        return (b.virtualBalance || 0) - (a.virtualBalance || 0);
      });
    const mergeDoc = (docSnap, byId) => {
      const d = docSnap.data();
      const id = docSnap.id;
      const realizedPnlTotal = resolveLeaderboardPnlTotal(d);
      byId.set(id, { ...d, id, realizedPnlTotal, lifetimeRealizedPnl: realizedPnlTotal });
    };
    const freezeSnap = await getDoc(doc(db, 'config', 'leaderboardFreeze'));
    if (freezeSnap.exists()) {
      const fd = freezeSnap.data();
      if (fd.frozen && Array.isArray(fd.snapshot) && fd.snapshot.length) {
        setBoardRows(fd.snapshot);
        setLeaderboardFrozen(true);
        setFrozenBannerMsg(fd.message || 'June leaderboard rankings are locked.');
        return true;
      }
    }
    setLeaderboardFrozen(false);
    setFrozenBannerMsg('');
    const qPl = query(
      collection(db, 'users'),
      orderBy('lifetimeRealizedPnl', 'desc'),
      limit(TOP_QUERY_LIMIT)
    );
    const qBal = query(
      collection(db, 'users'),
      orderBy('virtualBalance', 'desc'),
      limit(TOP_QUERY_LIMIT)
    );
    const [snapPl, snapBal] = await Promise.all([getDocs(qPl), getDocs(qBal)]);
    const byId = new Map();
    snapPl.forEach((d) => mergeDoc(d, byId));
    snapBal.forEach((d) => mergeDoc(d, byId));
    const rows = Array.from(byId.values());
    sortReal(rows);
    setBoardRows(rows);
    try {
      localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify({ at: Date.now(), rows }));
    } catch {}
    return true;
  }, []);

  const loadBoard = useCallback(async ({ background = false } = {}) => {
    setBoardError('');
    if (!background) setRefreshing(true);
    try {
    if (isBffLeaderboardMode()) {
      try {
        const j = await bff('/api/data/leaderboard');
        const rows = enrichLeaderboardRows(Array.isArray(j.rows) ? j.rows : []);
        setBoardRows(rows);
        setLeaderboardFrozen(!!j.leaderboardFrozen);
        setFrozenBannerMsg(j.frozenMessage || '');
        setBoardError('');
        try {
          localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify({ at: Date.now(), rows }));
        } catch {}
        return;
      } catch (e) {
        console.error(e);
        try {
          const raw = localStorage.getItem(LEADERBOARD_CACHE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            const age = Date.now() - Number(parsed?.at || 0);
            if (
              Array.isArray(parsed?.rows) &&
              parsed.rows.length &&
              age >= 0 &&
              age <= LEADERBOARD_CACHE_TTL_MS
            ) {
              setBoardRows(parsed.rows);
              return;
            }
          }
        } catch {
          /* ignore */
        }
        setBoardError(String(e?.message || 'Leaderboard could not load. Pull to refresh or try again.'));
        return;
      }
    } else {
    const sortReal = (list) =>
      list.sort((a, b) => {
        const diff = b.realizedPnlTotal - a.realizedPnlTotal;
        if (diff !== 0) return diff;
        return (b.virtualBalance || 0) - (a.virtualBalance || 0);
      });
    const mergeDoc = (docSnap, byId) => {
      const d = docSnap.data();
      const id = docSnap.id;
      const realizedPnlTotal = resolveLeaderboardPnlTotal(d);
      byId.set(id, { ...d, id, realizedPnlTotal, lifetimeRealizedPnl: realizedPnlTotal });
    };
    try {
      const freezeSnap = await getDoc(doc(db, 'config', 'leaderboardFreeze'));
      if (freezeSnap.exists()) {
        const fd = freezeSnap.data();
        if (fd.frozen && Array.isArray(fd.snapshot) && fd.snapshot.length) {
          setBoardRows(fd.snapshot);
          setLeaderboardFrozen(true);
          setFrozenBannerMsg(fd.message || 'June leaderboard rankings are locked.');
          try {
            localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify({ at: Date.now(), rows: fd.snapshot }));
          } catch {}
          return;
        }
      }
      setLeaderboardFrozen(false);
      setFrozenBannerMsg('');
      const qPl = query(
        collection(db, 'users'),
        orderBy('lifetimeRealizedPnl', 'desc'),
        limit(TOP_QUERY_LIMIT)
      );
      const qBal = query(
        collection(db, 'users'),
        orderBy('virtualBalance', 'desc'),
        limit(TOP_QUERY_LIMIT)
      );
      const [snapPl, snapBal] = await Promise.all([getDocs(qPl), getDocs(qBal)]);
      const byId = new Map();
      snapPl.forEach((d) => mergeDoc(d, byId));
      snapBal.forEach((d) => mergeDoc(d, byId));
      const rows = Array.from(byId.values());
      sortReal(rows);
      setBoardRows(rows);
      try {
        localStorage.setItem(
          LEADERBOARD_CACHE_KEY,
          JSON.stringify({ at: Date.now(), rows })
        );
      } catch {}
    } catch (e) {
      console.error(e);
      if (shouldFallbackFromFirestoreToSupabase(e) && isSupabaseFallbackEnabled()) {
        activateBffQuotaFallback();
        try {
          const j = await bff('/api/data/leaderboard');
          const rows = enrichLeaderboardRows(Array.isArray(j.rows) ? j.rows : []);
          setBoardRows(rows);
          setLeaderboardFrozen(!!j.leaderboardFrozen);
          setFrozenBannerMsg(j.frozenMessage || '');
        } catch (e3) {
          console.error(e3);
        }
        return;
      }
      try {
        const qBal = query(
          collection(db, 'users'),
          orderBy('virtualBalance', 'desc'),
          limit(TOP_QUERY_LIMIT)
        );
        const snapshot = await getDocs(qBal);
        const rows = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const realizedPnlTotal = resolveLeaderboardPnlTotal(d);
          return { ...d, id: docSnap.id, realizedPnlTotal, lifetimeRealizedPnl: realizedPnlTotal };
        });
        sortReal(rows);
        setBoardRows(rows);
      } catch (e2) {
        console.error(e2);
        setBoardRows([]);
      }
    }
    }
    } finally {
      if (!background) setRefreshing(false);
    }
  }, [loadBoardFromFirestore]);

  useEffect(() => {
    const fn = () => setBffModeRev((x) => x + 1);
    window.addEventListener('auron-bff-mode', fn);
    return () => window.removeEventListener('auron-bff-mode', fn);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const hasCache = boardRows.length > 0;
    if (hasCache) setLoading(false);
    (async () => {
      await loadBoard({ background: hasCache });
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadBoard]);

  useEffect(() => {
    const reloadBoard = (ev) => {
      const background = ev?.detail?.background === true || boardRowsRef.current.length > 0;
      loadBoard({ background }).finally(() => setLoading(false));
    };
    const onStorage = (e) => {
      if (e.key === LEADERBOARD_CACHE_KEY && e.newValue == null) reloadBoard({ detail: { background: true } });
    };
    window.addEventListener('auron-leaderboard-reload', reloadBoard);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('auron-leaderboard-reload', reloadBoard);
      window.removeEventListener('storage', onStorage);
    };
  }, [loadBoard]);

  useEffect(() => {
    if (isBffLeaderboardMode()) {
      // Initial load is handled by the mount effect above; only light refresh here.
      const id = window.setInterval(() => {
        loadBoard({ background: true });
      }, 20000);
      return () => clearInterval(id);
    }
    if (leaderboardFrozen) {
      return undefined;
    }
    const byId = new Map();
    const sortReal = (list) =>
      list.sort((a, b) => {
        const diff = b.realizedPnlTotal - a.realizedPnlTotal;
        if (diff !== 0) return diff;
        return (b.virtualBalance || 0) - (a.virtualBalance || 0);
      });
    const mergeSnapshot = (snap) => {
      snap.docs.forEach((docSnap) => {
        const d = docSnap.data();
        const realizedPnlTotal = resolveLeaderboardPnlTotal(d);
        byId.set(docSnap.id, { ...d, id: docSnap.id, realizedPnlTotal, lifetimeRealizedPnl: realizedPnlTotal });
      });
      const rows = Array.from(byId.values());
      sortReal(rows);
      setBoardRows(rows);
      setLoading(false);
      try {
        localStorage.setItem(
          LEADERBOARD_CACHE_KEY,
          JSON.stringify({ at: Date.now(), rows })
        );
      } catch {}
    };
    const qPl = query(collection(db, 'users'), orderBy('lifetimeRealizedPnl', 'desc'), limit(TOP_QUERY_LIMIT));
    const qBal = query(collection(db, 'users'), orderBy('virtualBalance', 'desc'), limit(TOP_QUERY_LIMIT));
    const onSnapErr = (e) => {
      console.error(e);
      if (shouldFallbackFromFirestoreToSupabase(e) && isSupabaseFallbackEnabled()) activateBffQuotaFallback();
    };
    const unsubA = onSnapshot(qPl, mergeSnapshot, onSnapErr);
    const unsubB = onSnapshot(qBal, mergeSnapshot, onSnapErr);
    return () => {
      unsubA();
      unsubB();
    };
  }, [loadBoard, bffModeRev, leaderboardFrozen]);

  useEffect(() => {
    if (timeframe !== 'week' && timeframe !== 'month') return undefined;
    const id = window.setInterval(() => setNowTick(Date.now()), 5000);
    return () => clearInterval(id);
  }, [timeframe]);

  useEffect(() => {
    const id = window.setInterval(() => setPresenceNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  /** Real-time showcase online/offline from leaderboardShowcase + users docs. */
  useEffect(() => {
    if (leaderboardFrozen || isBffLeaderboardMode()) return undefined;
    const applyShowcasePatch = (uid, data) => {
      const id = String(uid || '');
      if (!isShowcaseUid(id)) return;
      const patch = presencePatchFromUserDoc(data) || presencePatchFromShowcaseRow(data);
      if (!patch) return;
      setPresenceByUid((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    };
    const unsubShowcase = onSnapshot(
      collection(db, 'leaderboardShowcase'),
      (snap) => {
        snap.docs.forEach((d) => {
          const data = d.data();
          const uid = data.profile_uid || `showcase__${d.id}`;
          applyShowcasePatch(uid, data);
        });
      },
      (e) => console.error('leaderboardShowcase presence', e)
    );
    return () => unsubShowcase();
  }, [leaderboardFrozen, bffModeRev]);

  useEffect(() => {
    if (leaderboardFrozen || isBffLeaderboardMode()) return undefined;
    const showcaseUids = boardRows
      .map((r) => String(r.id || r.uid || ''))
      .filter((id) => isShowcaseUid(id));
    if (!showcaseUids.length) return undefined;
    const applyUserPatch = (uid, data) => {
      const patch = presencePatchFromUserDoc(data);
      if (patch) setPresenceByUid((prev) => ({ ...prev, [uid]: { ...prev[uid], ...patch } }));
    };
    const unsubs = showcaseUids.map((uid) =>
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (snap.exists()) applyUserPatch(uid, snap.data());
        },
        (e) => console.error('showcase user presence', uid, e)
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [boardRows, leaderboardFrozen, bffModeRev]);

  useEffect(() => {
    const uids = Array.from(
      new Set(boardRows.map((r) => String(r.id || r.uid || '')).filter(Boolean))
    );
    if (!uids.length) return undefined;

    const applyUsers = (list) => {
      const next = {};
      for (const u of list) {
        const uid = String(u?.uid || u?.id || '');
        if (!uid) continue;
        const patch = presencePatchFromUserDoc(u);
        if (patch) {
          next[uid] = {
            ...patch,
            isPaidMember: u.isPaidMember === true,
            paidPlanType: u.paidPlanType || null,
            paidMemberUntil: u.paidMemberUntil || null
          };
        }
      }
      if (Object.keys(next).length) {
        setPresenceByUid((prev) => ({ ...prev, ...next }));
      }
    };

    if (isBffLeaderboardMode()) {
      if (!user?.uid) return undefined;
      let cancelled = false;
      const load = async () => {
        try {
          const merged = [];
          for (let i = 0; i < uids.length; i += 80) {
            const chunk = uids.slice(i, i + 80);
            const j = await bff('/api/data/users-bulk', {
              method: 'POST',
              body: JSON.stringify({ uids: chunk })
            });
            merged.push(...(j.users || []));
          }
          if (!cancelled) applyUsers(merged);
        } catch {
          /* ignore */
        }
      };
      load();
      const id = window.setInterval(load, 30000);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }

    let cancelled = false;
    const loadFs = async () => {
      try {
        const next = {};
        for (let i = 0; i < uids.length; i += 30) {
          const chunk = uids.slice(i, i + 30);
          const q = query(collection(db, 'users'), where(documentId(), 'in', chunk));
          const snap = await getDocs(q);
          snap.docs.forEach((d) => {
            const patch = presencePatchFromUserDoc(d.data());
            if (patch) next[d.id] = patch;
          });
        }
        if (!cancelled && Object.keys(next).length) {
          setPresenceByUid((prev) => ({ ...prev, ...next }));
        }
      } catch {
        /* ignore */
      }
    };
    loadFs();
    const showcaseCount = uids.filter((id) => isShowcaseUid(id)).length;
    const pollMs = showcaseCount > 0 ? 5000 : 12000;
    const id = window.setInterval(loadFs, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [boardRows, user?.uid, bffModeRev]);

  useEffect(() => {
    if (isBffLeaderboardMode()) {
      setBlockedUidSet(new Set());
      return undefined;
    }
    const ref = doc(db, 'config', 'blockedUsers');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const uids = snap.exists() && Array.isArray(snap.data()?.uids) ? snap.data().uids.map(String) : [];
        setBlockedUidSet(new Set(uids));
      },
      () => setBlockedUidSet(new Set())
    );
    return () => unsub();
  }, []);

  const windowEndMs = useMemo(() => {
    if (timeframe === 'week') return istCalendarWeekRange(nowTick).end;
    if (timeframe === 'month') return istCalendarMonthRange(nowTick).end;
    return null;
  }, [timeframe, nowTick]);

  const users = useMemo(() => {
    const parseAnyDateMs = (v) => {
      if (!v) return 0;
      if (typeof v?.toMillis === 'function') return v.toMillis();
      if (typeof v?.seconds === 'number') return v.seconds * 1000;
      const ms = new Date(v).getTime();
      return Number.isFinite(ms) ? ms : 0;
    };
    const pnlForWindow = (row, key) => {
      if (key === 'all_traders' || key === 'all_time') return Number(row.realizedPnlTotal || 0);
      let start;
      let end = Number.POSITIVE_INFINITY;
      if (key === 'week') {
        const w = istCalendarWeekRange(nowTick);
        start = w.start;
        end = w.end;
      } else if (key === 'month') {
        const m = istCalendarMonthRange(nowTick);
        start = m.start;
        end = m.end;
      } else {
        return Number(row.realizedPnlTotal || 0);
      }
      const arr = Array.isArray(row.closedPositions) ? row.closedPositions : [];
      return arr.reduce((sum, p) => {
        const ts =
          parseAnyDateMs(p?.closedAt) ||
          parseAnyDateMs(p?.closeTime) ||
          parseAnyDateMs(p?.time) ||
          parseAnyDateMs(p?.openedAt);
        if (!ts || ts < start || ts >= end) return sum;
        return sum + Number(p?.realizedPnl || 0);
      }, 0);
    };
    const q = search.trim().toLowerCase();
    const rows = boardRows
      .filter((r) => !blockedUidSet.has(String(r.id || r.uid || '')))
      .map((r) => {
        const pid = String(r.id || r.uid || '');
        return {
          ...mergeLeaderboardRow(r, presenceByUid[pid]),
          _windowPnl: pnlForWindow(r, timeframe)
        };
      })
      .filter((r) => (q ? String(r.name || '').toLowerCase().includes(q) : true))
      .sort((a, b) => {
        const pnlDiff = b._windowPnl - a._windowPnl;
        const primary = pnlRankMode === 'losers' ? -pnlDiff : pnlDiff;
        return primary || (b.virtualBalance || 0) - (a.virtualBalance || 0);
      });
    return rows;
  }, [boardRows, timeframe, search, pnlRankMode, nowTick, blockedUidSet, presenceByUid]);

  useEffect(() => {
    setVisibleCount(LEADERBOARD_PAGE_SIZE);
  }, [timeframe, search, pnlRankMode]);

  const [lbNarrow, setLbNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 560
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 560px)');
    const fn = () => setLbNarrow(mq.matches);
    mq.addEventListener('change', fn);
    fn();
    return () => mq.removeEventListener('change', fn);
  }, []);

  const onlineTraderCount = useMemo(() => {
    const rows = boardRows
      .filter((r) => !blockedUidSet.has(String(r.id || r.uid || '')))
      .map((r) => {
        const pid = String(r.id || r.uid || '');
        return mergeLeaderboardRow(r, presenceByUid[pid]);
      });
    return countLeaderboardRowsOnline(rows, presenceNow);
  }, [boardRows, blockedUidSet, presenceNow, presenceByUid]);

  const myLeaderboardStats = useMemo(() => {
    if (!user?.uid) return null;
    const idx = users.findIndex((u) => (u.id || u.uid) === user.uid);
    if (idx < 0) return null;
    const row = users[idx];
    return {
      rank: idx + 1,
      name: row.name || 'Trader',
      pnl: Number(row._windowPnl || 0)
    };
  }, [user?.uid, users]);

  const shareMyStory = async () => {
    if (!myLeaderboardStats) {
      setShareMsg('Share is available once your account appears in the leaderboard ranking.');
      return;
    }
    if (!storyCardRef.current) {
      setShareMsg('Story image is not ready yet. Please try again.');
      return;
    }
    try {
      const canvas = await html2canvas(storyCardRef.current, {
        backgroundColor: '#0b0e11',
        scale: 2,
        useCORS: true
      });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        setShareMsg('Could not generate the story image.');
        return;
      }
      const file = new File([blob], 'auronx-leaderboard-story.png', { type: 'image/png' });
      const shareText = 'Want to beat me? Then beat here 🔥\nBio: https://www.theatharvacapital.com';
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'AuronX Leaderboard Story',
          text: shareText,
          files: [file]
        });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'auronx-leaderboard-story.png';
        a.click();
        URL.revokeObjectURL(a.href);
        await navigator.clipboard.writeText(shareText).catch(() => {});
      }
      setShareMsg('Leaderboard story image is ready and shared.');
    } catch {
      setShareMsg('Share was cancelled or unavailable on this device.');
    }
  };

  const rowGrid = {
    display: 'grid',
    gridTemplateColumns: '32px minmax(0, 2fr) minmax(72px, 0.9fr) minmax(118px, 1fr)',
    gap: 8,
    alignItems: 'center',
    padding: '12px clamp(12px, 3vw, 20px)',
    borderBottom: LB_ROW_DIVIDER
  };

  return (
    <div
      style={{
        padding: '12px clamp(10px, 3vw, 16px) 24px',
        maxWidth: 800,
        margin: '0 auto',
        minHeight: '50vh',
        background: T.bg
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: '12px 14px',
          background: 'linear-gradient(180deg, #11161e 0%, #0b0e11 100%)',
          marginBottom: 10
        }}
      >
        <span style={{ fontSize: 24 }}>🏆</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ color: T.white, margin: 0, fontSize: 'clamp(1.15rem, 4vw, 1.5rem)' }}>Leaderboard</h2>
          <div style={{ color: T.text, fontSize: 12, marginTop: 2 }}>Ranked by realized P/L</div>
        </div>
        <LeaderboardOnlineSummary count={onlineTraderCount} />
      </div>
      <div
        style={{
          marginBottom: 10,
          padding: '14px 14px 12px',
          borderRadius: 12,
          border: '1px solid rgba(168,85,250,0.4)',
          background: 'linear-gradient(135deg, rgba(56,151,240,0.12) 0%, rgba(168,85,250,0.14) 45%, rgba(240,185,11,0.08) 100%)'
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: T.yellow, marginBottom: 6 }}>
          MONTHLY REWARDS + PAID PLANS
        </div>
        <div style={{ color: T.white, fontWeight: 800, fontSize: 'clamp(1rem, 3.5vw, 1.15rem)', marginBottom: 6 }}>
          {LEADERBOARD_PAID_PROMO_HEADLINE}
        </div>
        <div style={{ color: T.text, fontSize: 12, lineHeight: 1.45, marginBottom: 12 }}>
          {LEADERBOARD_PAID_PROMO_SUB}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PLAN_ORDER.map((key) => {
            const p = PLAN_CATALOG[key];
            return (
              <Link
                key={key}
                to="/wallet"
                style={{
                  flex: '1 1 140px',
                  textAlign: 'center',
                  textDecoration: 'none',
                  padding: '10px 12px',
                  borderRadius: 10,
                  fontWeight: 800,
                  fontSize: 13,
                  color: '#fff',
                  background: p.btnGradient || p.accent,
                  border: `1px solid ${p.accent}`
                }}
              >
                Get {p.label} · ₹{p.priceInr}/mo
              </Link>
            );
          })}
        </div>
      </div>
      {leaderboardFrozen && frozenBannerMsg ? (
        <div className="rewards-frozen-banner">
          <span style={{ fontSize: 18, marginRight: 8 }}>🔒</span>
          <span>{frozenBannerMsg}</span>{' '}
          <Link to="/rewards" style={{ color: T.yellow, fontWeight: 700 }}>
            Rewards &amp; prizes →
          </Link>
        </div>
      ) : null}
      <p style={{ color: T.text, fontSize: 13, marginBottom: 12, lineHeight: 1.45 }}>
        Ranked by <strong style={{ color: T.white }}>realized P/L</strong> (closed trades). Each close
        updates your stored total — starting <strong style={{ color: T.white }}>$10,000</strong> is not
        shown in this column. Open a trader name for balance &amp; history.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, overflowX: 'auto' }}>
        {[
          ['all_traders', 'All Traders'],
          ['week', 'This Week'],
          ['month', 'This Month'],
          ['all_time', 'All Time']
        ].map(([k, label], idx) => (
          <button
            key={`${k}-${idx}`}
            type="button"
            onClick={() => setTimeframe(k)}
            style={{
              padding: '9px 12px',
              borderRadius: 10,
              border: timeframe === k ? `1px solid ${T.yellow}` : `1px solid ${T.border}`,
              background: timeframe === k ? 'rgba(240,185,11,0.14)' : T.card,
              color: timeframe === k ? T.yellow : T.text,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {windowEndMs != null ? (
        <div
          style={{
            color: T.yellow,
            fontSize: 12,
            fontWeight: 800,
            marginBottom: 10,
            padding: '8px 10px',
            borderRadius: 10,
            border: `1px solid rgba(240,185,11,0.35)`,
            background: 'rgba(240,185,11,0.08)'
          }}
        >
          {timeframe === 'week' ? 'This week (IST, Mon 00:00 → next Mon 00:00)' : 'This month (IST, 1st 00:00 → next 1st 00:00)'} — ends in{' '}
          {formatDurationMs(windowEndMs - nowTick)}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {[
          ['winners', 'Top Winners'],
          ['losers', 'Top Losers']
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setPnlRankMode(k)}
            style={{
              flex: '1 1 120px',
              padding: '9px 12px',
              borderRadius: 10,
              border: pnlRankMode === k ? `1px solid ${T.yellow}` : `1px solid ${T.border}`,
              background: pnlRankMode === k ? 'rgba(240,185,11,0.14)' : T.card,
              color: pnlRankMode === k ? T.yellow : T.text,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 10 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search trader by name..."
          style={{
            width: '100%',
            borderRadius: 10,
            border: `1px solid ${T.border}`,
            background: T.card,
            color: T.white,
            padding: '11px 12px',
            fontSize: 13
          }}
        />
      </div>
      <div style={{ marginBottom: 10 }}>
        <button
          type="button"
          onClick={shareMyStory}
          style={{
            borderRadius: 10,
            border: `1px solid ${T.yellow}`,
            background: 'rgba(240,185,11,0.12)',
            color: T.yellow,
            padding: '9px 12px',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          Share My Story
        </button>
        {shareMsg ? <div style={{ marginTop: 6, color: T.text, fontSize: 12 }}>{shareMsg}</div> : null}
      </div>
      <div
        style={{
          position: 'fixed',
          left: -99999,
          top: 0,
          width: 390,
          pointerEvents: 'none'
        }}
        aria-hidden
      >
        <div
          ref={storyCardRef}
          style={{
            background: 'linear-gradient(180deg, #121821 0%, #0b0e11 100%)',
            borderRadius: 28,
            border: `2px solid ${T.yellow}`,
            padding: '20px 16px 18px',
            color: T.white,
            boxSizing: 'border-box',
            width: 390,
            minHeight: 760
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '0.02em', marginBottom: 6 }}>
            AURONX LEADERBOARD
          </div>
          <div style={{ color: T.yellow, fontWeight: 800, marginBottom: 10 }}>🔥 STORY UPDATE 🔥</div>
          {myLeaderboardStats ? (
            <div style={{ marginBottom: 12, lineHeight: 1.4 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{myLeaderboardStats.name}</div>
              <div style={{ color: T.text, fontSize: 13 }}>Rank #{myLeaderboardStats.rank}</div>
              <div style={{ color: myLeaderboardStats.pnl >= 0 ? T.green : T.red, fontSize: 18, fontWeight: 900 }}>
                {myLeaderboardStats.pnl >= 0 ? '+' : ''}${myLeaderboardStats.pnl.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </div>
            </div>
          ) : null}
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
            {(users || []).map((u, i) => (
              <div key={u.id || u.uid || i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                <span>{i + 1}. {u.name || 'Trader'}</span>
                <span style={{ color: Number(u._windowPnl || 0) >= 0 ? T.green : T.red }}>
                  {Number(u._windowPnl || 0) >= 0 ? '+' : ''}${Number(u._windowPnl || 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 14, fontWeight: 800, color: T.yellow }}>
            Want to beat me? Then beat here 🔥
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#9cc3ff' }}>
            Bio: https://www.theatharvacapital.com
          </div>
        </div>
      </div>
      <Card style={{ padding: 0, overflow: 'visible' }}>
        {!lbNarrow ? (
          <div style={{ ...rowGrid, backgroundColor: T.card2 }}>
            <span style={{ color: T.text, fontWeight: 600, fontSize: 12 }}>#</span>
            <span style={{ color: T.text, fontWeight: 600, fontSize: 12 }}>Trader</span>
            <span style={{ color: T.text, fontWeight: 600, fontSize: 12, textAlign: 'right' }}>
              Realized P/L
            </span>
            <span style={{ color: T.text, fontWeight: 600, fontSize: 12, textAlign: 'center' }}>
              Follow / Chat
            </span>
          </div>
        ) : (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: T.card2,
              color: T.text,
              fontSize: 12,
              fontWeight: 600,
              borderBottom: LB_ROW_DIVIDER
            }}
          >
            Traders — full name · realized P/L · Follow / Chat
          </div>
        )}
        {boardError ? (
          <div style={{ color: T.red, padding: 24, textAlign: 'center', fontSize: 14 }}>{boardError}</div>
        ) : null}
        {refreshing && !loading ? (
          <div style={{ color: T.text, opacity: 0.65, padding: '6px 12px', textAlign: 'center', fontSize: 11 }}>
            Updating rankings…
          </div>
        ) : null}
        {loading ? (
          <div style={{ color: T.text, padding: 40, textAlign: 'center' }}>Loading...</div>
        ) : users.length === 0 ? (
          <div style={{ color: T.text, padding: 36, textAlign: 'center', fontSize: 14 }}>
            No traders on the board yet. Rankings update when users close trades — check back soon.
          </div>
        ) : (
          users.slice(0, visibleCount).flatMap((u, idx) => {
            const pid = u.id || u.uid || '';
            if (!pid) return [];
            const medal =
              idx === 0 ? { icon: '🥇', color: '#f0b90b' } : idx === 1 ? { icon: '🥈', color: '#c0c7d1' } : idx === 2 ? { icon: '🥉', color: '#cd7f32' } : null;
            const pl = Number(u._windowPnl ?? 0);
            const plStr = `${pl >= 0 ? '+' : ''}$${pl.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}`;
            const name = u.name || 'Anonymous';
            const isSelfRow = Boolean(user?.uid && pid === user.uid && !actingAsUid);

            if (lbNarrow) {
              const row = (
                <div
                  key={pid || idx}
                  style={{
                    borderBottom: LB_ROW_DIVIDER,
                    padding: '14px 14px 16px',
                    transition: 'background 0.15s',
                    background:
                      idx === 0
                        ? 'linear-gradient(90deg, rgba(240,185,11,0.12), transparent)'
                        : idx === 1
                          ? 'linear-gradient(90deg, rgba(192,199,209,0.08), transparent)'
                          : idx === 2
                            ? 'linear-gradient(90deg, rgba(205,127,50,0.08), transparent)'
                            : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(240,185,11,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span
                      style={{
                        color: medal ? medal.color : T.white,
                        fontWeight: 800,
                        fontSize: 14,
                        flexShrink: 0,
                        minWidth: 22
                      }}
                    >
                      {idx + 1} {medal ? medal.icon : ''}
                    </span>
                    <LeaderboardAvatarWithPresence row={u} nowMs={presenceNow} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link
                        to={`/profile/${encodeURIComponent(pid)}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          color: T.white,
                          fontWeight: 800,
                          fontSize: 15,
                          textDecoration: 'none',
                          lineHeight: 1.35,
                          display: 'inline-flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 2,
                          maxWidth: '100%'
                        }}
                      >
                        <span style={{ wordBreak: 'break-word' }}>{name}</span>
                        <TraderNameBadges row={u} badgeSize={17} />
                        {isSelfRow ? (
                          <PaidFreeResetButton
                            compact
                            onSuccess={() => {
                              refreshUser();
                              loadBoard({ background: true });
                            }}
                          />
                        ) : null}
                      </Link>
                      <div
                        style={{
                          color: pl >= 0 ? T.green : T.red,
                          fontWeight: 800,
                          fontSize: 14,
                          marginTop: 8,
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        Realized P/L: {plStr}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginTop: 12,
                      paddingLeft: 32
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <LeaderboardFollowButton targetId={pid} />
                    <LeaderboardChatLink targetId={pid} />
                  </div>
                </div>
              );
              return [row];
            }

            const row = (
              <div
                key={pid || idx}
                style={{
                  ...rowGrid,
                  transition: 'background 0.15s',
                  background:
                    idx === 0
                      ? 'linear-gradient(90deg, rgba(240,185,11,0.12), transparent)'
                      : idx === 1
                        ? 'linear-gradient(90deg, rgba(192,199,209,0.08), transparent)'
                        : idx === 2
                          ? 'linear-gradient(90deg, rgba(205,127,50,0.08), transparent)'
                          : 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(240,185,11,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ color: medal ? medal.color : T.white, fontWeight: 700, fontSize: 13 }}>
                  {idx + 1} {medal ? medal.icon : ''}
                </span>
                <div style={{ minWidth: 0, padding: '4px 0' }}>
                  <Link
                    to={`/profile/${encodeURIComponent(pid)}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      color: T.white,
                      fontWeight: 700,
                      fontSize: 14,
                      textDecoration: 'none',
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: 0
                    }}
                  >
                    <LeaderboardAvatarWithPresence row={u} nowMs={presenceNow} />
                    <span
                      style={{
                        minWidth: 0,
                        flex: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 2
                      }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%'
                        }}
                      >
                        {name}
                      </span>
                      <TraderNameBadges row={u} />
                      {isSelfRow ? (
                        <PaidFreeResetButton
                          compact
                          onSuccess={() => {
                            refreshUser();
                            loadBoard({ background: true });
                          }}
                        />
                      ) : null}
                    </span>
                  </Link>
                </div>
                <span
                  style={{
                    color: pl >= 0 ? T.green : T.red,
                    fontWeight: 700,
                    fontSize: 13,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {plStr}
                </span>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'wrap'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <>
                    <LeaderboardFollowButton targetId={pid} />
                    <LeaderboardChatLink targetId={pid} />
                  </>
                </div>
              </div>
            );
            return [row];
          })
        )}
        {!loading && users.length > 0 ? (
          <p style={{ padding: '8px 12px 0', margin: 0, fontSize: 12, color: T.text, textAlign: 'center' }}>
            Showing {Math.min(visibleCount, users.length)} of {users.length} ranked traders
            {users.length >= 500 ? ' (top 500)' : ''}
          </p>
        ) : null}
        {!loading && users.length > visibleCount ? (
          <div style={{ padding: '14px 12px', display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + LEADERBOARD_PAGE_SIZE)}
              style={{
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                background: T.card2,
                color: T.white,
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Load more
            </button>
          </div>
        ) : null}
      </Card>
    </div>
  );
};
