import React, { useState, useRef, useEffect, useMemo, useLayoutEffect, useContext, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  addDoc,
  onSnapshot,
  updateDoc,
  increment,
  serverTimestamp,
  deleteField
} from 'firebase/firestore';
import { AuthContext } from '../authContext';
import { db, storage } from '../firebaseClient';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { activateBffQuotaFallback, isBffChatMode, isSupabaseFallbackEnabled } from '../config/dataBackend';
import { bff } from '../api/serverBff';
import { uploadMedia } from '../api/mediaUpload';
import { withChatAsPath, withChatAsBody, showcaseChatAsUid } from '../utils/chatAsUid';
import { compressImageForChat } from '../utils/imageCompress';
import { shouldFallbackFromFirestoreToSupabase } from '../utils/firestoreQuota';
import { T } from '../app/theme';
import { Input, Btn } from '../components/ui/AppPrimitives';
import LeaderboardRowAvatar from '../components/LeaderboardRowAvatar';
import { dmChannelId, firestoreTsMs, ensureDmThread } from '../utils/dmThread';
import {
  formatShowcasePeerPresence,
  isShowcaseUid,
  peerPresenceFromUserDoc
} from '../utils/showcasePresence';
import { formatChatClock, formatPresenceFromMs } from '../utils/chatPresenceFormat';
import PaidMemberBadge, { PlanTierChip } from '../components/PaidMemberBadge';
import PageLoader from '../components/ui/PageLoader';
import { communityMessagePreview } from '../utils/communityChatNotify';
import { displayTraderName } from '../utils/removedUserDisplay';
import { fetchAdminEditors, deleteCommunityChatMessage } from '../api/adminDevApi';
import { sumDmUnread, effectiveUnreadForUid } from '../utils/threadUnread';

const COMMUNITY_ROOM = 'community';
const COMMUNITY_CACHE_KEY = 'community__traders';
const COMMUNITY_NAME = 'Aurox trade Community';
const AURON_LOGO = '/auron-logo.jpg';

const CommunityLogo = ({ size = 44 }) => (
  <img
    className="chat-community-logo"
    src={AURON_LOGO}
    alt="AuronX"
    width={size}
    height={size}
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      objectFit: 'cover',
      flexShrink: 0,
      border: '2px solid rgba(0,168,132,0.45)',
      background: '#111b21'
    }}
  />
);

/** Who has read this message — { uid, name }[], no times. */
function seenByForMessage(message, opts) {
  const {
    thread,
    userUid,
    myDisplayName,
    peerPresence,
    communityReadsByMessage,
    isCommunity
  } = opts;
  const createdMs = firestoreTsMs(message?.createdAt);
  if (!createdMs) return [];

  if (isCommunity) {
    const rows = communityReadsByMessage?.[message?.id] || [];
    return rows.map((r) => ({
      uid: r.uid,
      name: r.fromName || r.name || 'Trader'
    }));
  }

  if (!thread) return [];
  const participants = thread.participants || [];
  const threadNames = thread.names || {};
  const lastSeenAt = thread.lastSeenAt || {};
  const viewers = [];
  for (const uid of participants) {
    const seenMs = firestoreTsMs(lastSeenAt[uid]);
    if (seenMs >= createdMs) {
      viewers.push({
        uid,
        name:
          uid === userUid
            ? myDisplayName || 'You'
            : threadNames[uid] || peerPresence?.[uid]?.profileName || 'Trader'
      });
    }
  }
  return viewers;
}

