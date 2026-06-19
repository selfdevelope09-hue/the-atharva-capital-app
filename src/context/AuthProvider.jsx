import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { AuthContext } from '../authContext';
import { auth, db } from '../firebaseClient';
import { normalizeUserDocData } from '../utils/userDoc';
import { defaultFirestoreUserRow, ensureFirestoreUserDoc } from '../utils/ensureFirestoreUser';
import { maybeMigrateFollowArrays, syncGoogleProfileToFirestore } from '../utils/googleProfileSync';
import { GOOGLE_WEB_CLIENT_ID } from '../config/googleSignIn.js';
import { embeddedBrowserBlockingGoogleOAuth } from '../utils/googleSignInEnvironment';
import {
  activateBffQuotaFallback,
  isBffDataMode,
  isBffChatMode,
  isSupabaseFallbackEnabled
} from '../config/dataBackend';
import { bff, bffPublic } from '../api/serverBff';
import { withChatAsPath } from '../utils/chatAsUid';
import {
  connectRealtimeSocket,
  disconnectRealtimeSocket,
  getRealtimeSocket,
  isRealtimeConnected,
  subscribeRealtimeStatus
} from '../api/realtimeSocket';
import { isRealtimeSocketEnabled } from '../config/realtimeServer';
import { isRealtimeTradeMode } from '../config/tradeBackend';
import { shouldFallbackFromFirestoreToSupabase } from '../utils/firestoreQuota';
import { useScreenTimeTracker } from '../hooks/useScreenTimeTracker';
import {
  readUserDataCache,
  writeUserDataCache,
  clearUserDataCache,
  optimisticUserFromAuth
} from '../utils/userDataCache';
import { firestoreTsMs } from '../utils/dmThread';
import {
  isOnCommunityChatRoute
} from '../utils/communityChatNotify';
import {
  requestBrowserNotificationPermission,
  showCommunityNotificationFromUnreadDelta,
  showDmBrowserNotification,
  showTradeCloseBrowserNotification
} from '../utils/browserNotifications';
import { sumDmUnread } from '../utils/threadUnread';
import { useAdaptivePoll } from '../hooks/useAdaptivePoll';
import { communityUnreadPollMs, dmThreadsPollMs, userMePollMs } from '../utils/appPoll';
import { userDataMeaningfullyChanged } from '../utils/userDataSnapshot';

const ACTING_AS_KEY = 'auron-acting-as-uid';

