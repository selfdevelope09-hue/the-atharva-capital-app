import React, { useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  arrayUnion,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  deleteField
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebaseClient';
import { AuthContext } from '../authContext';
import { bff } from '../api/serverBff';
import {
  fetchAdminEditors,
  fetchShowcaseRows,
  syncShowcaseFromFirestore,
  createShowcaseRow,
  updateShowcaseRow,
  deleteShowcaseRow,
  setShowcasePresence,
  bulkSetShowcasePresence,
  showcaseFollow,
  exportShowcasePack,
  importShowcaseRows,
  rebuildShowcaseTrades,
  finalizeLeaderboardCampaign,
  syncLeaderboardWinners,
  appendShowcasePnl,
  fetchChatLogs,
  fetchTipQueries,
  setUserAppLogin,
  runMonthlyReset,
  adjustFollowers
} from '../api/adminDevApi';
import { searchIndianStocks } from './stockApi';
import { TIP_CATEGORIES } from './categories';
import { mergeTipEditorFallbackUids, extraTipEditorUidsFromEnv } from './tipEditorUid';
import { buildSyntheticClosedPositions } from './showcaseSyntheticTrades';
import { uploadProfilePhoto, formatProfilePhotoUploadError } from '../profilePhotoUpload';
import { clearLeaderboardClientCacheAndNotify, notifyLeaderboardBackgroundRefresh } from '../utils/leaderboardClientCache';
import { isFirestoreDisabled } from '../config/dataBackend';
import { PLAN_CATALOG, PLAN_ORDER, getPlanAdminLabel } from '../config/paidPlan';

/** If `config/stockTipEditors` is missing in Firestore, default rules may allow any signed-in user to post. */
const STOCK_TIP_BOOTSTRAP_EDITORS = '__STOCK_TIP_BOOTSTRAP__';

function sortShowcaseRows(rows) {
  return [...rows].sort((a, b) => (Number(b.pnl) || 0) - (Number(a.pnl) || 0));
}

function mergeShowcaseRowInList(prev, updatedRow) {
  if (!updatedRow?.id) return prev;
  const exists = prev.some((r) => r.id === updatedRow.id);
  const next = exists
    ? prev.map((r) => (r.id === updatedRow.id ? { ...r, ...updatedRow } : r))
    : [...prev, updatedRow];
  return sortShowcaseRows(next);
}

function tsToBackup(v) {
  if (v == null) return null;
  if (typeof v.toMillis === 'function') {
    const ms = v.toMillis();
    return Number.isFinite(ms) ? { __ts: ms } : null;
  }
  if (typeof v.seconds === 'number') {
    return { __ts: v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6) };
  }
  return null;
}

function tsFromBackup(v) {
  if (v && typeof v.__ts === 'number' && Number.isFinite(v.__ts)) return Timestamp.fromMillis(v.__ts);
  return null;
}

function pickUserSubsetForShowcaseBackup(data) {
  if (!data || typeof data !== 'object') return null;
  const keys = [
    'photoURL',
    'bio',
    'followers',
    'following',
    'closedPositions',
    'lifetimeRealizedPnl',
    'virtualBalance',
    'showcaseTradeCount',
    'portfolio',
    'watchlist'
  ];
  const o = {};
  keys.forEach((k) => {
    if (data[k] !== undefined) o[k] = data[k];
  });
  if (data.showcasePresenceOnline !== undefined) o.showcasePresenceOnline = data.showcasePresenceOnline;
  o.showcasePresenceOfflineAt = tsToBackup(data.showcasePresenceOfflineAt);
  return o;
}

const T = {
  card: '#1e2329',
  card2: '#2b3139',
  yellow: '#f0b90b',
  green: '#02c076',
  red: '#f6465d',
  text: '#848e9c',
  white: '#ffffff',
  border: '#2b2f36',
  purple: '#a78bfa'
};

async function loadEditorUids() {
  try {
    return await fetchAdminEditors();
  } catch {
    const fromEnv = extraTipEditorUidsFromEnv();
    return fromEnv.length ? mergeTipEditorFallbackUids([]) : [STOCK_TIP_BOOTSTRAP_EDITORS];
  }
}