const MsgSeenInfo = ({ viewers, open, onToggle, onLight }) => (
  <span className="chat-msg-seen-wrap">
    <button
      type="button"
      className={`chat-msg-seen-btn${onLight ? ' chat-msg-seen-btn--light' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label="Seen by"
      aria-expanded={open}
    >
      i
    </button>
    {open ? (
      <div
        className={`chat-msg-seen-pop${onLight ? ' chat-msg-seen-pop--light' : ''}`}
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chat-msg-seen-pop-title">Seen by</div>
        {viewers.length ? (
          viewers.map((v) => (
            <div key={v.uid} className="chat-msg-seen-pop-name">
              {v.name}
            </div>
          ))
        ) : (
          <div className="chat-msg-seen-pop-empty">Not seen yet</div>
        )}
      </div>
    ) : null}
  </span>
);

const MsgDeliveryTicks = ({ pending, read, onLight }) => {
  if (pending) {
    return (
      <span
        title="Sending"
        style={{
          marginLeft: onLight ? 2 : 8,
          fontSize: 12,
          fontWeight: 700,
          color: onLight ? 'rgba(26,18,8,0.45)' : 'rgba(255,255,255,0.4)',
          flexShrink: 0,
          userSelect: 'none',
          lineHeight: 1
        }}
      >
        ✓
      </span>
    );
  }
  const color = read ? '#53bdeb' : onLight ? 'rgba(26,18,8,0.45)' : 'rgba(255,255,255,0.5)';
  const title = read ? 'Seen' : 'Delivered';
  return (
    <span
      title={title}
      style={{
        marginLeft: onLight ? 2 : 8,
        fontSize: 12,
        fontWeight: 700,
        color,
        flexShrink: 0,
        userSelect: 'none',
        letterSpacing: -3,
        lineHeight: 1
      }}
    >
      ✓✓
    </span>
  );
};

const formatMsgTime = (ts) => {
  const ms = firestoreTsMs(ts);
  if (!ms) return formatChatClock(new Date());
  return formatChatClock(new Date(ms));
};

/** WhatsApp-style day pill (IST-friendly via local timezone). */
const formatChatDayLabel = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / DAY_MS);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (d.getFullYear() !== now.getFullYear()) {
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

const TypingBubble = () => (
  <div
    className="chat-typing-bubble"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '10px 14px',
      borderRadius: 16,
      background: T.card2,
      border: `1px solid ${T.border}`,
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
    }}
    aria-label="Typing"
  >
    <span className="chat-typing-dot" />
    <span className="chat-typing-dot" />
    <span className="chat-typing-dot" />
  </div>
);

/** Heartbeat ~20s; allow slack so brief lag / tab background doesn't flash offline. */
const ONLINE_RECENT_MS = 2.5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const CHAT_MESSAGE_PAGE = 200;
/** Poll interval for BFF chat (ms) — lower = snappier, but more API calls. */
const CHAT_POLL_MS = 2000;
/** Pixels from bottom to treat as "reading latest" (WhatsApp-style tail follow). */
const CHAT_NEAR_BOTTOM_PX = 100;
const CHAT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const WA_GREEN = '#00a884';
const WA_PANEL = '#111b21';
const WA_PANEL_2 = '#202c33';
const WA_HEADER = '#202c33';

/** WhatsApp-style thread list time (Today → HH:MM, Yesterday, weekday, date). */
function formatThreadListTime(ts) {
  const ms = firestoreTsMs(ts);
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / DAY_MS);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 0) return time;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'numeric', year: '2-digit' });
}

function messagePreviewLine(m) {
  const t = typeof m?.text === 'string' ? m.text.trim() : '';
  if (t) return t;
  if (m?.fileUrl && m?.mediaKind === 'file') return m.fileName ? `📎 ${m.fileName}` : '📎 File';
  if (m?.imageUrl) return '📷 Photo';
  return '';
}

function messageBeforeCursor(m) {
  const ms = firestoreTsMs(m?.createdAt);
  if (!ms) return '';
  return new Date(ms).toISOString();
}

async function fetchUsersBulkBatched(uids) {
  const unique = [...new Set((uids || []).map(String).filter(Boolean))];
  if (!unique.length) return [];
  const users = [];
  for (let i = 0; i < unique.length; i += 80) {
    const chunk = unique.slice(i, i + 80);
    try {
      const j = await bff('/api/data/users-bulk', { method: 'POST', body: JSON.stringify({ uids: chunk }) });
      users.push(...(j.users || []));
    } catch {
      /* ignore chunk errors */
    }
  }
  return users;
}

function mergeLatestMessageWindow(prev, next, cacheKey, cacheRef) {
  if (!Array.isArray(next) || !next.length) return prev;
  if (!Array.isArray(prev) || !prev.length) {
    cacheRef.current[cacheKey] = next;
    return next;
  }
  const prevLast = prev[prev.length - 1]?.id;
  const nextLast = next[next.length - 1]?.id;
  if (prevLast === nextLast && prev.length === next.length) return prev;
  const seen = new Set(next.map((m) => m.id));
  const extras = prev.filter((m) => !seen.has(m.id));
  if (extras.length) {
    const merged = [...extras, ...next].sort(
      (a, b) => firestoreTsMs(a.createdAt) - firestoreTsMs(b.createdAt)
    );
    cacheRef.current[cacheKey] = merged;
    return merged;
  }
  cacheRef.current[cacheKey] = next;
  return next;
}

/** Online = recent activity only. Never trust Firestore `presenceOnline` alone — it stays true if app dies without cleanup. */
const formatPresence = (lastSeenMs) => formatPresenceFromMs(lastSeenMs, ONLINE_RECENT_MS);

function lastActivityMsForPeer(otherUid, threadDoc, peerPresenceMap) {
  const uid = String(otherUid || '');
  const p = peerPresenceMap?.[otherUid];
  const globalMs = p?.lastSeenMs || 0;
  const threadMs = firestoreTsMs(threadDoc?.lastSeenAt?.[otherUid]);

  if (!isShowcaseUid(uid)) {
    return Math.max(globalMs, threadMs);
  }

  if (p?.showcaseForcedOnline === true) return Date.now();
  if (p?.showcasePresenceExplicitOffline === true) {
    const off = Number(p?.showcaseLastSeenMs) || 0;
    return off > 0 ? off : Date.now() - ONLINE_RECENT_MS - 1000;
  }
  const off = Number(p?.showcaseLastSeenMs) || 0;
  if (off > 0) return off;
  return Math.max(globalMs, threadMs);
}

/** Read receipts: only thread lastSeenAt (not global online/presence). */
function readReceiptMsForPeer(otherUid, threadDoc) {
  return firestoreTsMs(threadDoc?.lastSeenAt?.[otherUid]) || 0;
}

function peerPresenceLabel(otherUid, threadDoc, peerPresenceMap) {
  const uid = String(otherUid || '');
  if (isShowcaseUid(uid)) {
    return formatShowcasePeerPresence(peerPresenceMap?.[otherUid]);
  }
  return formatPresence(lastActivityMsForPeer(otherUid, threadDoc, peerPresenceMap));
}

export const ChatScreen = () => {
  const [bffModeRev, setBffModeRev] = useState(0);
  const {
    user,
    userData,
    loading: authLoading,
    dmThreads,
    actingAsUid,
    realUserUid,
    refreshDmThreads,
    patchDmThreadUnread,
    mergeDmThread,
    communityUnread,
    communityLastMessage
  } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const searchWith = useMemo(() => new URLSearchParams(location.search).get('with') || '', [location.search]);
  const searchRoom = useMemo(() => new URLSearchParams(location.search).get('room') || '', [location.search]);
  const searchMsg = useMemo(() => new URLSearchParams(location.search).get('msg') || '', [location.search]);
  const isCommunityView = searchRoom === COMMUNITY_ROOM;

  const [activeOtherId, setActiveOtherId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [outPending, setOutPending] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [peerChatProfile, setPeerChatProfile] = useState({ photoURL: '', name: '', isPaidMember: false, paidPlanType: null });
  const [bootErr, setBootErr] = useState('');
  const [firestoreErr, setFirestoreErr] = useState('');
  const [threadSearch, setThreadSearch] = useState('');
  const [threadTab, setThreadTab] = useState('all');
  const [peerPresence, setPeerPresence] = useState({});
  const [pendingImageUrl, setPendingImageUrl] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [communityReadsByMessage, setCommunityReadsByMessage] = useState({});
  const [communityProfiles, setCommunityProfiles] = useState({});
  const [peerReadReceiptMs, setPeerReadReceiptMs] = useState(0);
  const [openSeenInfoId, setOpenSeenInfoId] = useState(null);
  const chatImageInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const prevMessagesLenRef = useRef(0);
  const [newMessagesBelow, setNewMessagesBelow] = useState(0);
  const messageRowRefs = useRef({});
  const swipeReplyStartRef = useRef(null);
  const reloadMessagesRef = useRef(null);
  const messagesCacheRef = useRef({});
  const oldestLoadedRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [deletingCommunityMsgId, setDeletingCommunityMsgId] = useState('');
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 720
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const fn = () => setNarrow(mq.matches);
    mq.addEventListener('change', fn);
    fn();
    return () => mq.removeEventListener('change', fn);
  }, []);
  useEffect(() => {
    const onBff = () => setBffModeRev((x) => x + 1);
    window.addEventListener('auron-bff-mode', onBff);
    return () => window.removeEventListener('auron-bff-mode', onBff);
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setIsPlatformAdmin(false);
      return undefined;
    }
    let cancelled = false;
    fetchAdminEditors()
      .then((editors) => {
        if (!cancelled) setIsPlatformAdmin(editors.includes(user.uid));
      })
      .catch(() => {
        if (!cancelled) setIsPlatformAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);
  useEffect(() => {
    if (!user?.uid || !isBffChatMode()) return;
    refreshDmThreads?.();
  }, [user?.uid, actingAsUid, refreshDmThreads]);
  useEffect(() => {
    setReplyTo(null);
    setOpenSeenInfoId(null);
  }, [searchWith, searchRoom]);

  useEffect(() => {
    if (!openSeenInfoId) return undefined;
    const close = () => setOpenSeenInfoId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openSeenInfoId]);

  useEffect(() => {
    if (isCommunityView) {
      setActiveOtherId(null);
      setBootErr('');
      return;
    }
    if (!searchWith) {
      setActiveOtherId(null);
      setBootErr('');
      return;
    }
    if (!user || searchWith === user.uid) {
      if (searchWith === user.uid) setBootErr('You cannot chat with yourself.');
      setActiveOtherId(null);
      return;
    }

    setActiveOtherId(searchWith);
    setBootErr('');
    const tid = dmChannelId(user.uid, searchWith);
    if (messagesCacheRef.current[tid]?.length) {
      setMessages(messagesCacheRef.current[tid]);
    }

    let cancelled = false;
    (async () => {
      try {
        const meName = userData?.name || user?.email?.split('@')[0] || 'Trader';
        const existingThread = dmThreads.find((x) => x.id === tid);
        let otherName =
          existingThread?.names?.[searchWith] ||
          peerPresence?.[searchWith]?.profileName ||
          'Trader';
        if (isBffChatMode()) {
          const existing = dmThreads.find((x) => x.id === tid);
          if (!existing?.names?.[searchWith]) {
            const pub = await bff(`/api/data/user-public?uid=${encodeURIComponent(searchWith)}`);
            if (!pub.user) {
              if (!cancelled) setBootErr('Trader not found.');
              return;
            }
            otherName = pub.user.name || otherName;
          }
        } else {
          let oSnap;
          try {
            oSnap = await getDoc(doc(db, 'users', searchWith));
          } catch (getErr) {
            if (shouldFallbackFromFirestoreToSupabase(getErr) && isSupabaseFallbackEnabled()) {
              activateBffQuotaFallback();
              const pub = await bff(`/api/data/user-public?uid=${encodeURIComponent(searchWith)}`);
              if (!pub.user) {
                if (!cancelled) setBootErr('Trader not found.');
                return;
              }
              otherName = pub.user.name || otherName;
            } else {
              throw getErr;
            }
          }
          if (oSnap) {
            if (!oSnap.exists()) {
              if (!cancelled) setBootErr('Trader not found.');
              return;
            }
            otherName = oSnap.data().name || otherName;
          }
        }
        await ensureDmThread(user.uid, searchWith, meName, otherName, {
          asUid: showcaseChatAsUid(actingAsUid, realUserUid) || undefined
        });
        refreshDmThreads?.().catch(() => {});
        if (!cancelled) {
          setFirestoreErr('');
          setBootErr('');
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          const msg = e?.message || '';
          if (e?.code === 'permission-denied' || msg.toLowerCase().includes('permission'))
            setFirestoreErr(
              'Chat access was blocked by Firestore rules. Update and deploy the latest Firestore rules.'
            );
          setBootErr(msg || 'Could not open chat.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, searchWith, isCommunityView, userData?.name, user?.email, actingAsUid, realUserUid, dmThreads]);

  const channelId = useMemo(() => {
    if (!user || !activeOtherId) return null;
    return dmChannelId(user.uid, activeOtherId);
  }, [user, activeOtherId]);

  const chatViewKey = isCommunityView ? COMMUNITY_CACHE_KEY : channelId;
  const inConversation = !!activeOtherId || isCommunityView;
  const canCompose = inConversation && !uploadBusy && !sending;

  useEffect(() => {
    if (!channelId || isCommunityView) {
      setPeerReadReceiptMs(0);
    }
  }, [channelId, isCommunityView]);

  useEffect(() => {
    stickToBottomRef.current = true;
    prevMessagesLenRef.current = 0;
    setNewMessagesBelow(0);
    oldestLoadedRef.current = false;
    setHasMoreOlder(false);
    setLoadingOlder(false);
    loadingOlderRef.current = false;
  }, [chatViewKey]);

  useEffect(() => {
    if (!user?.uid || !chatViewKey) {
      if (!isCommunityView) setMessages([]);
      return undefined;
    }
    const cached = messagesCacheRef.current[chatViewKey];
    if (cached?.length) setMessages(cached);

    if (isCommunityView) {
      if (!isBffChatMode()) {
        setFirestoreErr('Community chat requires the latest server.');
        return undefined;
      }
      const load = () =>
        bff(`/api/chat/community-messages?limit=${CHAT_MESSAGE_PAGE}`)
          .then((j) => {
            const next = Array.isArray(j.messages) ? j.messages : [];
            if (j.readsByMessage && typeof j.readsByMessage === 'object') {
              setCommunityReadsByMessage(j.readsByMessage);
            }
            if (!oldestLoadedRef.current) {
              setHasMoreOlder(j.hasMore === true);
            }
            setMessages((prev) => mergeLatestMessageWindow(prev, next, chatViewKey, messagesCacheRef));
            setFirestoreErr('');
          })
          .catch((e) => {
            console.error('community messages', e);
            setFirestoreErr(e?.message || 'Could not load community chat.');
          });
      reloadMessagesRef.current = load;
      load();
      const id = window.setInterval(load, CHAT_POLL_MS);
      return () => {
        reloadMessagesRef.current = null;
        clearInterval(id);
      };
    }

    if (isBffChatMode()) {
      const base = `/api/chat/messages?threadId=${encodeURIComponent(channelId)}&limit=${CHAT_MESSAGE_PAGE}`;
      const url = withChatAsPath(base, actingAsUid, realUserUid);
      const load = () =>
        bff(url)
          .then((j) => {
            const peerMs = firestoreTsMs(j.peerLastSeenAt);
            if (peerMs > 0) setPeerReadReceiptMs((prev) => Math.max(prev, peerMs));
            const next = Array.isArray(j.messages) ? j.messages : [];
            setMessages((prev) => {
              if (
                prev.length === next.length &&
                prev.length > 0 &&
                prev[prev.length - 1]?.id === next[next.length - 1]?.id
              ) {
                return prev;
              }
              messagesCacheRef.current[chatViewKey] = next;
              return next;
            });
            setFirestoreErr('');
          })
          .catch((e) => {
            console.error('messages', e);
            const msg = e?.message || 'Could not load messages.';
            setFirestoreErr(msg === 'Forbidden' ? 'Chat access denied for this account.' : msg);
          });
      reloadMessagesRef.current = load;
      load();
      const id = window.setInterval(load, CHAT_POLL_MS);
      return () => {
        reloadMessagesRef.current = null;
        clearInterval(id);
      };
    }
    const mq = query(
      collection(db, 'dmThreads', channelId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(CHAT_MESSAGE_PAGE)
    );
    const unsub = onSnapshot(
      mq,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const next = rows.slice().reverse();
        messagesCacheRef.current[chatViewKey] = next;
        setMessages(next);
        setFirestoreErr('');
      },
      (e) => {
        console.error('messages', e);
        if (e?.code === 'permission-denied' || (e?.message || '').toLowerCase().includes('permission')) {
          setFirestoreErr(
            'Messages read blocked — deploy firestore.rules to Firebase (CLI: firebase deploy --only firestore:rules).'
          );
        }
      }
    );
    return unsub;
  }, [chatViewKey, channelId, isCommunityView, user?.uid, bffModeRev, actingAsUid, realUserUid]);

  useEffect(() => {
    if (!searchMsg.trim()) return;
    setDraft(searchMsg);
  }, [searchMsg]);

  useEffect(() => {
    if (!isCommunityView || !user?.uid || !isBffChatMode()) return undefined;
    const fromName = userData?.name || user?.email?.split('@')[0] || 'Trader';
    const mark = () =>
      bff('/api/chat/community-mark-read', {
        method: 'POST',
        body: JSON.stringify(withChatAsBody({ fromName }, actingAsUid, realUserUid))
      }).catch(() => {});
    mark();
    const id = window.setInterval(mark, 4000);
    return () => clearInterval(id);
  }, [isCommunityView, user?.uid, userData?.name, user?.email, actingAsUid, realUserUid]);

  useEffect(() => {
    if (!isCommunityView || !user?.uid || !messages.length || !isBffChatMode()) return;
    const uids = [...new Set(messages.map((m) => m.fromUid).filter(Boolean))];
    if (!uids.length) return;
    let cancelled = false;
    fetchUsersBulkBatched(uids)
      .then((rows) => {
        if (cancelled) return;
        const next = {};
        rows.forEach((u) => {
          if (!u?.uid) return;
          next[u.uid] = {
            photoURL: u.accountRemoved ? '' : u.photoURL || '',
            name: u.name || '',
            accountRemoved: u.accountRemoved === true,
            isPaidMember: u.isPaidMember === true,
            paidPlanType: u.paidPlanType || null
          };
        });
        setCommunityProfiles((prev) => ({ ...prev, ...next }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isCommunityView, messages, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    setCommunityProfiles((prev) => ({
      ...prev,
      [user.uid]: {
        photoURL: userData?.photoURL || user?.photoURL || '',
        name: userData?.name || user?.email?.split('@')[0] || 'Trader',
        isPaidMember: userData?.isPaidMember === true,
        paidPlanType: userData?.paidPlanType || null
      }
    }));
  }, [user?.uid, user?.photoURL, user?.email, userData?.photoURL, userData?.name, userData?.isPaidMember, userData?.paidPlanType]);

  useEffect(() => {
    setPendingImageUrl('');
    setPendingFile(null);
  }, [chatViewKey]);

  const activeThread = useMemo(
    () => (channelId ? dmThreads.find((x) => x.id === channelId) : null),
    [dmThreads, channelId]
  );

  const filteredThreads = useMemo(() => {
    return dmThreads.filter((t) => {
      const otherUid = (t.participants || []).find((p) => p !== user.uid);
      if (!otherUid) return false;
      if (threadTab === 'followers') {
        const myFollowers = Array.isArray(userData?.followers) ? userData.followers : [];
        if (!myFollowers.includes(otherUid)) return false;
      }
      if (threadTab === 'following') {
        const myFollowing = Array.isArray(userData?.following) ? userData.following : [];
        if (!myFollowing.includes(otherUid)) return false;
      }
      const name = (t?.names?.[otherUid] || '').toLowerCase();
      return !threadSearch.trim() || name.includes(threadSearch.trim().toLowerCase());
    });
  }, [dmThreads, threadSearch, threadTab, user.uid, userData?.followers, userData?.following]);

  const listThreads = filteredThreads;

  const dmUnread = useMemo(() => sumDmUnread(listThreads, user?.uid), [listThreads, user?.uid]);
  const totalChatUnread = dmUnread + (Number(communityUnread) || 0);

  const communityPreviewLine = useMemo(() => {
    if (communityUnread > 0 && communityLastMessage) {
      const who = communityLastMessage.fromName || 'Trader';
      const body = communityMessagePreview(communityLastMessage);
      return body ? `${who}: ${body}` : `${who} sent a message`;
    }
    return 'Group chat — all traders';
  }, [communityUnread, communityLastMessage]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const ids = Array.from(
      new Set(
        dmThreads
          .map((t) => (t.participants || []).find((p) => p !== user.uid))
          .filter(Boolean)
      )
    );
    if (!ids.length) {
      setPeerPresence({});
      return undefined;
    }
    if (isBffChatMode()) {
      const load = () =>
        bff('/api/data/users-bulk', { method: 'POST', body: JSON.stringify({ uids: ids }) })
          .then((j) => {
            const next = {};
            (j.users || []).forEach((u) => {
              if (!u?.uid) return;
              next[u.uid] = peerPresenceFromUserDoc(u.uid, u);
            });
            setPeerPresence((prev) => ({ ...prev, ...next }));
          })
          .catch(() => {});
      load();
      const id = window.setInterval(load, 4000);
      return () => clearInterval(id);
    }
    const unsubs = ids.map((uid) =>
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          const uidKey = snap.id;
          const d = snap.exists() ? snap.data() : {};
          setPeerPresence((prev) => ({
            ...prev,
            [uidKey]: { ...(prev[uidKey] || {}), ...peerPresenceFromUserDoc(uidKey, d) }
          }));
        },
        (e) => {
          if (shouldFallbackFromFirestoreToSupabase(e) && isSupabaseFallbackEnabled()) activateBffQuotaFallback();
        }
      )
    );
    return () => unsubs.forEach((fn) => fn && fn());
  }, [dmThreads, user?.uid, bffModeRev]);

  /** Showcase seen only when dev opened that showcase profile and is in this thread. */
  const markReadPayload = useCallback(() => {
    const body = { threadId: channelId };
    const as =
      actingAsUid && actingAsUid.startsWith('showcase__') && activeOtherId && channelId
        ? actingAsUid
        : '';
    if (as && channelId === dmChannelId(as, activeOtherId)) {
      body.asUid = as;
    }
    return body;
  }, [channelId, actingAsUid, activeOtherId]);

  const readerUidForUnread = useMemo(() => {
    if (actingAsUid && actingAsUid.startsWith('showcase__')) return actingAsUid;
    return user?.uid || '';
  }, [actingAsUid, user?.uid]);

  const markDmThreadRead = useCallback(() => {
    if (!channelId || !user?.uid || isCommunityView) return;
    const readUid = readerUidForUnread || user.uid;
    patchDmThreadUnread?.(channelId, readUid, 0);
    if (isBffChatMode()) {
      bff('/api/chat/mark-read', {
        method: 'POST',
        body: JSON.stringify(withChatAsBody(markReadPayload(), actingAsUid, realUserUid))
      })
        .then((j) => {
          if (j?.thread) mergeDmThread?.(j.thread);
          else refreshDmThreads?.();
        })
        .catch(() => {});
      return;
    }
    const ref = doc(db, 'dmThreads', channelId);
    updateDoc(ref, {
      [`unreadByUser.${readUid}`]: 0,
      [`lastSeenAt.${readUid}`]: serverTimestamp()
    }).catch(() => {});
  }, [
    channelId,
    user?.uid,
    isCommunityView,
    readerUidForUnread,
    patchDmThreadUnread,
    mergeDmThread,
    actingAsUid,
    realUserUid,
    markReadPayload,
    refreshDmThreads
  ]);

  useEffect(() => {
    if (!channelId || !user || isCommunityView) return undefined;
    markDmThreadRead();
    const t = setTimeout(markDmThreadRead, 350);
    const keepAlive = window.setInterval(markDmThreadRead, 4000);
    return () => {
      clearTimeout(t);
      clearInterval(keepAlive);
      markDmThreadRead();
    };
  }, [channelId, user, isCommunityView, markDmThreadRead, messages.length]);

  useEffect(() => {
    if (!channelId || !user?.uid) return undefined;
    return () => {
      if (isBffChatMode()) {
        bff('/api/chat/typing', {
          method: 'POST',
          body: JSON.stringify(withChatAsBody({ threadId: channelId, clear: true }, actingAsUid, realUserUid))
        }).catch(() => {});
        return;
      }
      const threadRef = doc(db, 'dmThreads', channelId);
      const uidKey = `typingByUser.${user.uid}`;
      updateDoc(threadRef, { [uidKey]: deleteField() }).catch(() => {});
    };
  }, [channelId, user?.uid]);

  useEffect(() => {
    if (!channelId || !user?.uid || !activeOtherId) return undefined;
    if (isBffChatMode()) {
      const clearTyping = () =>
        bff('/api/chat/typing', {
          method: 'POST',
          body: JSON.stringify(withChatAsBody({ threadId: channelId, clear: true }, actingAsUid, realUserUid))
        }).catch(() => {});
      if (!draft.trim()) {
        clearTyping();
        return undefined;
      }
      const debounceT = window.setTimeout(() => {
        bff('/api/chat/typing', {
          method: 'POST',
          body: JSON.stringify(withChatAsBody({ threadId: channelId, clear: false }, actingAsUid, realUserUid))
        }).catch(() => {});
      }, 400);
      const pingId = window.setInterval(() => {
        bff('/api/chat/typing', {
          method: 'POST',
          body: JSON.stringify(withChatAsBody({ threadId: channelId, clear: false }, actingAsUid, realUserUid))
        }).catch(() => {});
      }, 2000);
      const idleT = window.setTimeout(clearTyping, 9000);
      return () => {
        window.clearTimeout(debounceT);
        window.clearInterval(pingId);
        window.clearTimeout(idleT);
      };
    }
    const threadRef = doc(db, 'dmThreads', channelId);
    const uidKey = `typingByUser.${user.uid}`;
    const clearTyping = () => updateDoc(threadRef, { [uidKey]: deleteField() }).catch(() => {});

    if (!draft.trim()) {
      clearTyping();
      return undefined;
    }

    const debounceT = window.setTimeout(() => {
      updateDoc(threadRef, { [uidKey]: serverTimestamp() }).catch(() => {});
    }, 400);
    const pingId = window.setInterval(() => {
      updateDoc(threadRef, { [uidKey]: serverTimestamp() }).catch(() => {});
    }, 2000);
    const idleT = window.setTimeout(clearTyping, 9000);

    return () => {
      window.clearTimeout(debounceT);
      window.clearInterval(pingId);
      window.clearTimeout(idleT);
    };
  }, [draft, channelId, user?.uid, activeOtherId]);

  useEffect(() => {
    if (!activeOtherId) {
      setPeerChatProfile({ photoURL: '', name: '', isPaidMember: false, paidPlanType: null });
      return undefined;
    }
    if (isBffChatMode()) {
      const load = () =>
        bff(`/api/data/user-public?uid=${encodeURIComponent(activeOtherId)}`)
          .then((j) => {
            const u = j.user;
            if (!u) {
              setPeerChatProfile({ photoURL: '', name: '', isPaidMember: false, paidPlanType: null });
              return;
            }
            const photoURL = u.photoURL || '';
            const name = u.name || '';
            const paid = u.isPaidMember === true;
            const paidPlanType = u.paidPlanType || null;
            const lastSeenMs = firestoreTsMs(u.lastSeenAt);
            setPeerChatProfile({ photoURL, name, isPaidMember: paid, paidPlanType });
            setPeerPresence((prev) => ({
              ...prev,
              [activeOtherId]: { ...(prev[activeOtherId] || {}), photoURL, profileName: name, lastSeenMs }
            }));
          })
          .catch(() => setPeerChatProfile({ photoURL: '', name: '' }));
      load();
      const id = window.setInterval(load, 3500);
      return () => clearInterval(id);
    }
    const uref = doc(db, 'users', activeOtherId);
    const unsub = onSnapshot(
      uref,
      (s) => {
        const d = s.exists() ? s.data() : {};
        const photoURL = d.photoURL || '';
        const name = d.name || '';
        const paid = d.isPaidMember === true;
        const paidPlanType = d.paidPlanType || null;
        const lastSeenMs = firestoreTsMs(d?.lastSeenAt);
        setPeerChatProfile({ photoURL, name, isPaidMember: paid, paidPlanType });
        setPeerPresence((prev) => ({
          ...prev,
          [activeOtherId]: { ...(prev[activeOtherId] || {}), photoURL, profileName: name, lastSeenMs }
        }));
      },
      () => setPeerChatProfile({ photoURL: '', name: '' })
    );
    return unsub;
  }, [activeOtherId]);

  const pickThread = (otherUid) => {
    if (!otherUid || !user?.uid || otherUid === user.uid) return;
    setActiveOtherId(otherUid);
    setBootErr('');
    const tid = dmChannelId(user.uid, otherUid);
    patchDmThreadUnread?.(tid, readerUidForUnread || user.uid, 0);
    if (messagesCacheRef.current[tid]?.length) {
      setMessages(messagesCacheRef.current[tid]);
    }
    navigate(`/chat?with=${encodeURIComponent(otherUid)}`, { replace: narrow });
  };

  const pickCommunity = () => {
    setActiveOtherId(null);
    setBootErr('');
    if (messagesCacheRef.current[COMMUNITY_CACHE_KEY]?.length) {
      setMessages(messagesCacheRef.current[COMMUNITY_CACHE_KEY]);
    }
    navigate('/chat?room=community', { replace: narrow });
  };

  const backToChatList = () => {
    markDmThreadRead();
    setActiveOtherId(null);
    navigate('/chat', { replace: true });
  };

  /** WhatsApp-style: live profile name/photo when available, else thread cache. */
  const myDisplayName =
    (userData?.name && String(userData.name).trim()) ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'You';
  const myPhotoURL = userData?.photoURL || user?.photoURL || '';

  const peerMeta = (otherUid, tid) => {
    const p = peerPresence?.[otherUid];
    const name = (p?.profileName && String(p.profileName).trim()) || otherNameFor(tid, otherUid);
    return {
      name,
      photoURL: p?.photoURL || '',
      isPaidMember: p?.isPaidMember === true,
      paidPlanType: p?.paidPlanType || null
    };
  };

  const activePeerIsPaid =
    peerChatProfile.isPaidMember === true ||
    peerPresence?.[activeOtherId]?.isPaidMember === true;

  const scrollToMessageId = (messageId) => {
    if (!messageId) return;
    const el = messageRowRefs.current[messageId];
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    try {
      el?.classList.remove('chat-msg--highlight');
      void el?.offsetWidth;
      el?.classList.add('chat-msg--highlight');
      window.setTimeout(() => el?.classList.remove('chat-msg--highlight'), 1400);
    } catch {
      /* ignore */
    }
  };

  const otherNameFor = (tid, otherUid) => {
    const t = dmThreads.find((x) => x.id === tid);
    return t?.names?.[otherUid] || 'Trader';
  };

  const activePeerDisplayName =
    activeOtherId && user
      ? (peerChatProfile.name && String(peerChatProfile.name).trim()) ||
        otherNameFor(channelId, activeOtherId) ||
        'Trader'
      : 'Chats';

  const showThreadList = !narrow || !inConversation;
  const showChatPane = !narrow || inConversation;

  const activePresence = activeOtherId
    ? peerPresenceLabel(activeOtherId, activeThread, peerPresence)
    : { online: false, label: '' };
  const threadReceiptMs = activeOtherId ? readReceiptMsForPeer(activeOtherId, activeThread) : 0;
  const otherLastSeenMs = Math.max(peerReadReceiptMs, threadReceiptMs);

  useEffect(() => {
    if (isCommunityView || !activeOtherId) return;
    const ms = readReceiptMsForPeer(activeOtherId, activeThread);
    if (ms > 0) setPeerReadReceiptMs((prev) => Math.max(prev, ms));
  }, [activeThread, activeOtherId, isCommunityView]);

  const peerTypingMs = firestoreTsMs(activeThread?.typingByUser?.[activeOtherId]);
  const peerTyping =
    !!activeOtherId &&
    !!peerTypingMs &&
    Date.now() - peerTypingMs < 10000;
  const peerTypingAvatarName =
    peerChatProfile.name || (channelId && activeOtherId ? otherNameFor(channelId, activeOtherId) : 'Trader');

  const onMessagesScroll = () => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = dist < CHAT_NEAR_BOTTOM_PX;
    stickToBottomRef.current = near;
    if (near) setNewMessagesBelow(0);
    if (el.scrollTop < 80 && hasMoreOlder && !loadingOlderRef.current && inConversation && isCommunityView) {
      loadOlderMessages();
    }
  };

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlderRef.current || !hasMoreOlder || !messages.length || !chatViewKey || !isCommunityView) return;
    const first = messages[0];
    const before = messageBeforeCursor(first);
    if (!before) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const el = messagesScrollRef.current;
    const prevScrollHeight = el?.scrollHeight || 0;
    try {
      let url;
      if (isCommunityView) {
        url = `/api/chat/community-messages?limit=${CHAT_MESSAGE_PAGE}&before=${encodeURIComponent(before)}`;
      } else if (channelId) {
        url = withChatAsPath(
          `/api/chat/messages?threadId=${encodeURIComponent(channelId)}&limit=${CHAT_MESSAGE_PAGE}&before=${encodeURIComponent(before)}`,
          actingAsUid,
          realUserUid
        );
      } else {
        return;
      }
      const j = await bff(url);
      const older = Array.isArray(j.messages) ? j.messages : [];
      setHasMoreOlder(j.hasMore === true);
      if (!older.length) {
        setHasMoreOlder(false);
        return;
      }
      oldestLoadedRef.current = true;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const prepend = older.filter((m) => !seen.has(m.id));
        if (!prepend.length) return prev;
        const merged = [...prepend, ...prev];
        messagesCacheRef.current[chatViewKey] = merged;
        return merged;
      });
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevScrollHeight;
      });
    } catch (e) {
      console.error('load older messages', e);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [
    hasMoreOlder,
    messages,
    chatViewKey,
    isCommunityView,
    channelId,
    actingAsUid,
    realUserUid
  ]);

  const deleteCommunityMessage = useCallback(
    async (messageId) => {
      if (!messageId || !isPlatformAdmin || !isCommunityView) return;
      if (!window.confirm('Is group message ko delete karna hai? Sabke liye hat jayega.')) return;
      setDeletingCommunityMsgId(messageId);
      setFirestoreErr('');
      try {
        await deleteCommunityChatMessage(messageId);
        setMessages((prev) => {
          const next = prev.filter((m) => m.id !== messageId);
          messagesCacheRef.current[COMMUNITY_CACHE_KEY] = next;
          return next;
        });
        setCommunityReadsByMessage((prev) => {
          if (!prev[messageId]) return prev;
          const next = { ...prev };
          delete next[messageId];
          return next;
        });
        if (openSeenInfoId === messageId) setOpenSeenInfoId(null);
      } catch (e) {
        console.error('delete community message', e);
        setFirestoreErr(e?.message || 'Could not delete message.');
      } finally {
        setDeletingCommunityMsgId('');
      }
    },
    [isPlatformAdmin, isCommunityView, openSeenInfoId]
  );

  useLayoutEffect(() => {
    const el = messagesScrollRef.current;
    if (!inConversation) return;
    if (outPending || peerTyping) {
      if (el) el.scrollTop = el.scrollHeight;
      stickToBottomRef.current = true;
      setNewMessagesBelow(0);
      prevMessagesLenRef.current = messages.length;
      return;
    }
    const len = messages.length;
    const prev = prevMessagesLenRef.current;
    const last = len > 0 ? messages[len - 1] : null;
    if (prev === 0 && len > 0) {
      requestAnimationFrame(() => {
        const sc = messagesScrollRef.current;
        if (sc) sc.scrollTop = sc.scrollHeight;
      });
      stickToBottomRef.current = true;
      setNewMessagesBelow(0);
      prevMessagesLenRef.current = len;
      return;
    }
    if (len > prev && last) {
      const delta = len - prev;
      if (last.fromUid === user?.uid) {
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        stickToBottomRef.current = true;
        setNewMessagesBelow(0);
      } else if (stickToBottomRef.current) {
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        setNewMessagesBelow(0);
      } else {
        setNewMessagesBelow((n) => n + delta);
      }
    }
    prevMessagesLenRef.current = len;
  }, [messages, channelId, user?.uid, outPending, peerTyping, activeOtherId, inConversation]);

  const onPickChatMedia = async (e) => {
    const file = e.target.files?.[0];
    try {
      e.target.value = '';
    } catch {
      /* ignore */
    }
    if (!file || !user?.uid || !chatViewKey) return;
    if (!isCommunityView && !activeOtherId) return;
    if (file.size > CHAT_IMAGE_MAX_BYTES) {
      setFirestoreErr('File must be under 8 MB.');
      return;
    }
    const isImage = (file.type || '').startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(file.name || '');
    setFirestoreErr('');
    setUploadBusy(true);
    try {
      if (isBffChatMode()) {
        const fileToSend = isImage ? await compressImageForChat(file) : file;
        const uploaded = await uploadMedia({
          kind: 'chat',
          file: fileToSend,
          threadId: chatViewKey,
          asUid: showcaseChatAsUid(actingAsUid, realUserUid) || undefined
        });
        setPendingFile(null);
        setPendingImageUrl('');
        if (uploaded.mediaKind === 'image') setPendingImageUrl(uploaded.url);
        else setPendingFile({ url: uploaded.url, fileName: uploaded.fileName });
      } else {
        if (!isImage) {
          setFirestoreErr('Only images are supported in legacy chat mode.');
          return;
        }
        const safe = String(file.name || 'photo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
        const path = `chat-media/${user.uid}/${channelId}/${Date.now()}_${safe}`;
        const ref = storageRef(storage, path);
        await uploadBytes(ref, file, { contentType: file.type || 'image/jpeg' });
        const url = await getDownloadURL(ref);
        setPendingFile(null);
        setPendingImageUrl(url);
      }
    } catch (err) {
      console.error(err);
      setFirestoreErr(err?.message || 'Could not upload file.');
    } finally {
      setUploadBusy(false);
    }
  };

  const sendMessage = async () => {
    const text = draft.trim();
    const imageUrl = pendingImageUrl.trim();
    const fileUrl = pendingFile?.url?.trim() || '';
    const fileName = pendingFile?.fileName || '';
    const mediaKind = imageUrl ? 'image' : fileUrl ? 'file' : '';
    if ((!text && !imageUrl && !fileUrl) || !user || !chatViewKey) return;
    if (!isCommunityView && !activeOtherId) return;
    setSending(true);
    const replySnap = replyTo
      ? {
          messageId: replyTo.id,
          fromUid: replyTo.fromUid,
          fromName: replyTo.fromName,
          textPreview: (replyTo.text || '').slice(0, 240)
        }
      : null;
    let threadPreview = text.slice(0, 120);
    if (imageUrl) threadPreview = text ? text.slice(0, 100) : '📷 Photo';
    else if (fileUrl) threadPreview = text ? text.slice(0, 100) : fileName ? `📎 ${fileName.slice(0, 40)}` : '📎 File';
    const pendingLabel = imageUrl ? '📷 Photo' : fileUrl ? (fileName ? `📎 ${fileName}` : '📎 File') : '';
    setOutPending({
      text: text || pendingLabel,
      imageUrl: imageUrl || '',
      fileUrl,
      fileName,
      mediaKind,
      replyTo: replySnap
    });
    try {
      const fromName = userData?.name || user.email?.split('@')[0] || 'Trader';
      if (isBffChatMode()) {
        if (isCommunityView) {
          const result = await bff('/api/chat/community-send', {
            method: 'POST',
            body: JSON.stringify(
              withChatAsBody(
                { text, imageUrl, fileUrl, fileName, mediaKind, fromName },
                actingAsUid,
                realUserUid
              )
            )
          });
          if (result?.message) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === result.message.id)) return prev;
              const next = [...prev, result.message];
              messagesCacheRef.current[COMMUNITY_CACHE_KEY] = next;
              return next;
            });
            const senderName = userData?.name || user?.email?.split('@')[0] || 'Trader';
            setCommunityReadsByMessage((prev) => ({
              ...prev,
              [result.message.id]: [{ uid: user.uid, fromName: senderName }]
            }));
          } else {
            reloadMessagesRef.current?.();
          }
          setReplyTo(null);
          setOutPending(null);
          setDraft('');
          setPendingImageUrl('');
          setPendingFile(null);
          setSending(false);
          return;
        }
        const result = await bff('/api/chat/send', {
          method: 'POST',
          body: JSON.stringify(
            withChatAsBody(
              {
                threadId: channelId,
                text,
                imageUrl,
                fileUrl,
                fileName,
                mediaKind,
                activeOtherId,
                fromName,
                replyTo: replySnap,
                peerShowcaseName: activeOtherId.startsWith('showcase__')
                  ? otherNameFor(channelId, activeOtherId)
                  : ''
              },
              actingAsUid,
              realUserUid
            )
          )
        });
        if (result?.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === result.message.id)) return prev;
            const next = [...prev, result.message];
            if (chatViewKey) messagesCacheRef.current[chatViewKey] = next;
            return next;
          });
        } else {
          reloadMessagesRef.current?.();
        }
        setReplyTo(null);
        setOutPending(null);
        setDraft('');
        setPendingImageUrl('');
        setPendingFile(null);
        const readUid = readerUidForUnread || user.uid;
        patchDmThreadUnread?.(channelId, readUid, 0);
        if (result?.thread) mergeDmThread?.(result.thread);
        else refreshDmThreads?.();
      } else {
        await addDoc(collection(db, 'dmThreads', channelId, 'messages'), {
          fromUid: user.uid,
          fromName,
          text: text || '',
          ...(imageUrl ? { imageUrl } : {}),
          createdAt: serverTimestamp(),
          ...(replySnap ? { replyTo: replySnap } : {})
        });
        setReplyTo(null);
        setOutPending(null);
        await updateDoc(doc(db, 'dmThreads', channelId), {
          lastPreview: threadPreview,
          lastFromName: fromName,
          updatedAt: serverTimestamp(),
          [`unreadByUser.${activeOtherId}`]: increment(1)
        });
        if (activeOtherId.startsWith('showcase__')) {
          const peerShowcaseName = otherNameFor(channelId, activeOtherId);
          try {
            await addDoc(collection(db, 'adminChatLogs'), {
              threadId: channelId,
              fromUid: user.uid,
              fromName,
              peerShowcaseId: activeOtherId,
              peerShowcaseName,
              text: text || (imageUrl ? '[Photo]' : ''),
              imageUrl: imageUrl || '',
              createdAt: serverTimestamp()
            });
          } catch (e) {
            console.error('adminChatLogs', e);
          }
        }
        setDraft('');
        setPendingImageUrl('');
      }
    } catch (e) {
      console.error(e);
      setOutPending(null);
      if (e?.code === 'permission-denied' || (e?.message || '').toLowerCase().includes('permission')) {
        setFirestoreErr('Message sending was blocked by Firestore rules. Please retry after rules are deployed.');
      } else {
        setFirestoreErr(e?.message || 'Could not send message.');
      }
    } finally {
      setSending(false);
    }
  };

  if (authLoading) return <PageLoader label="Loading chat…" />;
  if (!user) return null;

  return (
    <div
      className="chat-page-shell"
      style={{
        display: 'flex',
        flexDirection: 'row',
        maxWidth: 1280,
        margin: '0 auto',
        width: '100%',
        flex: 1,
        minHeight: 0,
        padding: narrow ? '0 0 max(12px, env(safe-area-inset-bottom))' : '16px 20px 28px',
        gap: narrow ? 0 : 10,
        boxSizing: 'border-box',
        position: 'relative'
      }}
    >
      {showThreadList ? (
      <aside
        className="chat-thread-list"
        style={{
          width: narrow ? '100%' : 320,
          maxWidth: narrow ? '100%' : 320,
          flexShrink: 0,
          borderRight: narrow ? 'none' : `1px solid ${T.border}`,
          paddingRight: narrow ? 0 : 8,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          flex: narrow ? 1 : undefined,
          border: narrow ? 'none' : `1px solid rgba(255,255,255,0.06)`,
          borderRadius: narrow ? 0 : 14,
          background: narrow ? WA_PANEL : WA_PANEL,
          paddingLeft: narrow ? 12 : 8,
          paddingTop: narrow ? 10 : 8,
          paddingBottom: narrow ? 10 : 8,
          position: 'relative'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            margin: '0 0 10px',
            paddingBottom: 10,
            borderBottom: `1px solid rgba(255,255,255,0.08)`
          }}
        >
          <h2 style={{ color: '#e9edef', margin: 0, fontSize: narrow ? 20 : 18, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Chats
          </h2>
          <Link
            to="/leaderboard"
            title="New chat"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: WA_GREEN,
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              textDecoration: 'none',
              fontSize: 22,
              fontWeight: 300,
              lineHeight: 1,
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
            }}
          >
            +
          </Link>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 8px 12px',
            marginBottom: 10,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          <LeaderboardRowAvatar photoURL={myPhotoURL} name={myDisplayName} size={narrow ? 48 : 44} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                color: WA_GREEN,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 2
              }}
            >
              You
            </div>
            <div
              style={{
                color: '#e9edef',
                fontWeight: 800,
                fontSize: 16,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {myDisplayName}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 34px', gap: 6, marginBottom: 8 }}>
          <input
            value={threadSearch}
            onChange={(e) => setThreadSearch(e.target.value)}
            placeholder="Search or start new chat"
            style={{
              width: '100%',
              borderRadius: 8,
              border: 'none',
              background: WA_PANEL_2,
              color: '#e9edef',
              fontSize: 13,
              padding: '9px 12px'
            }}
          />
          <button type="button" style={{ borderRadius: 8, border: 'none', background: WA_PANEL_2, color: '#8696a0' }}>
            ⌕
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            ['all', 'All'],
            ['followers', 'Followers'],
            ['following', 'Following']
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setThreadTab(k)}
              style={{
                border: 'none',
                background: 'transparent',
                color: threadTab === k ? T.yellow : T.text,
                fontSize: 12,
                fontWeight: threadTab === k ? 800 : 600,
                paddingBottom: 6,
                borderBottom: threadTab === k ? `2px solid ${T.yellow}` : '2px solid transparent'
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {totalChatUnread > 0 ? (
          <div
            role="status"
            style={{
              marginBottom: 10,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'linear-gradient(90deg, rgba(0,168,132,0.22), rgba(0,168,132,0.08))',
              border: '1px solid rgba(0,168,132,0.45)',
              color: '#e8fff8',
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.35
            }}
          >
            {totalChatUnread === 1
              ? '1 new unread message'
              : `${totalChatUnread} new unread messages`}{' '}
            <span style={{ fontWeight: 600, opacity: 0.9 }}>
              — {communityUnread > 0 ? 'check Aurox trade Community' : 'open a chat below'}
            </span>
          </div>
        ) : null}
        <div
          className="chat-thread-scroll"
          style={{
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            flex: 1,
            minHeight: 0,
            border: narrow ? 'none' : `1px solid rgba(167,139,250,0.22)`,
            borderRadius: narrow ? 0 : 12,
            background: narrow ? 'transparent' : `linear-gradient(180deg, ${T.card} 0%, #181c22 100%)`,
            boxShadow: narrow ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.04)'
          }}
        >
          <button
            type="button"
            className="chat-community-row"
            onClick={pickCommunity}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '12px 10px',
              border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: isCommunityView ? 'rgba(0,168,132,0.18)' : 'rgba(0,168,132,0.08)',
              color: '#e9edef',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              position: 'relative'
            }}
          >
            <CommunityLogo size={narrow ? 48 : 44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span
                  style={{
                    fontWeight: communityUnread > 0 ? 800 : 700,
                    fontSize: 16,
                    color: '#e9edef',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {COMMUNITY_NAME}
                </span>
                {communityUnread > 0 ? (
                  <span
                    title={`${communityUnread} unread`}
                    style={{
                      minWidth: 20,
                      height: 20,
                      padding: '0 6px',
                      borderRadius: 999,
                      background: WA_GREEN,
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 900,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {communityUnread > 99 ? '99+' : communityUnread}
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: communityUnread > 0 ? '#d1e8e2' : '#8696a0',
                  marginTop: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: communityUnread > 0 ? 600 : 400
                }}
              >
                {communityPreviewLine}
              </div>
            </div>
          </button>
          {listThreads.length === 0 ? (
            <div style={{ color: T.text, fontSize: 13, padding: 16, lineHeight: 1.5 }}>
              {threadTab === 'all' && !threadSearch.trim()
                ? 'No conversations yet — open Leaderboard and tap Chat on someone.'
                : 'No chats match this filter or search.'}
            </div>
          ) : (
            listThreads.map((t) => {
                const otherUid = (t.participants || []).find((p) => p !== user.uid);
                if (!otherUid) return null;
                const active = otherUid === activeOtherId;
                const unreadN = effectiveUnreadForUid(t, user.uid);
                const { name: rowName, photoURL: rowPhoto, isPaidMember: rowPaid } = peerMeta(otherUid, t.id);
                const threadTime = formatThreadListTime(t.updatedAt);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pickThread(otherUid)}
                    className="chat-thread-row"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 10px',
                      border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                      color: '#e9edef',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                  >
                    <LeaderboardRowAvatar
                      key={`${otherUid}-${rowPhoto}`}
                      photoURL={rowPhoto}
                      name={rowName}
                      size={narrow ? 48 : 44}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span
                          style={{
                            fontWeight: unreadN > 0 ? 800 : 600,
                            fontSize: 16,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: '#e9edef'
                          }}
                        >
                          {rowName}
                          {rowPaid ? <PaidMemberBadge size={13} /> : null}
                          {rowPaid && peerPresence?.[otherUid]?.paidPlanType ? (
                            <PlanTierChip planType={peerPresence[otherUid].paidPlanType} />
                          ) : null}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {threadTime ? (
                            <span
                              style={{
                                fontSize: 11,
                                color: unreadN > 0 ? WA_GREEN : '#8696a0',
                                fontWeight: unreadN > 0 ? 700 : 500
                              }}
                            >
                              {threadTime}
                            </span>
                          ) : null}
                          {unreadN > 0 && (
                            <span
                              title={`${unreadN} unread`}
                              style={{
                                minWidth: 20,
                                height: 20,
                                padding: '0 6px',
                                borderRadius: 999,
                                background: WA_GREEN,
                                color: '#fff',
                                fontSize: 11,
                                fontWeight: 900,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {unreadN > 9 ? '9+' : unreadN}
                            </span>
                          )}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: unreadN > 0 ? '#e9edef' : '#8696a0',
                          fontWeight: unreadN > 0 ? 600 : 400,
                          marginTop: 4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {t.lastFromName && t.lastFromName !== rowName ? `${t.lastFromName}: ` : ''}
                        {t.lastPreview || 'Tap to chat'}
                      </div>
                    </div>
                  </button>
                );
              })
          )}
        </div>
      </aside>
      ) : null}

      {showChatPane ? (
      <main
        className="chat-main-pane"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          border: narrow ? 'none' : `1px solid rgba(255,255,255,0.06)`,
          borderRadius: narrow ? 0 : 0,
          overflow: 'hidden',
          background: narrow ? '#0b141a' : '#0b141a'
        }}
      >
        <div
          style={{
            padding: narrow ? '8px 10px 10px' : '12px 14px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
            background: WA_HEADER
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {narrow && inConversation ? (
              <button
                type="button"
                onClick={backToChatList}
                aria-label="Back to chats"
                style={{
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: 'none',
                  background: 'rgba(255,255,255,0.06)',
                  color: T.yellow,
                  fontSize: 22,
                  lineHeight: 1,
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  padding: 0
                }}
              >
                ‹
              </button>
            ) : null}
            {isCommunityView ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flex: 1,
                  minWidth: 0,
                  flexWrap: 'wrap'
                }}
              >
                <CommunityLogo size={44} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: T.white, fontWeight: 800, fontSize: narrow ? 17 : 18 }}>
                    {COMMUNITY_NAME}
                  </div>
                  <div style={{ fontSize: 12, color: '#8696a0', marginTop: 2 }}>All traders · group chat</div>
                </div>
                <Link
                  to="/wallet"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flexShrink: 0,
                    textDecoration: 'none',
                    padding: '8px 14px',
                    borderRadius: 999,
                    background: `linear-gradient(135deg, ${T.yellow}, #d9a700)`,
                    color: '#000',
                    fontWeight: 800,
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 10px rgba(240,185,11,0.35)'
                  }}
                >
                  Get subscription
                </Link>
              </div>
            ) : activeOtherId ? (
              <Link
                to={`/profile/${encodeURIComponent(activeOtherId)}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flex: 1,
                  minWidth: 0,
                  textDecoration: 'none',
                  color: 'inherit'
                }}
              >
                <LeaderboardRowAvatar
                  key={`hdr-${activeOtherId}-${peerChatProfile.photoURL}`}
                  photoURL={peerChatProfile.photoURL}
                  name={activePeerDisplayName}
                  size={narrow ? 44 : 42}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        color: T.white,
                        fontWeight: 800,
                        fontSize: narrow ? 17 : 18,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {activePeerDisplayName}
                      {activePeerIsPaid ? <PaidMemberBadge size={14} /> : null}
                      {peerChatProfile.paidPlanType || peerPresence?.[activeOtherId]?.paidPlanType ? (
                        <PlanTierChip
                          planType={peerChatProfile.paidPlanType || peerPresence?.[activeOtherId]?.paidPlanType}
                        />
                      ) : null}
                    </span>
                    <span
                      title={activePresence.online ? 'Online' : 'Offline'}
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        background: activePresence.online ? T.green : T.text,
                        flexShrink: 0
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: '#8696a0', marginTop: 2 }}>
                    {activePresence.online ? 'online' : activePresence.label}
                  </div>
                </div>
              </Link>
            ) : (
              <div style={{ color: T.text, fontSize: 15, fontWeight: 600, padding: '8px 4px' }}>
                {narrow ? '' : 'Select a conversation'}
              </div>
            )}
          </div>
          {bootErr && <div style={{ color: T.red, fontSize: 12, marginTop: 6 }}>{bootErr}</div>}
          {firestoreErr && !bootErr && (
            <div style={{ color: T.red, fontSize: 12, marginTop: 6 }}>{firestoreErr}</div>
          )}
        </div>

        <div
          ref={messagesScrollRef}
          onScroll={onMessagesScroll}
          className="chat-messages-pane"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '8px 6px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            background: '#0b141a'
          }}
        >
          {!inConversation && (
            <div style={{ color: T.text, fontSize: 13, padding: 12, lineHeight: 1.55 }}>
              Select a conversation from the list, open{' '}
              <strong style={{ color: T.white }}>{COMMUNITY_NAME}</strong>, or open{' '}
              <Link to="/leaderboard" style={{ color: T.yellow, fontWeight: 700 }}>
                Leaderboard
              </Link>{' '}
              and tap <strong style={{ color: T.white }}>Chat</strong>.
            </div>
          )}
          {inConversation && isCommunityView && hasMoreOlder ? (
            <button
              type="button"
              onClick={loadOlderMessages}
              disabled={loadingOlder}
              style={{
                alignSelf: 'center',
                margin: '4px 0 8px',
                padding: '8px 16px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: '#e9edef',
                fontWeight: 700,
                fontSize: 12,
                cursor: loadingOlder ? 'wait' : 'pointer'
              }}
            >
              {loadingOlder ? 'Loading earlier messages…' : 'Load earlier messages'}
            </button>
          ) : null}
          {inConversation &&
            messages.flatMap((m, msgIdx) => {
              const prevM = msgIdx > 0 ? messages[msgIdx - 1] : null;
              const createdMs = firestoreTsMs(m.createdAt);
              const prevMs = prevM ? firestoreTsMs(prevM.createdAt) : 0;
              const dayKey = createdMs ? new Date(createdMs).toDateString() : '';
              const prevDayKey = prevMs ? new Date(prevMs).toDateString() : '';
              const showDayChip = Boolean(dayKey && dayKey !== prevDayKey);

              const mine = m.fromUid === (readerUidForUnread || user.uid);
              const receiptMs = otherLastSeenMs;
              const seen =
                !isCommunityView &&
                mine &&
                receiptMs > 0 &&
                createdMs > 0 &&
                receiptMs + 500 >= createdMs;
              const rt = m.replyTo;
              const preview = rt?.textPreview || rt?.text || '';
              const quotedId = rt?.messageId;
              const seenByViewers = isCommunityView
                ? seenByForMessage(m, {
                    thread: activeThread,
                    userUid: user.uid,
                    myDisplayName,
                    peerPresence,
                    communityReadsByMessage,
                    isCommunity: true
                  })
                : [];
              const communityProf = communityProfiles[m.fromUid] || {};
              const communitySenderName = displayTraderName({
                name: m.fromName || communityProf.name,
                accountRemoved: communityProf.accountRemoved
              });
              const prevFromSameSender = prevM && prevM.fromUid === m.fromUid;
              const showSenderMeta = isCommunityView && !mine && !prevFromSameSender;
              const bubbleBody = (
                <div
                  ref={(el) => {
                    if (el) messageRowRefs.current[m.id] = el;
                    else delete messageRowRefs.current[m.id];
                  }}
                  role="article"
                  className={`chat-msg-line ${mine ? 'chat-msg-line--out' : 'chat-msg-line--in'}`}
                  onTouchStart={(e) => {
                    if (isCommunityView || e.touches.length !== 1) return;
                    const t = e.touches[0];
                    swipeReplyStartRef.current = { x: t.clientX, y: t.clientY };
                  }}
                  onTouchEnd={(e) => {
                    if (isCommunityView) return;
                    const start = swipeReplyStartRef.current;
                    swipeReplyStartRef.current = null;
                    if (!start || !activeOtherId) return;
                    const t = e.changedTouches[0];
                    const dx = t.clientX - start.x;
                    const dy = Math.abs(t.clientY - start.y);
                    if (dx > 52 && dy < 45) {
                      setReplyTo({
                        id: m.id,
                        fromUid: m.fromUid,
                        fromName: m.fromName || 'Trader',
                        text: messagePreviewLine(m)
                      });
                    }
                  }}
                >
                  {preview && !isCommunityView ? (
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        scrollToMessageId(quotedId);
                      }}
                      disabled={!quotedId}
                      title={quotedId ? 'Original message (tap)' : undefined}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        cursor: quotedId ? 'pointer' : 'default',
                        borderLeft: `3px solid ${mine ? 'rgba(90,60,20,0.55)' : '#53bdeb'}`,
                        paddingLeft: 8,
                        marginBottom: 8,
                        opacity: 0.95,
                        maxHeight: 72,
                        overflow: 'hidden',
                        background: mine ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.18)',
                        borderTop: 'none',
                        borderRight: 'none',
                        borderBottom: 'none',
                        borderRadius: '0 8px 8px 0',
                        paddingTop: 6,
                        paddingBottom: 6,
                        paddingRight: 6
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9,
                          color: mine ? 'rgba(26,18,8,0.65)' : '#53bdeb',
                          fontWeight: 700
                        }}
                      >
                        {rt.fromName || 'Trader'}
                      </div>
                      <div
                        className="chat-msg-body-text"
                        style={{
                          fontSize: 12,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {preview}
                      </div>
                    </button>
                  ) : null}
                  {m.fileUrl && m.mediaKind === 'file' ? (
                    <a
                      href={m.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={m.fileName || true}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: m.text ? 6 : 0,
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: mine ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.25)',
                        color: mine ? '#1a1208' : T.yellow,
                        fontWeight: 700,
                        fontSize: 13,
                        textDecoration: 'none'
                      }}
                    >
                      📎 {m.fileName || 'Download file'}
                    </a>
                  ) : null}
                  {m.imageUrl ? (
                    <a
                      href={m.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'block' }}
                    >
                      <img
                        src={m.imageUrl}
                        alt=""
                        loading="lazy"
                        style={{
                          maxWidth: '100%',
                          maxHeight: 280,
                          borderRadius: 8,
                          display: 'block',
                          objectFit: 'cover'
                        }}
                      />
                    </a>
                  ) : null}
                  {m.text ? (
                    <div
                      className={`chat-msg-body-text${m.imageUrl || m.fileUrl ? ' chat-msg-media-caption' : ''}`}
                    >
                      {m.text}
                    </div>
                  ) : null}
                  <div className="chat-msg-footer">
                    <span className="chat-msg-time">{formatMsgTime(m.createdAt)}</span>
                    {isCommunityView ? (
                      <MsgSeenInfo
                        viewers={seenByViewers}
                        open={openSeenInfoId === m.id}
                        onToggle={() => setOpenSeenInfoId((id) => (id === m.id ? null : m.id))}
                        onLight={mine}
                      />
                    ) : null}
                    {mine && !isCommunityView ? (
                      <MsgDeliveryTicks pending={false} read={seen} onLight={mine} />
                    ) : null}
                  </div>
                </div>
              );
              const bubble = mine ? (
                <div key={m.id} className="chat-msg-row-out">
                  {bubbleBody}
                </div>
              ) : (
                <div
                  key={m.id}
                  className={`chat-incoming-row${isCommunityView ? ' chat-community-incoming' : ''}`}
                >
                  {showSenderMeta ? (
                    <LeaderboardRowAvatar
                      photoURL={communityProf.photoURL}
                      name={communitySenderName}
                      size={34}
                    />
                  ) : isCommunityView ? (
                    <span style={{ width: 34, flexShrink: 0 }} aria-hidden />
                  ) : null}
                  <div className="chat-incoming-col">
                    {showSenderMeta ? (
                      <div className="chat-community-sender-name" style={{ display: 'flex', alignItems: 'center' }}>
                        {communitySenderName}
                        {communityProf.isPaidMember ? <PaidMemberBadge size={12} /> : null}
                        {communityProf.paidPlanType ? <PlanTierChip planType={communityProf.paidPlanType} /> : null}
                      </div>
                    ) : null}
                    {bubbleBody}
                  </div>
                </div>
              );
              const displayed =
                isCommunityView && isPlatformAdmin ? (
                  <div
                    key={m.id}
                    className={`chat-community-admin-row${mine ? ' chat-community-admin-row--out' : ''}`}
                  >
                    {bubble}
                    <button
                      type="button"
                      className="chat-community-delete-btn"
                      title="Delete message (admin)"
                      aria-label="Delete message"
                      disabled={deletingCommunityMsgId === m.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCommunityMessage(m.id);
                      }}
                    >
                      {deletingCommunityMsgId === m.id ? '…' : '×'}
                    </button>
                  </div>
                ) : (
                  bubble
                );
              const dayChip = showDayChip ? (
                <div
                  key={`day-${m.id}-${dayKey}`}
                  style={{
                    alignSelf: 'center',
                    margin: '10px 0 6px',
                    padding: '5px 12px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.08)',
                    color: T.text,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.02em'
                  }}
                >
                  {formatChatDayLabel(createdMs)}
                </div>
              ) : null;
              return dayChip ? [dayChip, displayed] : [displayed];
            })}
          {peerTyping && activeOtherId && (
            <div
              className="chat-typing-row-snap"
              style={{
                alignSelf: 'flex-start',
                display: 'flex',
                alignItems: 'flex-end',
                gap: 6,
                paddingLeft: 2,
                paddingBottom: 2
              }}
            >
              <div className="chat-typing-avatar-wrap" title={`${peerTypingAvatarName} is typing…`}>
                <LeaderboardRowAvatar
                  key={`typing-${activeOtherId}-${peerChatProfile.photoURL}`}
                  photoURL={peerChatProfile.photoURL}
                  name={peerTypingAvatarName}
                  size={40}
                />
              </div>
              <TypingBubble />
            </div>
          )}
          {outPending && inConversation && (
            <div className="chat-msg-row-out" style={{ alignSelf: 'flex-end' }}>
              <div className="chat-msg-line chat-msg-line--out" style={{ opacity: 0.92 }}>
                {outPending.replyTo?.textPreview ? (
                  <div
                    style={{
                      borderLeft: '3px solid rgba(90,60,20,0.55)',
                      paddingLeft: 8,
                      marginBottom: 6,
                      opacity: 0.95
                    }}
                  >
                    <div style={{ fontSize: 9, color: 'rgba(26,18,8,0.65)', fontWeight: 700 }}>
                      {outPending.replyTo.fromName || 'Trader'}
                    </div>
                    <div className="chat-msg-body-text" style={{ fontSize: 12 }}>
                      {outPending.replyTo.textPreview}
                    </div>
                  </div>
                ) : null}
                {outPending.imageUrl ? (
                  <img
                    src={outPending.imageUrl}
                    alt=""
                    style={{
                      maxWidth: '100%',
                      maxHeight: 200,
                      borderRadius: 8,
                      display: 'block',
                      objectFit: 'cover'
                    }}
                  />
                ) : null}
                {outPending.text && outPending.text !== '📷 Photo' ? (
                  <div
                    className={`chat-msg-body-text${outPending.imageUrl ? ' chat-msg-media-caption' : ''}`}
                  >
                    {outPending.text}
                  </div>
                ) : null}
                <div className="chat-msg-footer">
                  <span className="chat-msg-time">now</span>
                  <MsgDeliveryTicks pending read={false} onLight />
                </div>
              </div>
            </div>
          )}
          {newMessagesBelow > 0 && inConversation ? (
            <button
              type="button"
              onClick={() => {
                const sc = messagesScrollRef.current;
                if (sc) sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' });
                stickToBottomRef.current = true;
                setNewMessagesBelow(0);
              }}
              style={{
                alignSelf: 'center',
                position: 'sticky',
                bottom: 8,
                zIndex: 5,
                marginTop: 4,
                padding: '9px 18px',
                borderRadius: 999,
                border: 'none',
                background: 'linear-gradient(180deg, #00c896, #00a884)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(0,0,0,0.35)'
              }}
            >
              ↓ {newMessagesBelow} new message{newMessagesBelow !== 1 ? 's' : ''}
            </button>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        <div
          style={{
            marginTop: 'auto',
            padding: '8px 10px 10px',
            paddingBottom: narrow ? 'max(8px, env(safe-area-inset-bottom))' : 10,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            background: WA_HEADER,
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          {replyTo && inConversation && !isCommunityView ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'stretch',
                gap: 10,
                padding: '10px 12px',
                marginBottom: 8,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${T.border}`
              }}
            >
              <div
                style={{
                  width: 3,
                  borderRadius: 2,
                  background: T.yellow,
                  flexShrink: 0
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: T.yellow, fontWeight: 800, marginBottom: 4 }}>
                  Replying to {replyTo.fromName}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: T.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {replyTo.text}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label="Cancel reply"
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: T.card2,
                  color: T.white,
                  fontSize: 16,
                  lineHeight: 1,
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                ×
              </button>
            </div>
          ) : null}
          <input
            ref={chatImageInputRef}
            type="file"
            accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx"
            style={{ display: 'none' }}
            onChange={onPickChatMedia}
          />
          {pendingFile ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 8,
                padding: 8,
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                background: T.card2
              }}
            >
              <span style={{ fontSize: 22 }}>📎</span>
              <span style={{ fontSize: 12, color: T.text, flex: 1 }}>
                {pendingFile.fileName || 'File'} ready — add a caption (optional) and Send.
              </span>
              <button
                type="button"
                onClick={() => setPendingFile(null)}
                style={{
                  border: `1px solid ${T.border}`,
                  background: T.card,
                  color: T.white,
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Remove
              </button>
            </div>
          ) : null}
          {pendingImageUrl ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 8,
                padding: 8,
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                background: T.card2
              }}
            >
              <img
                src={pendingImageUrl}
                alt=""
                style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover' }}
              />
              <span style={{ fontSize: 12, color: T.text, flex: 1 }}>Photo ready — add a caption (optional) and Send.</span>
              <button
                type="button"
                onClick={() => setPendingImageUrl('')}
                style={{
                  border: `1px solid ${T.border}`,
                  background: T.card,
                  color: T.white,
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Remove
              </button>
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <button
            type="button"
            title="Attach photo or file"
            aria-label="Attach photo or file"
            disabled={!canCompose}
            onClick={() => chatImageInputRef.current?.click()}
            style={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: 'none',
              background: WA_PANEL_2,
              color: '#8696a0',
              fontSize: 20,
              lineHeight: 1,
              cursor: canCompose ? 'pointer' : 'not-allowed',
              opacity: inConversation ? 1 : 0.45
            }}
          >
            {uploadBusy ? '…' : '📎'}
          </button>
          <Input
            placeholder={
              isCommunityView
                ? `Message ${COMMUNITY_NAME}`
                : activeOtherId
                  ? 'Type a message'
                  : 'Pick a chat first'
            }
            value={draft}
            disabled={!inConversation}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: 24,
              border: 'none',
              background: WA_PANEL,
              color: '#e9edef',
              padding: '12px 16px'
            }}
          />
          <Btn
            onClick={sendMessage}
            disabled={
              sending ||
              !inConversation ||
              (!draft.trim() && !pendingImageUrl && !pendingFile) ||
              uploadBusy
            }
            style={{
              width: 44,
              height: 44,
              minWidth: 44,
              flexShrink: 0,
              background: WA_GREEN,
              color: '#fff',
              borderRadius: '50%',
              fontWeight: 900,
              padding: 0,
              display: 'grid',
              placeItems: 'center'
            }}
          >
            {sending ? '…' : '➤'}
          </Btn>
          </div>
        </div>
      </main>
      ) : null}
    </div>
  );
};