export function AuthProvider({ children }) {
  const [bffQuotaTick, setBffQuotaTick] = useState(0);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const userDataRef = useRef(null);
  const [actingAsUid, setActingAsUidState] = useState(() => {
    try {
      return localStorage.getItem(ACTING_AS_KEY) || '';
    } catch {
      return '';
    }
  });
  const [actingUserData, setActingUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dmThreads, setDmThreads] = useState([]);
  const [communityUnread, setCommunityUnread] = useState(0);
  const [communityLastMessage, setCommunityLastMessage] = useState(null);
  const [leaderboardWinner, setLeaderboardWinner] = useState(null);
  const prevCommunityUnreadRef = useRef(0);
  const prevDmUnreadRef = useRef(0);
  const dmUnreadReadyRef = useRef(false);
  const tradeCloseReadyRef = useRef(false);
  const seenClosedTradeKeysRef = useRef(new Set());
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [realtimeError, setRealtimeError] = useState('');
  const nativeGoogleInitialized = useRef(false);
  const realtimeConnectGen = useRef(0);

  useEffect(() => {
    userDataRef.current = userData;
  }, [userData]);

  /** Wait for Firebase initial auth state; failsafe so visitors are not stuck on a spinner. */
  useEffect(() => {
    let cancelled = false;
    auth.authStateReady().then(() => {
      if (!cancelled) setLoading(false);
    });
    const failsafe = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 10000);
    return () => {
      cancelled = true;
      window.clearTimeout(failsafe);
    };
  }, []);

  const commitUserData = useCallback((uid, raw) => {
    if (!uid) return;
    if (!raw) {
      userDataRef.current = null;
      setUserData(null);
      return;
    }
    const data = normalizeUserDocData(raw);
    if (!data) return;
    if (!userDataMeaningfullyChanged(userDataRef.current, data)) return;
    userDataRef.current = data;
    setUserData(data);
    writeUserDataCache(uid, data);
  }, []);

  useEffect(() => {
    const onMode = () => setBffQuotaTick((t) => t + 1);
    window.addEventListener('auron-bff-mode', onMode);
    return () => window.removeEventListener('auron-bff-mode', onMode);
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    requestBrowserNotificationPermission();
  }, [user?.uid]);

  useEffect(() => {
    if (!isRealtimeSocketEnabled()) return undefined;
    return subscribeRealtimeStatus((detail) => {
      setRealtimeConnected(!!detail.connected);
      setRealtimeError(detail.connected ? '' : String(detail.error || detail.reason || ''));
    });
  }, []);

  useEffect(() => {
    if (!isRealtimeSocketEnabled()) {
      setRealtimeConnected(false);
      setRealtimeError('');
      return undefined;
    }
    if (!user?.uid) {
      disconnectRealtimeSocket().catch(() => {});
      setRealtimeConnected(false);
      setRealtimeError('');
      return undefined;
    }

    const gen = ++realtimeConnectGen.current;
    setRealtimeError('');

    (async () => {
      try {
        await connectRealtimeSocket();
        if (realtimeConnectGen.current !== gen) return;
        setRealtimeConnected(isRealtimeConnected());
      } catch (e) {
        if (realtimeConnectGen.current !== gen) return;
        setRealtimeConnected(false);
        setRealtimeError(e?.message || 'Realtime connection failed');
        console.warn('realtime socket', e?.message || e);
      }
    })();

    const onVisible = () => {
      if (document.hidden || !auth.currentUser) return;
      connectRealtimeSocket()
        .then(() => {
          if (realtimeConnectGen.current === gen) setRealtimeConnected(isRealtimeConnected());
        })
        .catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (realtimeConnectGen.current === gen) {
        disconnectRealtimeSocket().catch(() => {});
      }
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!isRealtimeTradeMode() || !realtimeConnected || !user?.uid) return undefined;
    const socket = getRealtimeSocket();
    if (!socket) return undefined;
    const onWallet = (payload) => {
      if (!payload?.user) return;
      const data = normalizeUserDocData(payload.user);
      const tradeUid = payload.tradeUid || payload.user?.uid;
      if (actingAsUid && tradeUid === actingAsUid) {
        setActingUserData(data);
        return;
      }
      if (!actingAsUid) {
        commitUserData(user.uid, data);
      }
    };
    socket.on('wallet:snapshot', onWallet);
    socket.on('wallet:update', onWallet);
    return () => {
      socket.off('wallet:snapshot', onWallet);
      socket.off('wallet:update', onWallet);
    };
  }, [user?.uid, realtimeConnected, actingAsUid, commitUserData]);

  const fetchUserData = async (uid) => {
    const loadFromBff = async () => {
      try {
        const j = await bff('/api/data/me', { timeoutMs: 15000 });
        if (j.user) {
          const data = normalizeUserDocData(j.user);
          setUserData(data);
          setLeaderboardWinner(j.leaderboardWinner && j.leaderboardWinner.rank ? j.leaderboardWinner : null);
          writeUserDataCache(uid, data);
          return data;
        }
        setUserData(null);
        setLeaderboardWinner(null);
        return null;
      } catch (e) {
        if (e?.status === 403 && e?.payload?.platformBlocked) {
          try {
            await signOut(auth);
          } catch {}
          try {
            window.alert('This account has been restricted by the platform.');
          } catch {}
          setUserData(null);
          return null;
        }
        throw e;
      }
    };
    try {
      if (isBffDataMode()) {
        return await loadFromBff();
      }
      if (isRealtimeTradeMode()) {
        try {
          const { socketUserSync } = await import('../api/realtimeTrade');
          const j = await socketUserSync();
          if (j?.user) {
            const data = normalizeUserDocData(j.user);
            setUserData(data);
            writeUserDataCache(uid, data);
            return data;
          }
        } catch (e) {
          console.warn('fetchUserData socket', e?.message || e);
        }
        return userData;
      }
      let snap;
      try {
        snap = await getDoc(doc(db, 'users', uid));
      } catch (e) {
        if (shouldFallbackFromFirestoreToSupabase(e) && isSupabaseFallbackEnabled()) {
          activateBffQuotaFallback();
          return await loadFromBff();
        }
        throw e;
      }
      if (snap.exists()) {
        const data = normalizeUserDocData(snap.data());
        setUserData(data);
        writeUserDataCache(uid, data);
        return data;
      }
      const cu = auth.currentUser;
      if (cu && cu.uid === uid) {
        try {
          const data = await ensureFirestoreUserDoc(uid);
          setUserData(data);
          return data;
        } catch (e) {
          if (shouldFallbackFromFirestoreToSupabase(e) && isSupabaseFallbackEnabled()) {
            activateBffQuotaFallback();
            return await loadFromBff();
          }
          throw e;
        }
      }
      setUserData(null);
      return null;
    } catch (e) {
      console.error('fetchUserData', e);
      return null;
    }
  };

  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) await fetchUserData(result.user.uid);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(ACTING_AS_KEY)) {
        localStorage.removeItem(ACTING_AS_KEY);
        setActingAsUidState('');
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setLoading(false);
        setUserData(null);
        prevDmUnreadRef.current = 0;
        dmUnreadReadyRef.current = false;
        tradeCloseReadyRef.current = false;
        seenClosedTradeKeysRef.current = new Set();
        disconnectRealtimeSocket().catch(() => {});
        return;
      }

      const cached = readUserDataCache(u.uid);
      setUserData(cached || optimisticUserFromAuth(u));
      setLoading(false);

      (async () => {
        try {
          await fetchUserData(u.uid);
        } catch (e) {
          console.warn('fetchUserData', e?.message || e);
        }
        await maybeMigrateFollowArrays(u.uid).catch(() => {});
        try {
          const synced = await syncGoogleProfileToFirestore(u);
          if (synced) await fetchUserData(u.uid);
        } catch {
          /* ignore */
        }
      })();
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user?.uid || isBffDataMode()) return undefined;
    const ref = doc(db, 'config', 'blockedUsers');
    const unsub = onSnapshot(ref, async (snap) => {
      const uids = snap.exists() && Array.isArray(snap.data()?.uids) ? snap.data().uids.map(String) : [];
      if (uids.includes(user.uid)) {
        try {
          await signOut(auth);
        } catch {}
        try {
          window.alert('This account has been restricted by the platform.');
        } catch {}
      }
    });
    return () => unsub();
  }, [user?.uid]);

  useAdaptivePoll(
    async () => {
      if (!user?.uid || !isBffDataMode()) return;
      try {
        const j = await bff('/api/data/me', { timeoutMs: 15000 });
        if (j.user) commitUserData(user.uid, j.user);
      } catch (e) {
        if (e?.status === 403 && e?.payload?.platformBlocked) {
          signOut(auth).catch(() => {});
          try {
            window.alert(
              e?.payload?.accountRemoved
                ? 'This account was removed by the platform.'
                : 'This account has been restricted by the platform.'
            );
          } catch {}
          return;
        }
        console.error('user poll', e);
      }
    },
    userMePollMs,
    [user?.uid, bffQuotaTick],
    !!(user?.uid && isBffDataMode())
  );

  useEffect(() => {
    if (!user?.uid) return undefined;
    if (isBffDataMode()) {
      return undefined;
    }
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(
      ref,
      async (snap) => {
        if (!snap.exists()) {
          try {
            const data = await ensureFirestoreUserDoc(user.uid);
            if (data) setUserData(data);
          } catch (e) {
            console.warn('ensureFirestoreUserDoc', e?.message || e);
          }
          return;
        }
        const fsData = normalizeUserDocData(snap.data());
        setUserData(fsData);
      },
      (e) => {
        console.error('users doc snapshot', e);
        if (shouldFallbackFromFirestoreToSupabase(e) && isSupabaseFallbackEnabled()) {
          activateBffQuotaFallback();
        }
      }
    );
    return () => unsub();
  }, [user?.uid, bffQuotaTick]);

  useEffect(() => {
    if (!user?.uid || isBffDataMode()) return undefined;
    const onTradeSync = () => {
      getDoc(doc(db, 'users', user.uid))
        .then((snap) => {
          if (!snap.exists()) return;
          const fsData = normalizeUserDocData(snap.data());
          setUserData(fsData);
        })
        .catch(() => {});
    };
    window.addEventListener('auron-firestore-user-sync', onTradeSync);
    return () => window.removeEventListener('auron-firestore-user-sync', onTradeSync);
  }, [user?.uid, bffQuotaTick]);

  useEffect(() => {
    if (!actingAsUid) {
      setActingUserData(null);
      return undefined;
    }
    if (isBffDataMode()) {
      const tick = () =>
        bff(`/api/data/user-public?uid=${encodeURIComponent(actingAsUid)}`)
          .then((j) => {
            if (j.user) setActingUserData(normalizeUserDocData(j.user));
            else setActingUserData(null);
          })
          .catch(() => setActingUserData(null));
      tick();
      const id = window.setInterval(tick, 22000);
      return () => clearInterval(id);
    }
    const ref = doc(db, 'users', actingAsUid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) setActingUserData(normalizeUserDocData(snap.data()));
        else setActingUserData(null);
      },
      () => setActingUserData(null)
    );
    return () => unsub();
  }, [actingAsUid, bffQuotaTick]);

  const patchDmThreadUnread = useCallback((threadId, uid, count = 0) => {
    if (!threadId || !uid) return;
    setDmThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? { ...t, unreadByUser: { ...(t.unreadByUser || {}), [uid]: count } }
          : t
      )
    );
  }, []);

  const mergeDmThread = useCallback((thread) => {
    if (!thread?.id) return;
    setDmThreads((prev) => {
      const idx = prev.findIndex((t) => t.id === thread.id);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...thread };
      return next;
    });
  }, []);

  const refreshDmThreads = useCallback(
    async (opts = {}) => {
      const activeUid = actingAsUid || user?.uid || '';
      if (!activeUid || !isBffChatMode()) return [];
      if (actingAsUid && actingAsUid !== user?.uid && !String(actingAsUid).startsWith('showcase__')) {
        setDmThreads([]);
        return [];
      }
      try {
        const base = opts.hydrate ? '/api/chat/threads?syncFirestore=1' : '/api/chat/threads';
        const url = withChatAsPath(base, actingAsUid, user?.uid);
        const j = await bff(url);
        const rows = Array.isArray(j.threads) ? j.threads : [];
        rows.sort((a, b) => firestoreTsMs(b.updatedAt) - firestoreTsMs(a.updatedAt));
        setDmThreads(rows);
        return rows;
      } catch {
        return [];
      }
    },
    [actingAsUid, user?.uid]
  );

  useEffect(() => {
    const activeUid = actingAsUid || user?.uid || '';
    if (!activeUid) {
      setDmThreads([]);
      return undefined;
    }
    if (isBffChatMode()) {
      if (actingAsUid && actingAsUid !== user?.uid && !String(actingAsUid).startsWith('showcase__')) {
        setDmThreads([]);
        return undefined;
      }
      const load = (withSync) => {
        const base = withSync ? '/api/chat/threads?syncFirestore=1' : '/api/chat/threads';
        const q = withChatAsPath(base, actingAsUid, user?.uid);
        return bff(q)
          .then((j) => {
            const rows = Array.isArray(j.threads) ? j.threads : [];
            rows.sort((a, b) => firestoreTsMs(b.updatedAt) - firestoreTsMs(a.updatedAt));
            setDmThreads(rows);
          })
          .catch(() => {});
      };
      load(false);
      let cancelled = false;
      let timer;
      const loop = async () => {
        if (cancelled) return;
        await load(false);
        if (cancelled) return;
        timer = window.setTimeout(loop, dmThreadsPollMs());
      };
      loop();
      return () => {
        cancelled = true;
        if (timer != null) window.clearTimeout(timer);
      };
    }
    const qRef = query(collection(db, 'dmThreads'), where('participants', 'array-contains', activeUid));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => firestoreTsMs(b.updatedAt) - firestoreTsMs(a.updatedAt));
        setDmThreads(rows);
      },
      (e) => {
        console.error('dmThreads snapshot', e);
        if (shouldFallbackFromFirestoreToSupabase(e) && isSupabaseFallbackEnabled()) activateBffQuotaFallback();
      }
    );
    return unsub;
  }, [actingAsUid, user?.uid, bffQuotaTick]);

  useEffect(() => {
    if (!user?.uid) {
      setCommunityUnread(0);
      setCommunityLastMessage(null);
      prevCommunityUnreadRef.current = 0;
      return undefined;
    }
    if (!isBffChatMode()) {
      setCommunityUnread(0);
      return undefined;
    }
    requestBrowserNotificationPermission();

    const poll = () =>
      bff('/api/chat/community-unread')
        .then((j) => {
          const n = Number(j.unreadCount) || 0;
          const last = j.lastMessage && typeof j.lastMessage === 'object' ? j.lastMessage : null;
          setCommunityUnread(n);
          setCommunityLastMessage(last);

          const prev = prevCommunityUnreadRef.current;
          if (n > prev && n > 0 && (!isOnCommunityChatRoute() || document.hidden)) {
            showCommunityNotificationFromUnreadDelta({ deltaCount: n - prev, lastMessage: last });
          }
          prevCommunityUnreadRef.current = n;
        })
        .catch(() => {});

    let cancelled = false;
    let timer;
    const loop = async () => {
      if (cancelled) return;
      await poll();
      if (cancelled) return;
      timer = window.setTimeout(loop, communityUnreadPollMs());
    };
    loop();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [user?.uid, bffQuotaTick]);

  useEffect(() => {
    const viewerUid = actingAsUid || user?.uid || '';
    if (!viewerUid) {
      prevDmUnreadRef.current = 0;
      dmUnreadReadyRef.current = false;
      return;
    }
    const unread = sumDmUnread(dmThreads, viewerUid);
    if (!dmUnreadReadyRef.current) {
      prevDmUnreadRef.current = unread;
      dmUnreadReadyRef.current = true;
      return;
    }
    const prev = prevDmUnreadRef.current;
    if (unread > prev) {
      const newestThread = dmThreads[0]
        ? { ...dmThreads[0], viewerUid }
        : null;
      showDmBrowserNotification({ unreadCount: unread, thread: newestThread });
    }
    prevDmUnreadRef.current = unread;
  }, [dmThreads, user?.uid, actingAsUid]);

  useEffect(() => {
    const closed = Array.isArray(userData?.closedPositions) ? userData.closedPositions : [];
    if (!user?.uid) {
      tradeCloseReadyRef.current = false;
      seenClosedTradeKeysRef.current = new Set();
      return;
    }
    const toKey = (t) =>
      `${t?.positionId || ''}|${t?.symbol || ''}|${t?.closedAt || t?.time || ''}|${Number(t?.realizedPnl || 0).toFixed(4)}`;
    if (!tradeCloseReadyRef.current) {
      seenClosedTradeKeysRef.current = new Set(closed.map(toKey));
      tradeCloseReadyRef.current = true;
      return;
    }
    const seen = seenClosedTradeKeysRef.current;
    for (const trade of closed) {
      const key = toKey(trade);
      if (seen.has(key)) continue;
      seen.add(key);
      showTradeCloseBrowserNotification(trade);
    }
  }, [userData?.closedPositions, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    if (isBffDataMode()) {
      const mark = (online) =>
        bff('/api/data/presence', { method: 'POST', body: JSON.stringify({ online: !!online }) }).catch(
          () => {}
        );
      mark(true);
      const id = window.setInterval(() => mark(true), 20000);
      const onVisibility = () => mark(!document.hidden);
      const onBeforeUnload = () => mark(false);
      const onPageHide = () => mark(false);
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('beforeunload', onBeforeUnload);
      window.addEventListener('pagehide', onPageHide);
      return () => {
        window.clearInterval(id);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('beforeunload', onBeforeUnload);
        window.removeEventListener('pagehide', onPageHide);
        mark(false);
      };
    }
    const ref = doc(db, 'users', user.uid);
    const mark = (online) =>
      updateDoc(ref, {
        presenceOnline: !!online,
        lastSeenAt: serverTimestamp()
      }).catch(() => {});

    mark(true);
    const id = window.setInterval(() => mark(true), 20000);
    const onVisibility = () => mark(!document.hidden);
    const onBeforeUnload = () => mark(false);
    /** Mobile / PWA: tab close & app background — beforeunload is often skipped. */
    const onPageHide = () => mark(false);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
      mark(false);
    };
  }, [user?.uid, bffQuotaTick]);

  const signUp = async (email, password, name) => {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    const data = defaultFirestoreUserRow(res.user.uid, res.user);
    data.email = email;
    data.name = name || data.name;
    if (isBffDataMode()) {
      await bff('/api/data/me');
      await bff('/api/data/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: name || 'Trader' })
      }).catch(() => {});
      const j = await bff('/api/data/me');
      setUserData(normalizeUserDocData(j.user || data));
    } else {
      try {
        await setDoc(doc(db, 'users', res.user.uid), data);
        setUserData(normalizeUserDocData(data));
      } catch (e) {
        if (shouldFallbackFromFirestoreToSupabase(e) && isSupabaseFallbackEnabled()) {
          activateBffQuotaFallback();
          await bff('/api/data/me');
          await bff('/api/data/me', {
            method: 'PATCH',
            body: JSON.stringify({ name: name || 'Trader' })
          }).catch(() => {});
          const j = await bff('/api/data/me', { timeoutMs: 15000 });
          setUserData(normalizeUserDocData(j.user || data));
        } else throw e;
      }
    }
  };

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);

  const signInWithAppLogin = async (loginId, password) => {
    const j = await bffPublic('/api/data/app-login', {
      method: 'POST',
      body: JSON.stringify({
        loginId: String(loginId || '').trim().toLowerCase(),
        password: String(password || '')
      })
    });
    if (!j?.customToken) throw new Error(j?.error || 'Login failed');
    await signInWithCustomToken(auth, j.customToken);
  };
  const setActingAsUid = (uid) => {
    const next = String(uid || '').trim();
    setActingAsUidState(next);
    try {
      if (next) localStorage.setItem(ACTING_AS_KEY, next);
      else localStorage.removeItem(ACTING_AS_KEY);
    } catch {}
  };
  const clearActingAsUid = () => setActingAsUid('');
  const logout = async () => {
    clearActingAsUid();
    await disconnectRealtimeSocket().catch(() => {});
    if (Capacitor.isNativePlatform()) {
      try {
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        await GoogleAuth.signOut().catch(() => {});
      } catch {
        /* ignore */
      }
    }
    if (user?.uid) {
      if (isBffDataMode()) {
        await bff('/api/data/presence', { method: 'POST', body: JSON.stringify({ online: false }) }).catch(
          () => {}
        );
      } else {
        await updateDoc(doc(db, 'users', user.uid), {
          presenceOnline: false,
          lastSeenAt: serverTimestamp()
        }).catch(() => {});
      }
      try {
        sessionStorage.removeItem('auron-firestore-quota');
      } catch {
        /* ignore */
      }
    }
    if (user?.uid) clearUserDataCache(user.uid);
    setLeaderboardWinner(null);
    await signOut(auth);
  };
  const refreshUser = async () => {
    const authUid = user?.uid;
    if (actingAsUid) {
      if (isBffDataMode()) {
        try {
          const j = await bff(`/api/data/user-public?uid=${encodeURIComponent(actingAsUid)}`);
          if (j.user) {
            const data = normalizeUserDocData(j.user);
            setActingUserData(data);
            return data;
          }
        } catch {
          /* ignore */
        }
        return null;
      }
      try {
        const snap = await getDoc(doc(db, 'users', actingAsUid));
        if (snap.exists()) {
          const data = normalizeUserDocData(snap.data());
          setActingUserData(data);
          return data;
        }
      } catch (e) {
        if (shouldFallbackFromFirestoreToSupabase(e) && isSupabaseFallbackEnabled()) {
          activateBffQuotaFallback();
          try {
            const j = await bff(`/api/data/user-public?uid=${encodeURIComponent(actingAsUid)}`);
            if (j.user) {
              const data = normalizeUserDocData(j.user);
              setActingUserData(data);
              return data;
            }
          } catch {
            /* ignore */
          }
        }
      }
      return null;
    }
    if (authUid) return await fetchUserData(authUid);
  };

  const signInWithGoogle = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        if (!nativeGoogleInitialized.current) {
          const init = {
            scopes: ['profile', 'email'],
            grantOfflineAccess: true,
            serverClientId: GOOGLE_WEB_CLIENT_ID
          };
          if (Capacitor.getPlatform() === 'ios') {
            init.clientId = GOOGLE_WEB_CLIENT_ID;
          }
          await GoogleAuth.initialize(init);
          nativeGoogleInitialized.current = true;
        }
        const gUser = await GoogleAuth.signIn();
        const idToken = gUser?.authentication?.idToken;
        if (!idToken) {
          const err = new Error(
            'Google did not return an ID token. In Firebase Console → Project settings → Android app (`com.theatharvacapital.auronxtrade`), add SHA-1 fingerprints for both upload keystore and Play App Signing certificate, then download a new `google-services.json` and rebuild the app.'
          );
          err.code = 'auth/missing-google-id-token';
          throw err;
        }
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
        const nu = auth.currentUser;
        if (nu?.uid) {
          try {
            await ensureFirestoreUserDoc(nu.uid);
          } catch (err) {
            console.warn('provision user after Google native', err?.message || err);
          }
        }
      } catch (e) {
        const msg = String(e?.message || e?.errorMessage || '');
        const codeNum = Number(e?.code);
        if (/12501|The user canceled|cancel/i.test(msg) || codeNum === 12501) {
          const err = new Error('Sign-in was cancelled.');
          err.code = 'auth/popup-closed-by-user';
          throw err;
        }
        if (/access token|Something went wrong while retrieving/i.test(msg)) {
          const err = new Error(
            'Google account token retrieval failed. Add SHA fingerprints (upload keystore + Play App Signing) in Firebase Android app settings, then rebuild the app bundle.'
          );
          err.code = 'auth/google-native-token-fetch';
          throw err;
        }
        if (/Something went wrong|12500/i.test(msg) || [10, 12500].includes(codeNum)) {
          const err = new Error(
            'Google Developer Error. Verify Android SHA-1 values in Firebase (upload + Play signing), ensure OAuth consent is published, then make a new release build with updated `google-services.json`.'
          );
          err.code = 'auth/configuration-not-found';
          throw err;
        }
        throw e;
      }
      return;
    }

    const uaBlock = embeddedBrowserBlockingGoogleOAuth();
    if (uaBlock) {
      const err = new Error(
        `Google blocked: sign-in allowed only in Safari/Chrome/outside embedded browsers — not inside ${uaBlock.label}. Use ⋯ → Open in browser, or open the Auron app from Play Store (not Snapchat’s link preview).`
      );
      err.code = 'auth/embedded-browser-blocked';
      throw err;
    }

    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      if (
        e?.code === 'auth/popup-blocked' ||
        e?.code === 'auth/operation-not-supported-in-this-environment' ||
        e?.code === 'auth/cancelled-popup-request'
      ) {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw e;
    }
    const u = auth.currentUser;
    if (u?.uid) {
      try {
        await ensureFirestoreUserDoc(u.uid);
      } catch (e) {
        console.warn('provision user after Google', e?.message || e);
      }
    }
  };

  const effectiveUser = useMemo(() => {
    if (!user) return null;
    if (!actingAsUid) return user;
    return {
      ...user,
      uid: actingAsUid,
      displayName: actingUserData?.name || user.displayName || '',
      email: actingUserData?.email || user.email || ''
    };
  }, [actingAsUid, actingUserData?.email, actingUserData?.name, user]);

  const effectiveUserData = actingAsUid ? actingUserData : userData;
  const isActingAsShowcase = !!(actingAsUid && actingAsUid.startsWith('showcase__'));

  useScreenTimeTracker(actingAsUid || user?.uid || null);

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        userData: effectiveUserData,
        loading,
        signUp,
        login,
        signInWithAppLogin,
        logout,
        refreshUser,
        signInWithGoogle,
        dmThreads,
        refreshDmThreads,
        patchDmThreadUnread,
        mergeDmThread,
        communityUnread,
        communityLastMessage,
        leaderboardWinner,
        realUserUid: user?.uid || '',
        actingAsUid,
        setActingAsUid,
        clearActingAsUid,
        isActingAsShowcase,
        realtimeConnected,
        realtimeError,
        getRealtimeSocket
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