export default function DeveloperStockTipsPanel() {
  const navigate = useNavigate();
  const { user, realUserUid, refreshUser } = useContext(AuthContext);
  const operatorUid = realUserUid || user?.uid || '';
  const [editors, setEditors] = useState(null);
  const [tab, setTab] = useState('add');
  const [section, setSection] = useState('1day');
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [entry, setEntry] = useState('');
  const [target, setTarget] = useState('');
  const [sl, setSl] = useState('');
  const [risk, setRisk] = useState('Medium');
  const [desc, setDesc] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [chartImageUrl, setChartImageUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [queries, setQueries] = useState([]);
  const [lbRows, setLbRows] = useState([]);
  const [lbName, setLbName] = useState('');
  const [lbPnl, setLbPnl] = useState('');
  const [lbTradeCount, setLbTradeCount] = useState('12');
  const [lbBio, setLbBio] = useState('');
  const [lbPhotoFile, setLbPhotoFile] = useState(null);
  const [lbBusy, setLbBusy] = useState(false);
  const [lbRowBusyId, setLbRowBusyId] = useState('');
  const [lbMsg, setLbMsg] = useState('');
  const [lbEdit, setLbEdit] = useState(null);
  const [lbShowcasePhotoFile, setLbShowcasePhotoFile] = useState(null);
  const [pnlAdjustRowId, setPnlAdjustRowId] = useState(null);
  const [pnlAdjustAmount, setPnlAdjustAmount] = useState('');
  const [bulkPresenceCount, setBulkPresenceCount] = useState('5');
  const [lbShowcaseSearch, setLbShowcaseSearch] = useState('');
  const [chatLogs, setChatLogs] = useState([]);
  const [learnRows, setLearnRows] = useState([]);
  const [learnTitle, setLearnTitle] = useState('');
  const [learnCategory, setLearnCategory] = useState('basics');
  const [learnLevel, setLearnLevel] = useState('Beginner');
  const [learnDuration, setLearnDuration] = useState('5');
  const [learnSummary, setLearnSummary] = useState('');
  const [learnPdfFile, setLearnPdfFile] = useState(null);
  const [learnBusy, setLearnBusy] = useState(false);
  const [learnMsg, setLearnMsg] = useState('');
  const [userResetQ, setUserResetQ] = useState('');
  const [userResetResults, setUserResetResults] = useState([]);
  const [userResetBusy, setUserResetBusy] = useState(false);
  const [resettingUid, setResettingUid] = useState('');
  const [adjustingFollowersUid, setAdjustingFollowersUid] = useState('');
  const [followerDeltaByUid, setFollowerDeltaByUid] = useState({});
  const [togglingPaidUid, setTogglingPaidUid] = useState('');
  const userResetDebounceRef = useRef(null);

  const filteredLbRows = useMemo(() => {
    const q = lbShowcaseSearch.trim().toLowerCase();
    if (!q) return lbRows;
    return lbRows.filter((row) => {
      const name = String(row.displayName || '').toLowerCase();
      const uid = String(row.profile_uid || row.id || '').toLowerCase();
      const login = String(row.appLoginId || '').toLowerCase();
      return name.includes(q) || uid.includes(q) || login.includes(q);
    });
  }, [lbRows, lbShowcaseSearch]);
  const chartFileInputRef = useRef(null);
  const lbPhotoInputRef = useRef(null);
  const lbShowcasePhotoInputRef = useRef(null);
  const lbShowcaseBackupImportRef = useRef(null);

  const isEditor = useMemo(() => {
    if (!operatorUid || !editors) return false;
    if (editors.includes(STOCK_TIP_BOOTSTRAP_EDITORS)) return true;
    return editors.includes(operatorUid);
  }, [operatorUid, editors]);

  useEffect(() => {
    loadEditorUids().then(setEditors);
  }, []);

  const runSearch = useCallback(async () => {
    setSearching(true);
    try {
      const rows = await searchIndianStocks(searchQ);
      setSearchResults(rows);
    } finally {
      setSearching(false);
    }
  }, [searchQ]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchQ.trim().length >= 1) runSearch();
      else setSearchResults([]);
    }, 280);
    return () => clearTimeout(t);
  }, [searchQ, runSearch]);

  const refreshTipQueries = useCallback(async () => {
    try {
      setQueries(await fetchTipQueries());
    } catch {
      setQueries([]);
    }
  }, []);

  const refreshShowcase = useCallback(async ({ background = false } = {}) => {
    try {
      const { rows, firestoreSynced } = await fetchShowcaseRows();
      setLbRows(sortShowcaseRows(rows));
      if (firestoreSynced > 0) {
        setLbMsg(`Restored ${firestoreSynced} showcase row(s) from Firestore backup → Postgres.`);
      } else if (!background && rows.length === 0) {
        setLbMsg('No showcase rows yet. Add new, or use Import if you have a JSON backup.');
      }
    } catch (err) {
      if (!background) {
        setLbMsg(err?.message || 'Showcase load failed — admin login / server check karo.');
      }
    }
  }, []);

  const refreshChatLogs = useCallback(async () => {
    try {
      setChatLogs(await fetchChatLogs());
    } catch {
      setChatLogs([]);
    }
  }, []);

  useEffect(() => {
    if (!isEditor || tab !== 'queries') return undefined;
    refreshTipQueries();
    const id = window.setInterval(refreshTipQueries, 8000);
    return () => clearInterval(id);
  }, [isEditor, tab, refreshTipQueries]);

  useEffect(() => {
    if (!isEditor || tab !== 'leaderboard') return undefined;
    refreshShowcase();
    const id = window.setInterval(() => refreshShowcase({ background: true }), 15000);
    return () => clearInterval(id);
  }, [isEditor, tab, refreshShowcase]);

  useEffect(() => {
    if (!isEditor || tab !== 'inbox') return undefined;
    refreshChatLogs();
    const id = window.setInterval(refreshChatLogs, 5000);
    return () => clearInterval(id);
  }, [isEditor, tab, refreshChatLogs]);

  useEffect(() => {
    if (!isEditor || tab !== 'learn' || isFirestoreDisabled()) return undefined;
    const qy = query(collection(db, 'learnStrategies'), orderBy('created_at', 'desc'), limit(120));
    return onSnapshot(qy, (snap) => {
      setLearnRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [isEditor, tab]);

  useEffect(() => {
    if (!isEditor || tab !== 'reset') return undefined;
    const q = userResetQ.trim();
    if (q.length < 2) {
      setUserResetResults([]);
      setUserResetBusy(false);
      return undefined;
    }
    if (userResetDebounceRef.current) clearTimeout(userResetDebounceRef.current);
    setUserResetBusy(true);
    userResetDebounceRef.current = setTimeout(async () => {
      try {
        const j = await bff('/api/admin/search-users', { method: 'POST', body: JSON.stringify({ q }) });
        setUserResetResults(Array.isArray(j.users) ? j.users : []);
        if (tab === 'reset') setLbMsg('');
      } catch (err) {
        setUserResetResults([]);
        if (tab === 'reset') setLbMsg(err?.message || 'Search failed — sign in / admin API check karo.');
      } finally {
        setUserResetBusy(false);
      }
    }, 350);
    return () => {
      if (userResetDebounceRef.current) clearTimeout(userResetDebounceRef.current);
    };
  }, [isEditor, tab, userResetQ]);

  const showcaseProfileUid = (row) => row.profile_uid || `showcase__${row.id}`;

  /**
   * @param preserve {{ photoURL?: string, bio?: string }}
   * @param opts {{ includeSocial?: boolean }} — merge updates must omit followers/following
   */
  const buildShowcaseUserPayload = (profileUid, displayName, pnlRaw, tradeCountRaw, preserve = {}, opts = {}) => {
    const { includeSocial = true } = opts;
    const totalPnl = parseFloat(String(pnlRaw).replace(/,/g, ''));
    const pnl = Number.isFinite(totalPnl) ? totalPnl : 0;
    const tc = Math.max(0, Math.min(500, Math.floor(Number(tradeCountRaw)) || 0));
    const closedPositions = tc > 0 ? buildSyntheticClosedPositions(pnl, tc, profileUid) : [];
    const sumClosed = closedPositions.reduce((s, x) => s + Number(x.realizedPnl), 0);
    const lifetimeRealizedPnl = Math.max(pnl, closedPositions.length > 0 ? sumClosed : 0);
    const photoURL = String(preserve.photoURL ?? '').trim().slice(0, 500);
    const bio = String(preserve.bio ?? '').trim().slice(0, 500);
    const base = {
      uid: profileUid,
      name: displayName,
      email: '',
      photoURL,
      bio,
      virtualBalance: Math.max(0, 10000 + lifetimeRealizedPnl),
      positions: [],
      closedPositions,
      lifetimeRealizedPnl,
      showcaseTradeCount: tc,
      watchlist: [],
      isShowcaseProfile: true,
      showcasePresenceOnline: preserve.showcasePresenceOnline === true,
      showcasePresenceOfflineAt:
        preserve.showcasePresenceOfflineAt !== undefined && preserve.showcasePresenceOfflineAt !== null
          ? preserve.showcasePresenceOfflineAt
          : serverTimestamp()
    };
    if (includeSocial) {
      base.followers = [];
      base.following = [];
      base.createdAt = new Date().toISOString();
    }
    return base;
  };

  const addShowcaseRow = async (e) => {
    e.preventDefault();
    if (!user || !isEditor) return;
    const name = lbName.trim();
    const pnl = parseFloat(String(lbPnl).replace(/,/g, ''));
    const tradeCount = Math.max(0, Math.min(500, parseInt(String(lbTradeCount).trim(), 10) || 0));
    if (!name) {
      setLbMsg('Display name required.');
      return;
    }
    if (!Number.isFinite(pnl)) {
      setLbMsg('P/L must be a valid number.');
      return;
    }
    if (tradeCount < 1) {
      setLbMsg('Number of trades must be at least 1 (for history).');
      return;
    }
    setLbBusy(true);
    setLbMsg('');
    try {
      let photoURL = '';
      const row = await createShowcaseRow({
        displayName: name,
        pnl,
        tradeCount,
        photoURL: '',
        bio: lbBio.trim().slice(0, 500)
      });
      let finalRow = row;
      if (lbPhotoFile) {
        const profileUid = showcaseProfileUid(row);
        photoURL = await uploadProfilePhoto(profileUid, lbPhotoFile, `showcase_${profileUid}`, {
          asUid: profileUid
        });
        finalRow = await updateShowcaseRow(row.id, {
          displayName: name,
          pnl,
          tradeCount,
          photoURL,
          bio: lbBio.trim().slice(0, 500)
        });
      }
      notifyLeaderboardBackgroundRefresh();
      setLbRows((prev) => mergeShowcaseRowInList(prev, finalRow));
      setLbName('');
      setLbPnl('');
      setLbTradeCount('12');
      setLbBio('');
      setLbPhotoFile(null);
      if (lbPhotoInputRef.current) lbPhotoInputRef.current.value = '';
      setLbMsg(
        row.appLoginId
          ? `Saved. AuronX ID: ${row.appLoginId} · Password: ${row.appLoginPassword || '(see row)'}`
          : 'Saved (DigitalOcean).'
      );
    } catch (err) {
      const code = err?.code || '';
      setLbMsg(
        String(code).startsWith('storage/')
          ? formatProfilePhotoUploadError(err)
          : err?.message || 'Could not save showcase.'
      );
    }
    setLbBusy(false);
  };

  const saveShowcaseEdit = async () => {
    if (!lbEdit || !user) return;
    const name = lbEdit.displayName.trim();
    const pnl = parseFloat(String(lbEdit.pnl).replace(/,/g, ''));
    const tradeCount = Math.max(0, Math.min(500, parseInt(String(lbEdit.tradeCount ?? '').trim(), 10) || 0));
    if (!name || !Number.isFinite(pnl)) {
      setLbMsg('Name and valid P/L required.');
      return;
    }
    if (tradeCount < 1) {
      setLbMsg('Number of trades must be at least 1.');
      return;
    }
    setLbRowBusyId(lbEdit.id);
    setLbMsg('');
    try {
      const profileUid = showcaseProfileUid(lbEdit);
      let photoURL = lbEdit.existingPhotoURL || '';
      if (lbShowcasePhotoFile && operatorUid) {
        photoURL = await uploadProfilePhoto(profileUid, lbShowcasePhotoFile, `showcase_${profileUid}`, {
          asUid: profileUid
        });
      }
      const bio = (lbEdit.bio ?? '').trim().slice(0, 500);
      const updated = await updateShowcaseRow(lbEdit.id, {
        displayName: name,
        pnl,
        tradeCount,
        photoURL: photoURL || '',
        bio
      });
      notifyLeaderboardBackgroundRefresh();
      setLbRows((prev) => mergeShowcaseRowInList(prev, updated));
      setLbEdit(null);
      setLbShowcasePhotoFile(null);
      if (lbShowcasePhotoInputRef.current) lbShowcasePhotoInputRef.current.value = '';
      setLbMsg('Updated (DigitalOcean).');
    } catch (err) {
      const code = err?.code || '';
      setLbMsg(
        String(code).startsWith('storage/')
          ? formatProfilePhotoUploadError(err)
          : err?.message || 'Update failed.'
      );
    }
    setLbRowBusyId('');
  };

  const deleteShowcase = async (row) => {
    if (!window.confirm('Remove this showcase row and its trader profile?')) return;
    setLbRowBusyId(row.id);
    setLbMsg('');
    try {
      await deleteShowcaseRow(row.id);
      setLbRows((prev) => prev.filter((r) => r.id !== row.id));
      notifyLeaderboardBackgroundRefresh();
      if (lbEdit?.id === row.id) setLbEdit(null);
      setLbMsg('Removed.');
    } catch (err) {
      setLbMsg(err?.message || 'Delete failed.');
    }
    setLbRowBusyId('');
  };

  const followFromShowcase = async (row) => {
    if (!row) return;
    const actorShowcaseUid = showcaseProfileUid(row);
    const raw = window.prompt('Target profile UID to follow from showcase:');
    const targetUid = (raw || '').trim();
    if (!targetUid) return;
    if (targetUid === actorShowcaseUid) {
      setLbMsg('A showcase profile cannot follow itself.');
      return;
    }
    setLbBusy(true);
    setLbMsg('');
    try {
      await showcaseFollow(row.id, targetUid);
      setLbMsg(`Done: ${row.displayName || actorShowcaseUid} now follows ${targetUid}.`);
    } catch (e) {
      setLbMsg(e?.message || 'Showcase follow failed.');
    }
    setLbBusy(false);
  };

  const syncMissingShowcaseProfiles = async () => {
    setLbBusy(true);
    setLbMsg('');
    try {
      const j = await rebuildShowcaseTrades();
      clearLeaderboardClientCacheAndNotify();
      await refreshShowcase();
      setLbMsg(
        j.rebuilt
          ? `Postgres: ${j.rebuilt} showcase profile(s) synced from leaderboard rows.`
          : 'All profiles already on Postgres.'
      );
    } catch (err) {
      setLbMsg(err?.message || 'Sync failed.');
    }
    setLbBusy(false);
  };

  const showcaseLoginIdFromName = (name) => {
    const base = String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const id = (base.length >= 4 ? base : `${base}show`).slice(0, 20);
    return id.length >= 4 ? id : 'show';
  };

  const resetShowcaseLogin = async (row) => {
    const profileUid = showcaseProfileUid(row);
    const defaultId = showcaseLoginIdFromName(row.displayName) || row.appLoginId || '';
    const customId = window.prompt(
      `AuronX ID for ${row.displayName || profileUid} (khali = naam se auto):`,
      defaultId
    );
    if (customId === null) return;
    const password =
      window.prompt('Password (sab showcase ke liye):', 'atharva2530') || '';
    if (password.length < 6) {
      setLbMsg('Password kam se kam 6 characters hona chahiye.');
      return;
    }
    setLbBusy(true);
    setLbMsg('');
    try {
      const j = await setUserAppLogin(profileUid, password, customId.trim() || undefined);
      await refreshShowcase();
      setLbMsg(`Login set: ${j.loginId} / ${j.password}`);
    } catch (e) {
      setLbMsg(e?.message || 'Login update failed.');
    }
    setLbBusy(false);
  };

  const rebuildAllShowcaseTradeHistories = async () => {
    if (
      !window.confirm(
        'Regenerate trade history for all showcase rows on Postgres? (P/L + trade count from each row)'
      )
    )
      return;
    setLbBusy(true);
    setLbMsg('');
    try {
      const j = await rebuildShowcaseTrades();
      clearLeaderboardClientCacheAndNotify();
      await refreshShowcase();
      setLbMsg(j.rebuilt ? `Rebuilt trade history for ${j.rebuilt} showcase profile(s).` : 'No rows to rebuild.');
    } catch (err) {
      setLbMsg(err?.message || 'Rebuild failed.');
    }
    setLbBusy(false);
  };

  const exportShowcaseBackup = async () => {
    if (!user || !isEditor) return;
    if (!lbRows.length) {
      setLbMsg('Export: abhi koi showcase row nahi — pehle se bana hua JSON backup ho to Import use karo.');
      return;
    }
    setLbBusy(true);
    setLbMsg('');
    try {
      const pack = await exportShowcasePack();
      pack.version = 1;
      const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `showcase-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.rel = 'noopener';
      a.click();
      URL.revokeObjectURL(url);
      setLbMsg(`Exported ${pack.rows.length} showcase row(s) + user profiles — is file ko safe rakhna.`);
    } catch (err) {
      setLbMsg(err?.message || 'Export failed.');
    }
    setLbBusy(false);
  };

  const importShowcaseBackupFromJson = async (rawText) => {
    if (!user || !isEditor) return;
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      setLbMsg('Import: invalid JSON file.');
      return;
    }
    const entries = Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data)
        ? data
        : [];
    if (!entries.length) {
      setLbMsg('Import: file me `rows` array khali hai ya format galat.');
      return;
    }
    if (
      !window.confirm(
        `Import ${entries.length} showcase entr(y/ies)? Same \`id\` wali rows overwrite ho jayengi; users/showcase__… bhi set honge.`
      )
    )
      return;
    setLbBusy(true);
    setLbMsg('');
    try {
      const mapped = entries.map((entry) => {
        const id = String(entry?.id || '').trim();
        const lb =
          entry.leaderboard && typeof entry.leaderboard === 'object' ? { ...entry.leaderboard } : { ...entry };
        return { id, lb, user: entry.user || null };
      });
      const j = await importShowcaseRows(mapped);
      clearLeaderboardClientCacheAndNotify();
      await refreshShowcase();
      const ok = j.imported || 0;
      const errs = j.errors || [];
      setLbMsg(
        errs.length
          ? `Imported ${ok} row(s). Skipped: ${errs.slice(0, 6).join('; ')}${errs.length > 6 ? '…' : ''}`
          : `Imported ${ok} showcase row(s) + profiles. Leaderboard refresh karo.`
      );
    } catch (err) {
      setLbMsg(err?.message || 'Import failed.');
    }
    setLbBusy(false);
  };

  /** Bulk: random N offline showcase → online, or random N online → offline (varied last seen). */
  const applyBulkShowcasePresence = async (mode) => {
    if (!user || !isEditor) return;
    const n = parseInt(String(bulkPresenceCount).trim(), 10);
    if (!Number.isFinite(n) || n <= 0) {
      setLbMsg('Bulk presence: enter a number greater than 0.');
      return;
    }
    setLbBusy(true);
    setLbMsg('');
    try {
      const j = await bulkSetShowcasePresence(n, mode);
      const applied = Number(j.applied) || 0;
      const avail = Number(j.available) || 0;
      if (applied === 0) {
        setLbMsg(
          mode === 'online'
            ? `No offline showcase users left (${avail} eligible).`
            : `No online showcase users to take offline (${avail} online).`
        );
      } else {
        const names = (j.updated || [])
          .slice(0, 4)
          .map((x) => x.displayName || x.profileUid)
          .join(', ');
        const more = applied > 4 ? ` +${applied - 4} more` : '';
        setLbMsg(
          mode === 'online'
            ? `✅ ${applied} random showcase user(s) online: ${names}${more}.`
            : `✅ ${applied} random showcase user(s) offline (alag last seen): ${names}${more}.`
        );
      }
      clearLeaderboardClientCacheAndNotify();
      await refreshShowcase();
    } catch (err) {
      setLbMsg(err?.payload?.error || err?.message || 'Bulk presence failed.');
    }
    setLbBusy(false);
  };

  /** Chat list + open chat: forced online, or last-seen at offline time (showcase traders only). */
  const setShowcasePresenceForRow = async (row, online) => {
    if (!user || !isEditor) return;
    const profileUid = showcaseProfileUid(row);
    const nextOnline = !!online;
    setLbBusy(true);
    setLbMsg('');
    const optimistic = {
      showcasePresenceOnline: nextOnline,
      showcasePresenceOfflineAt: nextOnline ? null : new Date().toISOString()
    };
    setLbRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...optimistic } : r)));
    try {
      await setShowcasePresence(profileUid, row.id, nextOnline);
      clearLeaderboardClientCacheAndNotify();
      setLbMsg(
        `${row.displayName || profileUid}: ${nextOnline ? 'Online — leaderboard + chat sync.' : 'Offline — last seen set.'}`
      );
    } catch (err) {
      setLbRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));
      setLbMsg(err?.message || 'Presence update failed.');
    }
    setLbBusy(false);
  };

  const applyShowcasePnlDelta = async (row) => {
    if (!user || !isEditor) return;
    const delta = parseFloat(String(pnlAdjustAmount).replace(/,/g, ''));
    if (!Number.isFinite(delta) || delta === 0) {
      setLbMsg('Enter a non-zero amount (e.g. 1000 for profit, -500 for loss).');
      return;
    }
    setLbRowBusyId(row.id);
    setLbMsg('');
    const prevPnl = Number(row.pnl) || 0;
    setLbRows((prev) =>
      sortShowcaseRows(prev.map((r) => (r.id === row.id ? { ...r, pnl: prevPnl + delta } : r)))
    );
    try {
      const j = await appendShowcasePnl(row.id, delta);
      if (j.row) {
        setLbRows((prev) => mergeShowcaseRowInList(prev, j.row));
      }
      notifyLeaderboardBackgroundRefresh();
      const sym = j.trade?.symbol || 'trade';
      const when = j.trade?.closedAt ? new Date(j.trade.closedAt).toLocaleString() : 'now';
      setLbMsg(
        `✅ ${row.displayName}: ${delta >= 0 ? '+' : ''}$${delta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} added. ` +
          `Total P/L $${Number(j.lifetimeRealizedPnl || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. ` +
          `Trade: ${sym} ${j.trade?.type || ''} closed ${when}.`
      );
      setPnlAdjustRowId(null);
      setPnlAdjustAmount('');
    } catch (err) {
      setLbRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, pnl: prevPnl } : r)));
      setLbMsg(err?.payload?.error || err?.message || 'Could not add P/L.');
    }
    setLbRowBusyId('');
  };

  const onMonthlyReset = async () => {
    if (!user || !isEditor) return;
    if (
      !window.confirm(
        'Monthly reset — confirm?\n\n' +
          '• Real + showcase SAB users\n' +
          '• Free: $10,000 · Basic (paid): $20,000 · Pro (paid): $50,000\n' +
          '• Open trades + P/L history clear\n' +
          '• Leaderboard & showcase board P/L → zero (showcase names/rows SAFE)\n\n' +
          'Ye action undo nahi hota. OK?'
      )
    )
      return;
    setLbBusy(true);
    setLbMsg('');
    try {
      const j = await runMonthlyReset();
      const apiLine = `Monthly reset done — users: ${j.postgresUsersUpdated ?? '?'}, showcase rows: ${
        j.showcaseRowsUpdated ?? '?'
      }. ${j.balanceNote || ''}`;
      if (typeof refreshUser === 'function') await refreshUser().catch(() => {});
      clearLeaderboardClientCacheAndNotify();
      setLbMsg(apiLine);
    } catch (err) {
      setLbMsg(err?.payload?.error || err?.message || 'Monthly reset failed.');
    }
    setLbBusy(false);
  };

  const resetOneRealUser = async (u) => {
    const label = u.name || u.email || u.uid;
    if (
      !window.confirm(
        `${label} reset?\n\n• Balance $10,000\n• Trades / history clear\n• Leaderboard P/L $0`
      )
    ) {
      return;
    }
    setResettingUid(u.uid);
    setLbMsg('');
    try {
      const j = await bff('/api/admin/reset-user-trading', {
        method: 'POST',
        body: JSON.stringify({ targetUid: u.uid })
      });
      clearLeaderboardClientCacheAndNotify();
      setUserResetResults((prev) =>
        prev.map((row) =>
          row.uid === u.uid
            ? { ...row, virtualBalance: j.virtualBalance ?? 10000, lifetimeRealizedPnl: 0 }
            : row
        )
      );
      setLbMsg(`Reset done: ${j.name || label} — $10k, leaderboard zero.`);
    } catch (err) {
      setLbMsg(err?.message || 'User reset failed.');
    }
    setResettingUid('');
  };

  const adjustFollowersForUser = async (u, action) => {
    const raw = followerDeltaByUid[u.uid];
    const count = Math.max(1, Math.min(500, parseInt(String(raw || ''), 10) || 0));
    if (!count) {
      setLbMsg('Followers count daalo (1-500).');
      return;
    }
    setAdjustingFollowersUid(u.uid);
    setLbMsg('');
    try {
      const j = await adjustFollowers(u.uid, action, count);
      setUserResetResults((prev) =>
        prev.map((row) => (row.uid === u.uid ? { ...row, followerCount: Number(j.followerCount) || 0 } : row))
      );
      setLbMsg(
        `${action === 'increase' ? 'Followers increase' : 'Followers decrease'} done: ${u.name || u.email || u.uid} (${j.applied || 0}/${count})`
      );
    } catch (err) {
      setLbMsg(err?.message || 'Followers update failed.');
    }
    setAdjustingFollowersUid('');
  };

  const setPaidPlan = async (u, plan) => {
    const label = u.name || u.email || u.uid;
    const planLabel = plan === 'none' ? 'Remove plan' : getPlanAdminLabel(plan) || plan;
    if (!window.confirm(`${planLabel} for ${label}?`)) return;
    setTogglingPaidUid(u.uid);
    setLbMsg('');
    try {
      const j = await bff('/api/admin/set-paid-member', {
        method: 'POST',
        body: JSON.stringify({ targetUid: u.uid, plan })
      });
      setUserResetResults((prev) =>
        prev.map((row) =>
          row.uid === u.uid
            ? {
                ...row,
                isPaidMember: !!j.isPaidMember,
                paidPlanType: j.paidPlanType || null,
                virtualBalance:
                  j.virtualBalance != null ? Number(j.virtualBalance) : row.virtualBalance
              }
            : row
        )
      );
      setLbMsg(
        j.isPaidMember
          ? `${getPlanAdminLabel(j.paidPlanType) || j.paidPlanType} ON: ${j.name || label} — wallet $${Number(j.virtualBalance || 0).toLocaleString()}${j.paidBalanceResetAt ? ` · next refresh ${new Date(j.paidBalanceResetAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}` : ''}`
          : `Plan removed: ${j.name || label}`
      );
    } catch (err) {
      const detail = err?.payload?.error || err?.message || 'Plan update failed.';
      setLbMsg(detail);
    }
    setTogglingPaidUid('');
  };

  useEffect(() => {
    if (!file) {
      setPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pickStock = (row) => {
    setSelected(row);
    setMsg('');
  };

  const timeframeLabel = TIP_CATEGORIES.find((c) => c.id === section)?.label || section;

  const onAddTip = async (e) => {
    e.preventDefault();
    if (!user || !isEditor) return;
    if (!selected) {
      setMsg('Select a stock from search first.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const tagsArr = tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const pastedUrl = chartImageUrl.trim();
      let finalChartUrl = /^https?:\/\//i.test(pastedUrl) ? pastedUrl : '';
      const tipRef = await addDoc(collection(db, 'stockTips'), {
        stock_symbol: selected.symbol,
        stock_name: selected.name,
        category: section,
        entry_price: entry,
        target_price: target,
        stop_loss: sl,
        risk_level: risk,
        description: desc,
        chart_image_url: finalChartUrl,
        tags: tagsArr,
        created_at: serverTimestamp(),
        created_by: operatorUid
      });
      if (file && file.size > 0) {
        try {
          const path = `tip-charts/${operatorUid}/${tipRef.id}`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, file, { contentType: file.type || 'image/jpeg' });
          finalChartUrl = await getDownloadURL(storageRef);
          await updateDoc(doc(db, 'stockTips', tipRef.id), { chart_image_url: finalChartUrl });
        } catch {
          setMsg(
            'Tip saved; chart upload failed (often needs Blaze / Storage rules). Use the chart URL field — Imgur or a direct image link.'
          );
          setBusy(false);
          return;
        }
      }
      setMsg('Tip added successfully.');
      setEntry('');
      setTarget('');
      setSl('');
      setDesc('');
      setTags('');
      setFile(null);
      setChartImageUrl('');
      setSelected(null);
      setSearchQ('');
    } catch (err) {
      setMsg(err?.message || 'Failed to add tip. Check Firestore rules and Storage rules.');
    }
    setBusy(false);
  };

  const onAddLearnItem = async (e) => {
    e.preventDefault();
    if (!user || !isEditor) return;
    if (!learnPdfFile || !learnTitle.trim()) {
      setLearnMsg('Title and PDF file required.');
      return;
    }
    setLearnBusy(true);
    setLearnMsg('');
    try {
      const learnRef = doc(collection(db, 'learnStrategies'));
      const storageRef = ref(storage, `learn-strategies/${operatorUid}/${learnRef.id}.pdf`);
      await uploadBytes(storageRef, learnPdfFile, { contentType: 'application/pdf' });
      const pdfUrl = await getDownloadURL(storageRef);
      await setDoc(learnRef, {
        title: learnTitle.trim(),
        category: learnCategory,
        level: learnLevel,
        duration_minutes: parseInt(String(learnDuration).trim(), 10) || 5,
        summary: learnSummary.trim(),
        pdf_url: pdfUrl,
        created_by: operatorUid,
        created_at: serverTimestamp()
      });
      setLearnTitle('');
      setLearnCategory('basics');
      setLearnLevel('Beginner');
      setLearnDuration('5');
      setLearnSummary('');
      setLearnPdfFile(null);
      setLearnMsg('Learn strategy uploaded.');
    } catch (err) {
      setLearnMsg(err?.message || 'Learn PDF upload failed.');
    }
    setLearnBusy(false);
  };

  const deleteLearnItem = async (row) => {
    if (!window.confirm(`Delete "${row.title}" ?`)) return;
    setLearnBusy(true);
    setLearnMsg('');
    try {
      await deleteDoc(doc(db, 'learnStrategies', row.id));
      setLearnMsg('Deleted.');
    } catch (err) {
      setLearnMsg(err?.message || 'Delete failed.');
    }
    setLearnBusy(false);
  };

  if (!user) {
    return (
      <div style={{ padding: 40, textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <p style={{ color: T.text }}>Login to open the developer panel.</p>
        <Link to="/login" style={{ color: T.yellow, fontWeight: 700 }}>
          Login
        </Link>
      </div>
    );
  }

  if (editors === null) {
    return <div style={{ color: T.text, padding: 40, textAlign: 'center' }}>Checking access…</div>;
  }

  if (!isEditor) {
    return (
      <div style={{ padding: '24px 16px 48px', maxWidth: 560, margin: '0 auto' }}>
        <Link to="/tips" style={{ color: T.text, textDecoration: 'none', fontSize: 13 }}>
          ← Expert Tips
        </Link>
        <h1 style={{ color: T.white, marginTop: 16 }}>Developer panel</h1>
        <p style={{ color: T.text, lineHeight: 1.6 }}>
          Your account is not in the tip editors list. Ask the project owner to add your Firebase Auth{' '}
          <strong style={{ color: T.white }}>UID</strong> to the Firestore document{' '}
          <code style={{ color: T.yellow }}>config/stockTipEditors</code> field <code style={{ color: T.yellow }}>uids</code>{' '}
          (array of strings), or set <code style={{ color: T.yellow }}>REACT_APP_STOCK_TIP_EDITOR_UIDS</code> in{' '}
          <code style={{ color: T.yellow }}>.env</code> for UI preview only — production writes still require Firestore rules +
          the config doc.
        </p>
        <p style={{ color: T.text, fontSize: 13 }}>Your UID: {operatorUid}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 14px 48px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/tips" style={{ color: T.text, textDecoration: 'none', fontSize: 13 }}>
            ← Expert Tips
          </Link>
          <Link to="/developer/rewards" style={{ color: T.yellow, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
            Rewards CMS →
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['add', 'learn', 'queries', 'leaderboard', 'inbox', 'reset'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setTab(k);
                setLbMsg('');
              }}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: tab === k ? `1px solid ${T.yellow}` : `1px solid ${T.border}`,
                background: tab === k ? 'rgba(240,185,11,0.15)' : T.card,
                color: T.white,
                fontWeight: 700,
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {k === 'add'
                ? 'Add tip'
                : k === 'learn'
                  ? 'Learn PDFs'
                : k === 'queries'
                  ? 'Help Centre'
                  : k === 'leaderboard'
                    ? 'Leaderboard'
                    : k === 'inbox'
                      ? 'Chat inbox'
                      : 'Reset'}
            </button>
          ))}
        </div>
      </div>

      <h1 style={{ color: T.white, fontSize: 22, marginTop: 18 }}>Stock tips — developer</h1>
      {editors?.includes(STOCK_TIP_BOOTSTRAP_EDITORS) ? (
        <p style={{ color: T.yellow, fontSize: 13, lineHeight: 1.55, marginBottom: 8 }}>
          <strong>Bootstrap:</strong> <code style={{ color: T.white }}>config/stockTipEditors</code> is not in Firestore
          yet — any signed-in user can add tips. To restrict: create the doc with field{' '}
          <code style={{ color: T.white }}>uids</code> = array of Firebase Auth UIDs, then deploy rules.
        </p>
      ) : null}
      <p style={{ color: T.text, fontSize: 13, lineHeight: 1.55 }}>
        <strong style={{ color: T.green }}>Blaze optional:</strong> paste an <strong>image URL</strong> below for the chart
        (Imgur, Discord CDN, etc.) — Firestore-only is enough. Use file upload when Storage is enabled.
      </p>
      <p style={{ color: T.text, fontSize: 13 }}>Alpha Vantage: optional .env → REACT_APP_ALPHA_VANTAGE_KEY</p>

      {tab === 'add' && (
        <form onSubmit={onAddTip} style={{ marginTop: 20 }}>
          <label style={{ display: 'block', color: T.text, fontSize: 12, marginBottom: 6 }}>Tip section</label>
          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              background: T.card2,
              color: T.white,
              marginBottom: 16
            }}
          >
            {TIP_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: T.purple, marginBottom: 16 }}>Timeframe auto: {timeframeLabel}</div>

          <label style={{ display: 'block', color: T.text, fontSize: 12, marginBottom: 6 }}>Search stock (NSE / API)</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="e.g. RELIANCE"
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                background: T.card2,
                color: T.white
              }}
            />
            <button
              type="button"
              onClick={runSearch}
              style={{
                padding: '0 16px',
                borderRadius: 10,
                border: 'none',
                background: T.yellow,
                color: '#000',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {searching ? '…' : 'Search'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div
              style={{
                maxHeight: 200,
                overflowY: 'auto',
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                marginBottom: 16,
                background: T.card
              }}
            >
              {searchResults.map((r) => (
                <button
                  key={`${r.symbol}-${r.name}`}
                  type="button"
                  onClick={() => pickStock(r)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    border: 'none',
                    borderBottom: `1px solid ${T.border}`,
                    background: selected?.symbol === r.symbol ? 'rgba(240,185,11,0.1)' : 'transparent',
                    color: T.white,
                    cursor: 'pointer'
                  }}
                >
                  <strong>{r.symbol}</strong> <span style={{ color: T.text, fontSize: 12 }}>{r.name}</span>
                  {r.region ? <span style={{ color: T.text, fontSize: 10, display: 'block' }}>{r.region}</span> : null}
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                border: `1px solid rgba(167,139,250,0.3)`,
                marginBottom: 16,
                background: 'rgba(167,139,250,0.06)'
              }}
            >
              <div style={{ fontSize: 11, color: T.text }}>Selected</div>
              <div style={{ fontWeight: 800, color: T.white }}>
                {selected.name} ({selected.symbol})
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            <div>
              <label style={{ color: T.text, fontSize: 12 }}>Entry price</label>
              <input
                required
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ color: T.text, fontSize: 12 }}>Target</label>
              <input
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ color: T.text, fontSize: 12 }}>Stop loss</label>
              <input required value={sl} onChange={(e) => setSl(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <label style={{ display: 'block', color: T.text, fontSize: 12, marginTop: 14 }}>Risk level</label>
          <select value={risk} onChange={(e) => setRisk(e.target.value)} style={{ ...inputStyle, marginTop: 6 }}>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>

          <label style={{ display: 'block', color: T.text, fontSize: 12, marginTop: 14 }}>Description</label>
          <textarea
            required
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={5}
            style={{ ...inputStyle, marginTop: 6, resize: 'vertical' }}
          />

          <label style={{ display: 'block', color: T.text, fontSize: 12, marginTop: 10 }}>
            Chart image URL (recommended — no Blaze)
          </label>
          <input
            value={chartImageUrl}
            onChange={(e) => setChartImageUrl(e.target.value)}
            placeholder="https://… direct image link"
            style={{ ...inputStyle, marginTop: 6 }}
          />

          <label style={{ display: 'block', color: T.text, fontSize: 12, marginTop: 14 }}>Chart file upload (optional)</label>
          <input
            ref={chartFileInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{
              position: 'absolute',
              width: 0,
              height: 0,
              opacity: 0,
              overflow: 'hidden',
              clip: 'rect(0,0,0,0)',
              border: 0
            }}
            tabIndex={-1}
            aria-hidden
          />
          <button
            type="button"
            onClick={() => chartFileInputRef.current?.click()}
            style={{
              marginTop: 8,
              padding: '10px 16px',
              borderRadius: 8,
              border: `1px solid ${T.yellow}`,
              background: T.card2,
              color: T.yellow,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            Chart image file chunein
          </button>
          {file ? (
            <span style={{ display: 'block', color: T.text, fontSize: 12, marginTop: 6 }}>{file.name}</span>
          ) : null}
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 10, marginTop: 10, border: `1px solid ${T.border}` }}
            />
          ) : null}

          <label style={{ display: 'block', color: T.text, fontSize: 12, marginTop: 14 }}>Tags (comma separated)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="breakout, results" style={{ ...inputStyle, marginTop: 6 }} />

          {msg ? (
            <div style={{ marginTop: 14, color: msg.includes('success') ? T.green : T.red, fontSize: 14 }}>{msg}</div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 20,
              width: '100%',
              padding: 14,
              borderRadius: 10,
              border: 'none',
              background: T.green,
              color: T.white,
              fontWeight: 800,
              fontSize: 15,
              cursor: busy ? 'wait' : 'pointer'
            }}
          >
            {busy ? 'Saving…' : 'Add Tip'}
          </button>
        </form>
      )}

      {tab === 'learn' && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ color: T.white, fontSize: 16, margin: 0 }}>Learn page PDF strategies</h2>
          <p style={{ color: T.text, fontSize: 13, lineHeight: 1.55, marginTop: 8 }}>
            PDFs you upload here appear on the app’s <code style={{ color: T.white }}>/learn</code> page
            tab.
          </p>

          <form onSubmit={onAddLearnItem} style={{ marginTop: 14 }}>
            <label style={{ display: 'block', color: T.text, fontSize: 12, marginBottom: 4 }}>Title</label>
            <input value={learnTitle} onChange={(e) => setLearnTitle(e.target.value)} style={inputStyle} />

            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', marginTop: 12 }}>
              <div>
                <label style={{ display: 'block', color: T.text, fontSize: 12, marginBottom: 4 }}>Category</label>
                <select value={learnCategory} onChange={(e) => setLearnCategory(e.target.value)} style={inputStyle}>
                  <option value="basics">Basics</option>
                  <option value="trading">Trading</option>
                  <option value="technical">Technical</option>
                  <option value="risk">Risk</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: T.text, fontSize: 12, marginBottom: 4 }}>Level</label>
                <select value={learnLevel} onChange={(e) => setLearnLevel(e.target.value)} style={inputStyle}>
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: T.text, fontSize: 12, marginBottom: 4 }}>Duration (min)</label>
                <input value={learnDuration} onChange={(e) => setLearnDuration(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <label style={{ display: 'block', color: T.text, fontSize: 12, marginTop: 12, marginBottom: 4 }}>Summary</label>
            <textarea
              value={learnSummary}
              onChange={(e) => setLearnSummary(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />

            <label style={{ display: 'block', color: T.text, fontSize: 12, marginTop: 12, marginBottom: 4 }}>PDF file</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setLearnPdfFile(e.target.files?.[0] || null)}
              style={{ color: T.text }}
            />
            {learnPdfFile ? <div style={{ color: T.text, fontSize: 12, marginTop: 6 }}>{learnPdfFile.name}</div> : null}

            {learnMsg ? (
              <div style={{ marginTop: 10, color: learnMsg.includes('failed') ? T.red : T.green, fontSize: 13 }}>
                {learnMsg}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={learnBusy}
              style={{
                marginTop: 14,
                width: '100%',
                padding: 12,
                borderRadius: 10,
                border: 'none',
                background: T.green,
                color: T.white,
                fontWeight: 800,
                cursor: learnBusy ? 'wait' : 'pointer'
              }}
            >
              {learnBusy ? 'Uploading…' : 'Upload Learn PDF'}
            </button>
          </form>

          <h3 style={{ color: T.white, fontSize: 14, marginTop: 24 }}>Published ({learnRows.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {learnRows.map((row) => (
              <div
                key={row.id}
                style={{
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  padding: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10
                }}
              >
                <div>
                  <div style={{ color: T.white, fontWeight: 700 }}>{row.title}</div>
                  <div style={{ color: T.text, fontSize: 12, marginTop: 3 }}>
                    {row.category} · {row.level || 'Beginner'} · {row.duration_minutes || 5} min
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {row.pdf_url ? (
                    <a
                      href={row.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: `1px solid ${T.yellow}`,
                        color: T.yellow,
                        textDecoration: 'none',
                        fontSize: 12,
                        fontWeight: 700
                      }}
                    >
                      Open
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => deleteLearnItem(row)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: `1px solid ${T.red}`,
                      background: 'transparent',
                      color: T.red,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {learnRows.length === 0 ? <p style={{ color: T.text, margin: 0 }}>No learn PDFs uploaded yet.</p> : null}
          </div>
        </div>
      )}

      {tab === 'queries' && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ color: T.white, fontSize: 16 }}>User queries</h2>
          {queries.length === 0 ? (
            <p style={{ color: T.text }}>No queries yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              {queries.map((q) => (
                <div
                  key={q.id}
                  style={{
                    background: T.card,
                    borderRadius: 12,
                    padding: 14,
                    border: `1px solid ${T.border}`,
                    fontSize: 13
                  }}
                >
                  <div style={{ color: T.yellow, fontWeight: 800 }}>{q.stock_name}</div>
                  <div style={{ color: T.green, fontSize: 12, marginTop: 6, fontWeight: 700 }}>
                    From:{' '}
                    <span style={{ color: T.white }}>
                      {q.user_display_name || q.user_email?.split('@')[0] || 'User'}
                    </span>
                    {q.user_email ? (
                      <span style={{ color: T.text, fontWeight: 500 }}> · {q.user_email}</span>
                    ) : q.user_uid ? (
                      <span style={{ color: T.text, fontWeight: 500, fontSize: 11 }}> · UID {q.user_uid}</span>
                    ) : null}
                  </div>
                  <div style={{ color: T.text, fontSize: 11, marginTop: 4 }}>
                    {new Date(q.created_at?.toMillis?.() || Date.now()).toLocaleString()}
                  </div>
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      color: T.white,
                      fontSize: 12,
                      margin: '10px 0 0',
                      fontFamily: 'inherit',
                      lineHeight: 1.5
                    }}
                  >
                    {q.admin_prompt || ''}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'leaderboard' && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              marginBottom: 18,
              padding: '16px 16px 14px',
              borderRadius: 14,
              border: '1px solid rgba(240,185,11,0.5)',
              background: 'linear-gradient(135deg, rgba(40,32,8,0.85) 0%, rgba(19,21,30,0.95) 100%)'
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: T.yellow, marginBottom: 6 }}>
              MONTHLY RESET
            </div>
            <h2 style={{ color: T.white, fontSize: 17, fontWeight: 900, margin: '0 0 8px' }}>
              Sab traders + showcase — naya mahina
            </h2>
            <p style={{ color: T.text, fontSize: 13, lineHeight: 1.55, margin: '0 0 14px' }}>
              Real aur showcase dono reset. Paid plan users ko unke balance ($20k Basic / $50k Pro), baaki $10k.
              Leaderboard P/L zero — showcase list delete nahi hoti.
            </p>
            <button
              type="button"
              onClick={onMonthlyReset}
              disabled={lbBusy}
              style={{
                width: '100%',
                maxWidth: 360,
                padding: '14px 20px',
                borderRadius: 12,
                border: 'none',
                background: T.yellow,
                color: '#000',
                fontWeight: 900,
                fontSize: 15,
                cursor: lbBusy ? 'wait' : 'pointer',
                boxShadow: '0 4px 20px rgba(240,185,11,0.25)'
              }}
            >
              {lbBusy ? 'Resetting…' : 'Monthly reset'}
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <h2 style={{ color: T.white, fontSize: 16, margin: 0 }}>Leaderboard showcase</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                onClick={async () => {
                  setLbBusy(true);
                  setLbMsg('');
                  try {
                    const { rows, imported } = await syncShowcaseFromFirestore();
                    rows.sort((a, b) => (Number(b.pnl) || 0) - (Number(a.pnl) || 0));
                    setLbRows(rows);
                    setLbMsg(
                      imported > 0
                        ? `Firestore se ${imported} showcase row restore ho gayi.`
                        : rows.length
                          ? `${rows.length} row(s) Postgres me hain.`
                          : 'Firestore me koi purani showcase row nahi mili.'
                    );
                  } catch (e) {
                    setLbMsg(e?.message || 'Firestore restore failed.');
                  }
                  setLbBusy(false);
                }}
                disabled={lbBusy}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `1px solid ${T.yellow}`,
                  background: 'rgba(240,185,11,0.12)',
                  color: T.yellow,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: lbBusy ? 'wait' : 'pointer'
                }}
                title="Purani Firestore leaderboardShowcase → Postgres"
              >
                Restore from Firestore
              </button>
              <button
                type="button"
                onClick={syncMissingShowcaseProfiles}
                disabled={lbBusy || lbRows.length === 0}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `1px solid ${T.yellow}`,
                  background: 'transparent',
                  color: T.yellow,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: lbBusy ? 'wait' : 'pointer'
                }}
              >
                Sync missing profiles
              </button>
              <button
                type="button"
                onClick={rebuildAllShowcaseTradeHistories}
                disabled={lbBusy || lbRows.length === 0}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `1px solid ${T.green}`,
                  background: 'transparent',
                  color: T.green,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: lbBusy ? 'wait' : 'pointer'
                }}
              >
                Rebuild all trade histories
              </button>
              <button
                type="button"
                onClick={exportShowcaseBackup}
                disabled={lbBusy || lbRows.length === 0}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `1px solid ${T.purple}`,
                  background: 'transparent',
                  color: T.purple,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: lbBusy ? 'wait' : 'pointer'
                }}
                title="JSON download — future restore / same IDs par wapas"
              >
                Export JSON backup
              </button>
              <button
                type="button"
                onClick={() => lbShowcaseBackupImportRef.current?.click()}
                disabled={lbBusy}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `1px solid ${T.white}`,
                  background: 'transparent',
                  color: T.white,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: lbBusy ? 'wait' : 'pointer'
                }}
                title="Pehle export ki hui ya kisi aur se mili JSON"
              >
                Import from JSON…
              </button>
              <input
                ref={lbShowcaseBackupImportRef}
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    const text = await f.text();
                    await importShowcaseBackupFromJson(text);
                  } catch (err) {
                    setLbMsg(err?.message || 'Could not read file.');
                  }
                }}
              />
            </div>
          </div>
          <p style={{ color: T.text, fontSize: 13, lineHeight: 1.55, marginTop: 8 }}>
            Delete ke baad bilkul wahi tabhi wapas aa sakta hai jab tumhare paas pehle se{' '}
            <strong style={{ color: T.white }}>JSON backup</strong> ho, ya Firebase / Google Cloud par scheduled export
            ho. Ab panel me <strong style={{ color: T.purple }}>Export JSON backup</strong> (roz / delete se pehle) aur{' '}
            <strong style={{ color: T.white }}>Import from JSON…</strong> se same document <code style={{ color: T.white }}>id</code> +{' '}
            <code style={{ color: T.white }}>users/showcase__…</code> restore ho sakte hain. Backup nahi to sirf manually rows dubara add karni padengi. Har row{' '}
            <code style={{ color: T.white }}>users/showcase__…</code> profile banati hai — Follow /
            <Link to="/leaderboard" style={{ color: T.yellow }}>
              here
            </Link>{' '}
            behaves like a real trader. Older rows? Click &quot;Sync missing profiles&quot;.{' '}
            <strong style={{ color: T.white }}>No. of trades</strong> and total P/L auto-generate trade history on the
            profile — each trade has its own P/L line, but <strong style={{ color: T.white }}>the sum matches your total
            P/L</strong>. Photo gallery and bio work like a normal profile.{' '}
            <strong style={{ color: T.yellow }}>Monthly reset</strong> (upar wala button) = real + showcase plan balance +
            P/L zero; showcase list delete nahi hoti (sirf row par &quot;Remove&quot; se hategi). Access: UID{' '}
            <code style={{ color: T.white }}>config/stockTipEditors</code>{' '}
            + env. Neeche har row par <strong style={{ color: T.white }}>Online / Offline</strong> chat presence (dusre
            users ko list + chat header me dikhega).
          </p>

          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 12,
              border: `1px solid rgba(0,168,132,0.35)`,
              background: 'rgba(0,168,132,0.08)'
            }}
          >
            <div style={{ color: T.white, fontWeight: 800, fontSize: 14, marginBottom: 6 }}>
              Bulk showcase online / offline (random)
            </div>
            <p style={{ color: T.text, fontSize: 12, lineHeight: 1.5, margin: '0 0 12px' }}>
              Number daalo — utne <strong style={{ color: T.white }}>random</strong> showcase users online ya offline
              ho jayenge (serial order nahi). Offline par har user ka last seen alag minute (1, 4, 5, 7, 8 min…) dikhega.
              Neeche wale har-row Online/Offline buttons pehle jaisa hi kaam karte hain.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <input
                value={bulkPresenceCount}
                onChange={(e) => setBulkPresenceCount(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                inputMode="numeric"
                placeholder="e.g. 5"
                disabled={lbBusy}
                style={{
                  width: 88,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: T.card,
                  color: T.white,
                  fontSize: 15,
                  fontWeight: 700
                }}
              />
              <button
                type="button"
                disabled={lbBusy}
                onClick={() => applyBulkShowcasePresence('online')}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: `1px solid ${T.yellow}`,
                  background: 'rgba(240,185,11,0.18)',
                  color: T.yellow,
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: lbBusy ? 'wait' : 'pointer'
                }}
              >
                Set N online
              </button>
              <button
                type="button"
                disabled={lbBusy}
                onClick={() => applyBulkShowcasePresence('offline')}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: 'rgba(132,142,156,0.12)',
                  color: T.text,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: lbBusy ? 'wait' : 'pointer'
                }}
              >
                Set N offline
              </button>
              <span style={{ color: T.text, fontSize: 11 }}>
                Online: {lbRows.filter((r) => r.showcasePresenceOnline === true).length} · Offline:{' '}
                {lbRows.filter((r) => r.showcasePresenceOnline !== true).length}
              </span>
            </div>
          </div>

          <form onSubmit={addShowcaseRow} style={{ marginTop: 16 }}>
            <label style={{ display: 'block', color: T.text, fontSize: 12, marginBottom: 4 }}>Display name</label>
            <input
              value={lbName}
              onChange={(e) => setLbName(e.target.value)}
              placeholder="e.g. Pro Trader (display only)"
              style={inputStyle}
            />
            <label style={{ display: 'block', color: T.text, fontSize: 12, marginTop: 12, marginBottom: 4 }}>
              Realized P/L (number, USD style)
            </label>
            <input
              value={lbPnl}
              onChange={(e) => setLbPnl(e.target.value)}
              placeholder="e.g. 12500 or -1200.50"
              inputMode="decimal"
              style={inputStyle}
            />
            <label style={{ display: 'block', color: T.text, fontSize: 12, marginTop: 12, marginBottom: 4 }}>
              No. of closed trades (1–500) — that many rows in history; their net P/L should match the total above
            </label>
            <input
              value={lbTradeCount}
              onChange={(e) => setLbTradeCount(e.target.value)}
              placeholder="e.g. 25"
              inputMode="numeric"
              style={inputStyle}
            />
            <label style={{ display: 'block', color: T.text, fontSize: 12, marginTop: 12, marginBottom: 4 }}>Bio (optional)</label>
            <textarea
              value={lbBio}
              onChange={(e) => setLbBio(e.target.value)}
              rows={3}
              placeholder="Short intro…"
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <label style={{ display: 'block', color: T.text, fontSize: 12, marginTop: 12, marginBottom: 4 }}>
              Profile photo (gallery — max 5 MB)
            </label>
            <input
              ref={lbPhotoInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              onChange={(e) => setLbPhotoFile(e.target.files?.[0] || null)}
              style={{
                position: 'absolute',
                width: 0,
                height: 0,
                opacity: 0,
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
                border: 0
              }}
              tabIndex={-1}
              aria-hidden
            />
            <button
              type="button"
              onClick={() => lbPhotoInputRef.current?.click()}
              style={{
                marginTop: 4,
                padding: '10px 16px',
                borderRadius: 8,
                border: `1px solid ${T.yellow}`,
                background: T.card2,
                color: T.yellow,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer'
              }}
            >
              Showcase photo chunein
            </button>
            {lbPhotoFile ? (
              <span style={{ display: 'block', color: T.text, fontSize: 12, marginTop: 6 }}>{lbPhotoFile.name}</span>
            ) : null}
            {lbMsg ? (
              <div
                style={{
                  marginTop: 12,
                  color: /fail|could|http|403|401|500|skip|error/i.test(lbMsg) ? T.red : T.green,
                  fontSize: 13
                }}
              >
                {lbMsg}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={lbBusy}
              style={{
                marginTop: 16,
                width: '100%',
                padding: 12,
                borderRadius: 10,
                border: 'none',
                background: T.green,
                color: T.white,
                fontWeight: 800,
                cursor: lbBusy ? 'wait' : 'pointer'
              }}
            >
              {lbBusy ? 'Saving…' : 'Add showcase row'}
            </button>
          </form>

          <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <h3 style={{ color: T.white, fontSize: 14, margin: 0 }}>
              Current rows ({filteredLbRows.length}
              {lbShowcaseSearch.trim() ? ` / ${lbRows.length}` : ''})
            </h3>
            <input
              type="search"
              value={lbShowcaseSearch}
              onChange={(e) => setLbShowcaseSearch(e.target.value)}
              placeholder="Search showcase by name, UID, AuronX ID…"
              style={{ ...inputStyle, flex: '1 1 220px', maxWidth: 360, margin: 0 }}
              autoComplete="off"
            />
            <button
              type="button"
              disabled={lbBusy}
              onClick={async () => {
                if (
                  !window.confirm(
                    'Sync top 10 winners from the live leaderboard?\n\nUse this so Winners page, Home, and congrats banners match the public board.\n\nIf not finalized yet, this also runs full finalize (closes open trades).'
                  )
                )
                  return;
                setLbBusy(true);
                setLbMsg('');
                try {
                  const j = await finalizeLeaderboardCampaign(true);
                  clearLeaderboardClientCacheAndNotify();
                  const names = (j.winnerNames || j.winners?.map((w) => w.name) || []).join(', ');
                  setLbMsg(
                    j.synced
                      ? `Winners synced (${j.winners?.length || 0}): ${names}`
                      : j.alreadyFinalized
                        ? 'Campaign already finalized — tap Sync winners again to refresh from board.'
                        : `Finalized: ${j.winners?.length || 0} winner(s), ${j.positionsClosedUsers || 0} user(s) had open positions closed.`
                  );
                } catch (err) {
                  setLbMsg(err?.payload?.error || err?.message || 'Sync failed.');
                }
                setLbBusy(false);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: `1px solid ${T.yellow}`,
                background: 'rgba(240,185,11,0.15)',
                color: T.yellow,
                fontWeight: 800,
                fontSize: 12,
                cursor: lbBusy ? 'wait' : 'pointer'
              }}
            >
              Sync winners from board
            </button>
            <button
              type="button"
              disabled={lbBusy}
              onClick={async () => {
                setLbBusy(true);
                setLbMsg('');
                try {
                  const j = await syncLeaderboardWinners();
                  clearLeaderboardClientCacheAndNotify();
                  const names = (j.winnerNames || j.winners?.map((w) => w.name) || []).join(', ');
                  setLbMsg(`Synced: ${j.winners?.length || 0} — ${names}`);
                } catch (err) {
                  setLbMsg(err?.payload?.error || err?.message || 'Sync failed.');
                }
                setLbBusy(false);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: T.card,
                color: T.text,
                fontWeight: 700,
                fontSize: 12,
                cursor: lbBusy ? 'wait' : 'pointer'
              }}
            >
              Refresh winners only
            </button>
          </div>
          {lbRows.length === 0 ? (
            <p style={{ color: T.text, marginTop: 8 }}>None yet — add names above for the public board.</p>
          ) : filteredLbRows.length === 0 ? (
            <p style={{ color: T.text, marginTop: 8 }}>No showcase row matches your search.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {filteredLbRows.map((row) => (
                <div
                  key={row.id}
                  style={{
                    background: T.card,
                    borderRadius: 12,
                    padding: 12,
                    border: `1px solid ${T.border}`,
                    fontSize: 13
                  }}
                >
                  {lbEdit?.id === row.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        value={lbEdit.displayName}
                        onChange={(e) => setLbEdit((x) => ({ ...x, displayName: e.target.value }))}
                        style={inputStyle}
                      />
                      <input
                        value={lbEdit.pnl}
                        onChange={(e) => setLbEdit((x) => ({ ...x, pnl: e.target.value }))}
                        inputMode="decimal"
                        style={inputStyle}
                      />
                      <label style={{ display: 'block', color: T.text, fontSize: 11, marginBottom: 2 }}>
                        No. of trades
                      </label>
                      <input
                        value={lbEdit.tradeCount}
                        onChange={(e) => setLbEdit((x) => ({ ...x, tradeCount: e.target.value }))}
                        inputMode="numeric"
                        style={inputStyle}
                      />
                      <label style={{ display: 'block', color: T.text, fontSize: 11, marginBottom: 2 }}>Bio</label>
                      <textarea
                        value={lbEdit.bio ?? ''}
                        onChange={(e) => setLbEdit((x) => ({ ...x, bio: e.target.value }))}
                        rows={3}
                        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                      />
                      <label style={{ display: 'block', color: T.text, fontSize: 11, marginBottom: 2 }}>
                        Profile photo (gallery)
                      </label>
                      {lbEdit.existingPhotoURL && !lbShowcasePhotoFile ? (
                        <img
                          src={lbEdit.existingPhotoURL}
                          alt=""
                          referrerPolicy="no-referrer"
                          style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', marginBottom: 6 }}
                        />
                      ) : null}
                      <input
                        ref={lbShowcasePhotoInputRef}
                        type="file"
                        accept="image/*,.heic,.heif"
                        onChange={(e) => setLbShowcasePhotoFile(e.target.files?.[0] || null)}
                        style={{
                          position: 'absolute',
                          width: 0,
                          height: 0,
                          opacity: 0,
                          overflow: 'hidden',
                          clip: 'rect(0,0,0,0)',
                          border: 0
                        }}
                        tabIndex={-1}
                        aria-hidden
                      />
                      <button
                        type="button"
                        onClick={() => lbShowcasePhotoInputRef.current?.click()}
                        style={{
                          marginTop: 4,
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: `1px solid ${T.yellow}`,
                          background: T.card2,
                          color: T.yellow,
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: 'pointer'
                        }}
                      >
                        Nayi photo chunein
                      </button>
                      {lbShowcasePhotoFile ? (
                        <span style={{ color: T.text, fontSize: 11, marginTop: 4 }}>{lbShowcasePhotoFile.name}</span>
                      ) : null}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={saveShowcaseEdit}
                          disabled={lbRowBusyId === row.id}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: 'none',
                            background: T.yellow,
                            color: '#000',
                            fontWeight: 700,
                            cursor: lbRowBusyId === row.id ? 'wait' : 'pointer'
                          }}
                        >
                          {lbRowBusyId === row.id ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLbEdit(null);
                            setLbShowcasePhotoFile(null);
                          }}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: `1px solid ${T.border}`,
                            background: 'transparent',
                            color: T.text,
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div>
                        <Link
                          to={`/profile/${encodeURIComponent(showcaseProfileUid(row))}`}
                          style={{ color: T.white, fontWeight: 800, textDecoration: 'none' }}
                        >
                          {row.displayName}
                        </Link>
                        <div style={{ color: (row.pnl || 0) >= 0 ? T.green : T.red, fontWeight: 700, marginTop: 4 }}>
                          {(row.pnl || 0) >= 0 ? '+' : ''}$
                          {Number(row.pnl || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ color: T.text, fontSize: 12, marginTop: 4 }}>
                          {`${Number(row.tradeCount) > 0 ? row.tradeCount : 12} trades (history)`}
                        </div>
                        <div style={{ color: T.text, fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
                          <strong style={{ color: T.white }}>AuronX ID:</strong>{' '}
                          <code style={{ color: T.yellow }}>{row.appLoginId || '…'}</code>
                          {row.appLoginPassword ? (
                            <>
                              {' · '}
                              <strong style={{ color: T.white }}>Password:</strong>{' '}
                              <code style={{ color: T.yellow }}>{row.appLoginPassword}</code>
                            </>
                          ) : null}
                        </div>
                        <div style={{ color: T.text, fontSize: 10, marginTop: 2, fontFamily: 'monospace' }}>
                          {showcaseProfileUid(row)}
                        </div>
                        {pnlAdjustRowId === row.id ? (
                          <div
                            style={{
                              marginTop: 10,
                              padding: '10px 12px',
                              borderRadius: 8,
                              border: `1px solid ${T.purple}`,
                              background: 'rgba(167,139,250,0.08)',
                              maxWidth: 340
                            }}
                          >
                            <div style={{ color: T.purple, fontSize: 11, fontWeight: 800, marginBottom: 6 }}>
                              Add Profit / Loss
                            </div>
                            <div style={{ color: T.text, fontSize: 11, lineHeight: 1.4, marginBottom: 8 }}>
                              Current P/L par add hoga. Ek real jaisa trade history mein abhi ke time pe dikhega.
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              <input
                                value={pnlAdjustAmount}
                                onChange={(e) => setPnlAdjustAmount(e.target.value)}
                                placeholder="e.g. 1000 or -500"
                                disabled={lbRowBusyId === row.id}
                                style={{
                                  flex: 1,
                                  minWidth: 120,
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  border: `1px solid ${T.border}`,
                                  background: '#0a0a0a',
                                  color: T.white,
                                  fontSize: 13
                                }}
                              />
                              <button
                                type="button"
                                disabled={lbRowBusyId === row.id}
                                onClick={() => applyShowcasePnlDelta(row)}
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  border: 'none',
                                  background: T.purple,
                                  color: '#fff',
                                  fontWeight: 800,
                                  fontSize: 12,
                                  cursor: lbRowBusyId === row.id ? 'wait' : 'pointer'
                                }}
                              >
                                {lbRowBusyId === row.id ? '…' : 'Apply'}
                              </button>
                              <button
                                type="button"
                                disabled={lbBusy}
                                onClick={() => {
                                  setPnlAdjustRowId(null);
                                  setPnlAdjustAmount('');
                                }}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  border: `1px solid ${T.border}`,
                                  background: 'transparent',
                                  color: T.text,
                                  fontSize: 12,
                                  cursor: 'pointer'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                          <span style={{ color: T.text, fontSize: 11, fontWeight: 600 }}>Chat</span>
                          <button
                            type="button"
                            disabled={lbBusy || row.showcasePresenceOnline === true}
                            onClick={() => setShowcasePresenceForRow(row, true)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 8,
                              border: `1px solid ${row.showcasePresenceOnline === true ? T.yellow : T.border}`,
                              background: row.showcasePresenceOnline === true ? 'rgba(240,185,11,0.2)' : 'transparent',
                              color: T.yellow,
                              fontWeight: 800,
                              fontSize: 11,
                              cursor: lbBusy ? 'wait' : 'pointer'
                            }}
                          >
                            Online
                          </button>
                          <button
                            type="button"
                            disabled={lbBusy}
                            onClick={() => setShowcasePresenceForRow(row, false)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 8,
                              border: `1px solid ${row.showcasePresenceOnline !== true ? T.text : T.border}`,
                              background: row.showcasePresenceOnline !== true ? 'rgba(132,142,156,0.15)' : 'transparent',
                              color: T.text,
                              fontWeight: 700,
                              fontSize: 11,
                              cursor: lbBusy ? 'wait' : 'pointer'
                            }}
                          >
                            Offline
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => {
                            const uid = showcaseProfileUid(row);
                            navigate(`/dashboard?actAs=${encodeURIComponent(uid)}`);
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: `1px solid ${T.yellow}`,
                            background: 'transparent',
                            color: T.yellow,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Open as User
                        </button>
                        <button
                          type="button"
                          disabled={lbBusy}
                          onClick={() => {
                            setPnlAdjustRowId(row.id);
                            setPnlAdjustAmount('');
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: `1px solid ${T.purple}`,
                            background: 'transparent',
                            color: T.purple,
                            fontWeight: 700,
                            cursor: lbBusy ? 'wait' : 'pointer'
                          }}
                        >
                          + P/L
                        </button>
                        <button
                          type="button"
                          onClick={() => resetShowcaseLogin(row)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: `1px solid ${T.white}`,
                            background: 'transparent',
                            color: T.white,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Set login
                        </button>
                        <button
                          type="button"
                          onClick={() => followFromShowcase(row)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: `1px solid ${T.green}`,
                            background: 'transparent',
                            color: T.green,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Follow User
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const profileUid = showcaseProfileUid(row);
                            setLbShowcasePhotoFile(null);
                            let ex = {};
                            try {
                              const j = await bff(
                                `/api/data/user-public?uid=${encodeURIComponent(profileUid)}`
                              );
                              if (j.user) ex = j.user;
                            } catch {
                              /* ignore */
                            }
                            setLbEdit({
                              id: row.id,
                              profile_uid: row.profile_uid,
                              displayName: row.displayName || '',
                              pnl: String(row.pnl ?? ''),
                              tradeCount: String(row.tradeCount ?? 12),
                              bio: ex.bio || '',
                              existingPhotoURL: ex.photoURL || ''
                            });
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: `1px solid ${T.yellow}`,
                            background: 'transparent',
                            color: T.yellow,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteShowcase(row)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: `1px solid ${T.red}`,
                            background: 'transparent',
                            color: T.red,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'reset' && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ color: T.white, fontSize: 16 }}>Real user reset</h2>
          <p style={{ color: T.text, fontSize: 13, lineHeight: 1.55, marginTop: 8 }}>
            Search any user (including showcase). Reset trading or assign Basic / Pro plan (1-month cycle, auto-expires).
          </p>
          <input
            value={userResetQ}
            onChange={(e) => setUserResetQ(e.target.value)}
            placeholder="User naam ya email (min 2 letters)"
            style={{ ...inputStyle, marginTop: 14, marginBottom: 0 }}
          />
          <div style={{ marginTop: 14 }}>
            {userResetBusy ? (
              <p style={{ color: T.text, fontSize: 13 }}>Searching…</p>
            ) : userResetQ.trim().length >= 2 && userResetResults.length === 0 ? (
              <p style={{ color: T.text, fontSize: 13 }}>Koi real user nahi mila.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                {userResetResults.map((u) => (
                  <div
                    key={u.uid}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: T.card,
                      border: `1px solid ${T.border}`
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: T.white, fontWeight: 800, fontSize: 14 }}>
                        {u.name || 'Trader'}
                        {u.isShowcase ? (
                          <span style={{ color: T.text, fontWeight: 600, fontSize: 11, marginLeft: 6 }}>showcase</span>
                        ) : null}
                      </div>
                      <div style={{ color: T.text, fontSize: 12, marginTop: 2 }}>{u.email || '—'}</div>
                      <div style={{ color: T.text, fontSize: 11, marginTop: 4 }}>
                        Balance ${Number(u.virtualBalance || 0).toLocaleString()} · P/L $
                        {Number(u.lifetimeRealizedPnl || 0).toLocaleString()}
                        <span style={{ marginLeft: 8 }}>
                          · Followers {Number(u.followerCount || 0).toLocaleString()}
                        </span>
                        {u.isPaidMember && u.paidPlanType ? (
                          <span
                            style={{
                              color: PLAN_CATALOG[u.paidPlanType]?.accent || '#0095F6',
                              fontWeight: 800,
                              marginLeft: 8
                            }}
                          >
                            ✓ {getPlanAdminLabel(u.paidPlanType) || u.paidPlanType}
                          </span>
                        ) : null}
                      </div>
                      <code style={{ color: T.yellow, fontSize: 10, wordBreak: 'break-all', display: 'block', marginTop: 4 }}>
                        {u.uid}
                      </code>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          value={followerDeltaByUid[u.uid] ?? ''}
                          onChange={(e) =>
                            setFollowerDeltaByUid((prev) => ({
                              ...prev,
                              [u.uid]: e.target.value.replace(/[^\d]/g, '').slice(0, 3)
                            }))
                          }
                          placeholder="12"
                          style={{
                            width: 58,
                            padding: '6px 8px',
                            borderRadius: 6,
                            border: `1px solid ${T.border}`,
                            background: '#0a0a0a',
                            color: T.white,
                            fontSize: 12
                          }}
                        />
                        <button
                          type="button"
                          disabled={!!resettingUid || !!togglingPaidUid || !!adjustingFollowersUid || lbBusy}
                          onClick={() => adjustFollowersForUser(u, 'increase')}
                          style={{
                            padding: '6px 8px',
                            borderRadius: 6,
                            border: 'none',
                            background: T.green,
                            color: '#000',
                            fontWeight: 800,
                            fontSize: 11,
                            cursor: adjustingFollowersUid ? 'wait' : 'pointer',
                            opacity: adjustingFollowersUid === u.uid ? 0.7 : 1
                          }}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          disabled={!!resettingUid || !!togglingPaidUid || !!adjustingFollowersUid || lbBusy}
                          onClick={() => adjustFollowersForUser(u, 'decrease')}
                          style={{
                            padding: '6px 8px',
                            borderRadius: 6,
                            border: `1px solid ${T.border}`,
                            background: T.card2,
                            color: T.white,
                            fontWeight: 800,
                            fontSize: 11,
                            cursor: adjustingFollowersUid ? 'wait' : 'pointer',
                            opacity: adjustingFollowersUid === u.uid ? 0.7 : 1
                          }}
                        >
                          -
                        </button>
                      </div>
                      {!u.isShowcase ? (
                        <button
                          type="button"
                          disabled={!!resettingUid || !!togglingPaidUid || lbBusy}
                          onClick={() => resetOneRealUser(u)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: 'none',
                            background: T.red,
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: 11,
                            cursor: resettingUid ? 'wait' : 'pointer',
                            opacity: resettingUid === u.uid ? 0.7 : 1
                          }}
                        >
                          {resettingUid === u.uid ? '…' : 'Reset'}
                        </button>
                      ) : null}
                      {PLAN_ORDER.map((planKey) => {
                        const p = PLAN_CATALOG[planKey];
                        const isActive = u.paidPlanType === planKey;
                        return (
                          <button
                            key={planKey}
                            type="button"
                            disabled={!!resettingUid || !!togglingPaidUid || lbBusy}
                            onClick={() => setPaidPlan(u, planKey)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 8,
                              border: isActive ? `1px solid ${p.accent}` : 'none',
                              background: isActive ? `${p.cardBg || 'rgba(0,0,0,0.2)'}` : p.accent,
                              color: isActive ? p.accent : '#fff',
                              fontWeight: 800,
                              fontSize: 11,
                              cursor: togglingPaidUid ? 'wait' : 'pointer',
                              opacity: togglingPaidUid === u.uid ? 0.7 : 1
                            }}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                      {u.isPaidMember ? (
                        <button
                          type="button"
                          disabled={!!resettingUid || !!togglingPaidUid || lbBusy}
                          onClick={() => setPaidPlan(u, 'none')}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: `1px solid ${T.border}`,
                            background: T.card2,
                            color: T.text,
                            fontWeight: 700,
                            fontSize: 11,
                            cursor: togglingPaidUid ? 'wait' : 'pointer'
                          }}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {lbMsg && tab === 'reset' ? (
            <p style={{ color: lbMsg.includes('done') || lbMsg.includes('Reset') ? T.green : T.red, fontSize: 13, marginTop: 14 }}>
              {lbMsg}
            </p>
          ) : null}
        </div>
      )}

      {tab === 'inbox' && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ color: T.white, fontSize: 16 }}>Showcase trader — chat mirror</h2>
          <p style={{ color: T.text, fontSize: 13, lineHeight: 1.55, marginTop: 8 }}>
            When someone messages a <strong style={{ color: T.white }}>showcase</strong> trader from the leaderboard or
            profile, a line appears here (trader name + sender).
          </p>
          {chatLogs.length === 0 ? (
            <p style={{ color: T.text, marginTop: 12 }}>No mirrored messages yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              {chatLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    background: T.card,
                    borderRadius: 12,
                    padding: 12,
                    border: `1px solid ${T.border}`,
                    fontSize: 13
                  }}
                >
                  <div style={{ color: T.yellow, fontWeight: 800 }}>
                    To: {log.peerShowcaseName || log.peerShowcaseId || 'Showcase'}
                  </div>
                  <div style={{ color: T.green, marginTop: 6, fontSize: 12 }}>
                    From: <span style={{ color: T.white, fontWeight: 700 }}>{log.fromName || log.fromUid}</span>
                    {log.fromUid ? (
                      <span style={{ color: T.text }}> · {log.fromUid}</span>
                    ) : null}
                  </div>
                  <div style={{ color: T.text, fontSize: 11, marginTop: 4 }}>
                    {log.createdAt
                      ? new Date(log.createdAt).toLocaleString()
                      : log.created_at
                        ? new Date(log.created_at).toLocaleString()
                        : ''}
                  </div>
                  <div style={{ color: T.white, marginTop: 10, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {log.text}
                  </div>
                  {log.imageUrl ? (
                    <a href={log.imageUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: 10 }}>
                      <img
                        src={log.imageUrl}
                        alt=""
                        style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 10, display: 'block' }}
                      />
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 6,
  padding: 12,
  borderRadius: 10,
  border: `1px solid ${T.border}`,
  background: T.card2,
  color: T.white,
  fontSize: 14
};
