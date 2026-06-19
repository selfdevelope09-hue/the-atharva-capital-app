import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../authContext';
import { Card, Btn } from '../components/ui/AppPrimitives';
import { T } from '../app/theme';
import { bff } from '../api/serverBff';
import { runMonthlyReset, backfillLeaderboardPnl } from '../api/adminDevApi';
import { fetchAdminEditors, fetchBlockedUids, blockUid, unblockUid } from '../api/adminDevApi';
import { adjustFollowers, removePlatformUser, restorePlatformUser, toggleCommunityRoom, fetchAdminCommunityRoomStatuses, enableAllCommunityRooms } from '../api/adminDevApi';
import { clearLeaderboardClientCacheAndNotify } from '../utils/leaderboardClientCache';

export default function DeveloperPlatformPanel() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blockedUids, setBlockedUids] = useState([]);
  const [targetUid, setTargetUid] = useState('');
  const [userSearchQ, setUserSearchQ] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [userSearchBusy, setUserSearchBusy] = useState(false);
  const [resettingUid, setResettingUid] = useState('');
  const [deletingUid, setDeletingUid] = useState('');
  const [adjustingUid, setAdjustingUid] = useState('');
  const [followerDeltaByUid, setFollowerDeltaByUid] = useState({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [roomStatuses, setRoomStatuses] = useState([]);
  const searchDebounceRef = useRef(null);

  const uid = user?.uid;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!uid) {
        setAllowed(false);
        setLoading(false);
        return;
      }
      try {
        const list = await fetchAdminEditors();
        if (!cancelled) setAllowed(list.includes(uid));
      } catch {
        if (!cancelled) setAllowed(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (!allowed) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const u = await fetchBlockedUids();
        if (!cancelled) setBlockedUids(u);
      } catch {
        if (!cancelled) setBlockedUids([]);
      }
    };
    load();
    const id = window.setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return undefined;
    let cancelled = false;
    const loadRooms = async () => {
      try {
        const j = await fetchAdminCommunityRoomStatuses();
        if (!cancelled) setRoomStatuses(Array.isArray(j.rooms) ? j.rooms : []);
      } catch {
        if (!cancelled) setRoomStatuses([]);
      }
    };
    loadRooms();
    const id = window.setInterval(loadRooms, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [allowed]);

  const blockUser = async () => {
    const id = String(targetUid || '').trim();
    if (!id) {
      setMsg('Enter a Firebase UID.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const j = await blockUid(id);
      setBlockedUids(j.blockedUids || []);
      setMsg(`Blocked ${id}`);
      setTargetUid('');
    } catch (e) {
      setMsg(e?.message || 'Block failed.');
    }
    setBusy(false);
  };

  const unblockUser = async (id) => {
    setBusy(true);
    setMsg('');
    try {
      const j = await unblockUid(id);
      setBlockedUids(j.blockedUids || []);
      setMsg(`Unblocked ${id}`);
    } catch (e) {
      setMsg(e?.message || 'Unblock failed.');
    }
    setBusy(false);
  };

  useEffect(() => {
    if (!allowed) return undefined;
    const q = userSearchQ.trim();
    if (q.length < 2) {
      setUserSearchResults([]);
      setUserSearchBusy(false);
      return undefined;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setUserSearchBusy(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const j = await bff('/api/admin/search-users', {
          method: 'POST',
          body: JSON.stringify({ q })
        });
        setUserSearchResults(Array.isArray(j.users) ? j.users : []);
      } catch {
        setUserSearchResults([]);
      } finally {
        setUserSearchBusy(false);
      }
    }, 350);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [allowed, userSearchQ]);

  const resetOneUser = useCallback(async (u) => {
    const label = u.name || u.email || u.uid;
    if (
      !window.confirm(
        `${label} ka account reset?\n\n• Balance $10,000\n• Positions / trade history clear\n• Leaderboard P/L $0 se`
      )
    ) {
      return;
    }
    setResettingUid(u.uid);
    setMsg('');
    try {
      const j = await bff('/api/admin/reset-user-trading', {
        method: 'POST',
        body: JSON.stringify({ targetUid: u.uid })
      });
      clearLeaderboardClientCacheAndNotify();
      setUserSearchResults((prev) =>
        prev.map((row) =>
          row.uid === u.uid
            ? { ...row, virtualBalance: j.virtualBalance ?? 10000, lifetimeRealizedPnl: 0 }
            : row
        )
      );
      setMsg(`Reset done: ${j.name || label} — $10k balance, leaderboard P/L zero.`);
    } catch (e) {
      setMsg(e?.message || 'User reset failed.');
    }
    setResettingUid('');
  }, []);

  const deleteOneUser = useCallback(async (u) => {
    const label = u.name || u.email || u.uid;
    if (
      !window.confirm(
        `${label} ko delete karna hai?\n\n• Group / leaderboard par "Removed user" dikhega\n• Trade, chat, kuch bhi nahi kar sakta\n• Purani chats delete NAHI hongi`
      )
    ) {
      return;
    }
    setDeletingUid(u.uid);
    setMsg('');
    try {
      const j = await removePlatformUser(u.uid);
      setUserSearchResults((prev) =>
        prev.map((row) =>
          row.uid === u.uid ? { ...row, name: 'Removed user', accountRemoved: true } : row
        )
      );
      setMsg(`Removed: ${j.name || label} — ab "Removed user" dikhega, actions band.`);
    } catch (e) {
      setMsg(e?.message || 'Delete user failed.');
    }
    setDeletingUid('');
  }, []);

  const restoreOneUser = useCallback(async (u) => {
    const label = u.name || u.email || u.uid;
    if (!window.confirm(`${label} ko restore karna hai? Wapas trade/chat kar payega.`)) return;
    setDeletingUid(u.uid);
    setMsg('');
    try {
      const j = await restorePlatformUser(u.uid);
      setUserSearchResults((prev) =>
        prev.map((row) =>
          row.uid === u.uid ? { ...row, name: j.name || row.name, accountRemoved: false } : row
        )
      );
      setMsg(`Restored: ${j.name || label}`);
    } catch (e) {
      setMsg(e?.message || 'Restore failed.');
    }
    setDeletingUid('');
  }, []);

  const resetAllTrading = useCallback(async () => {
    if (
      !window.confirm(
        'Monthly reset?\n\nReal + showcase · Free $10k · Basic $20k · Pro $50k · trades/P/L clear · showcase names safe.'
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const j = await runMonthlyReset();
      if (j?.clearLeaderboardClientCache !== false) clearLeaderboardClientCacheAndNotify();
      setMsg(
        `Monthly reset done. Users: ${j.postgresUsersUpdated ?? '?'}. Showcase rows: ${j.showcaseRowsUpdated ?? '?'}. ${j.balanceNote || ''}`
      );
    } catch (e) {
      setMsg(e?.payload?.error || e?.message || 'Monthly reset failed.');
    }
    setBusy(false);
  }, []);

  const adjustFollowersForUser = useCallback(
    async (u, action) => {
      const raw = followerDeltaByUid[u.uid];
      const count = Math.max(1, Math.min(500, parseInt(String(raw || ''), 10) || 0));
      if (!count) {
        setMsg('Followers count daalo (1-500).');
        return;
      }
      setAdjustingUid(u.uid);
      setMsg('');
      try {
        const j = await adjustFollowers(u.uid, action, count);
        setUserSearchResults((prev) =>
          prev.map((row) => (row.uid === u.uid ? { ...row, followerCount: Number(j.followerCount) || 0 } : row))
        );
        setMsg(
          `${action === 'increase' ? 'Increase' : 'Decrease'} done for ${u.name || u.email || u.uid}. Applied ${j.applied || 0}/${count} showcase followers.`
        );
      } catch (e) {
        setMsg(e?.message || 'Followers update failed.');
      }
      setAdjustingUid('');
    },
    [followerDeltaByUid]
  );

  if (!user) {
    return (
      <div style={{ padding: 20, color: T.text }}>
        <Link to="/login" style={{ color: T.yellow }}>
          Sign in
        </Link>{' '}
        to open the developer panel.
      </div>
    );
  }
  if (loading) {
    return <div style={{ padding: 20, color: T.text }}>Checking access…</div>;
  }
  if (!allowed) {
    return (
      <div style={{ padding: 20, color: T.text }}>
        Access denied. Your UID must be listed in platform admin config (Postgres / DigitalOcean).
      </div>
    );
  }

  return (
    <div style={{ padding: '16px clamp(12px, 3vw, 24px)', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ color: T.white, margin: 0, fontSize: 22 }}>Platform admin</h1>
        <button type="button" onClick={() => navigate(-1)} style={{ background: T.card2, color: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>
          Back
        </button>
      </div>
      <p style={{ color: T.text, fontSize: 14, lineHeight: 1.5 }}>
        Same access as stock-tip editors. Mass reset uses the secure Vercel API (Supabase + Firestore users).
      </p>
      <Link to="/developer/rewards" style={{ color: T.yellow, fontSize: 13, fontWeight: 700 }}>
        Rewards CMS →
      </Link>

      <Card style={{ marginTop: 18, padding: 16 }}>
        <h2 style={{ color: T.white, marginTop: 0, fontSize: 16 }}>Ek user reset (real account)</h2>
        <p style={{ color: T.text, fontSize: 13, lineHeight: 1.45 }}>
          Naam ya email se dhundho — side mein Reset + Followers controls. Real aur showcase dono users par kaam karega.
        </p>
        <input
          value={userSearchQ}
          onChange={(e) => setUserSearchQ(e.target.value)}
          placeholder="User naam ya email (min 2 letters)"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            marginTop: 10,
            padding: '10px 12px',
            borderRadius: 8,
            border: `1px solid ${T.border}`,
            background: '#0a0a0a',
            color: T.white,
            fontSize: 13
          }}
        />
        <div style={{ marginTop: 10 }}>
          {userSearchBusy ? (
            <span style={{ color: T.text, fontSize: 13 }}>Searching…</span>
          ) : userSearchQ.trim().length >= 2 && userSearchResults.length === 0 ? (
            <span style={{ color: T.text, fontSize: 13 }}>Koi user nahi mila.</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {userSearchResults.map((u) => (
                <div
                  key={u.uid}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: T.card2,
                    border: `1px solid ${T.border}`
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: T.white, fontWeight: 700, fontSize: 14 }}>
                      {u.name || 'Trader'}
                      {u.accountRemoved ? (
                        <span style={{ marginLeft: 8, color: T.red, fontSize: 11, fontWeight: 800 }}>
                          Removed user
                        </span>
                      ) : null}
                    </div>
                    <div style={{ color: T.text, fontSize: 12, marginTop: 2 }}>{u.email || '—'}</div>
                    <div style={{ color: T.text, fontSize: 11, marginTop: 4 }}>
                      Balance ${Number(u.virtualBalance || 0).toLocaleString()} · P/L $
                      {Number(u.lifetimeRealizedPnl || 0).toLocaleString()}
                    </div>
                    <div style={{ color: T.text, fontSize: 11, marginTop: 2 }}>
                      Followers {Number(u.followerCount || 0).toLocaleString()} · {u.isShowcase ? 'Showcase' : 'Real'}
                    </div>
                    <code style={{ color: T.yellow, fontSize: 10, wordBreak: 'break-all', display: 'block', marginTop: 4 }}>
                      {u.uid}
                    </code>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    <button
                      type="button"
                      disabled={busy || !!resettingUid || !!deletingUid || u.accountRemoved}
                      onClick={() => resetOneUser(u)}
                      style={{
                        flexShrink: 0,
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: 'none',
                        background: T.red,
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: busy || resettingUid || deletingUid || u.accountRemoved ? 'not-allowed' : 'pointer',
                        opacity: resettingUid === u.uid ? 0.7 : u.accountRemoved ? 0.45 : 1
                      }}
                    >
                      {resettingUid === u.uid ? '…' : 'Reset'}
                    </button>
                    {u.accountRemoved ? (
                      <button
                        type="button"
                        disabled={busy || !!deletingUid}
                        onClick={() => restoreOneUser(u)}
                        style={{
                          flexShrink: 0,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: `1px solid ${T.green}`,
                          background: 'transparent',
                          color: T.green,
                          fontWeight: 800,
                          fontSize: 12,
                          cursor: busy || deletingUid ? 'wait' : 'pointer',
                          opacity: deletingUid === u.uid ? 0.7 : 1
                        }}
                      >
                        {deletingUid === u.uid ? '…' : 'Restore'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy || !!resettingUid || !!deletingUid}
                        onClick={() => deleteOneUser(u)}
                        style={{
                          flexShrink: 0,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: `1px solid ${T.red}`,
                          background: 'rgba(220,38,38,0.12)',
                          color: T.red,
                          fontWeight: 800,
                          fontSize: 12,
                          cursor: busy || resettingUid || deletingUid ? 'wait' : 'pointer',
                          opacity: deletingUid === u.uid ? 0.7 : 1
                        }}
                      >
                        {deletingUid === u.uid ? '…' : 'Delete user'}
                      </button>
                    )}
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
                        disabled={busy || !!adjustingUid}
                        onClick={() => adjustFollowersForUser(u, 'increase')}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: 'none',
                          background: T.green,
                          color: '#000',
                          fontWeight: 800,
                          fontSize: 11,
                          cursor: busy || adjustingUid ? 'wait' : 'pointer',
                          opacity: adjustingUid === u.uid ? 0.7 : 1
                        }}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        disabled={busy || !!adjustingUid}
                        onClick={() => adjustFollowersForUser(u, 'decrease')}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: `1px solid ${T.border}`,
                          background: T.card2,
                          color: T.white,
                          fontWeight: 800,
                          fontSize: 11,
                          cursor: busy || adjustingUid ? 'wait' : 'pointer',
                          opacity: adjustingUid === u.uid ? 0.7 : 1
                        }}
                      >
                        -
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card style={{ marginTop: 16, padding: 16 }}>
        <h2 style={{ color: T.white, marginTop: 0, fontSize: 16 }}>Monthly reset</h2>
        <p style={{ color: T.text, fontSize: 13, lineHeight: 1.45 }}>
          Real + showcase sab users: free $10,000, Basic paid $20,000, Pro paid $50,000. Trades aur P/L clear. Showcase
          board zero — names safe. Leaderboard live dubara rank karega.
        </p>
        <Btn
          type="button"
          onClick={resetAllTrading}
          disabled={busy}
          style={{ background: T.yellow, color: '#000', border: 'none', fontWeight: 900 }}
        >
          {busy ? 'Working…' : 'Monthly reset'}
        </Btn>
      </Card>

      <Card style={{ marginTop: 16, padding: 16 }}>
        <h2 style={{ color: T.white, marginTop: 0, fontSize: 16 }}>Leaderboard P/L sync</h2>
        <p style={{ color: T.text, fontSize: 13, lineHeight: 1.45 }}>
          Agar users ne trade close kiya hai par leaderboard par P/L $0 dikhe, yeh button closed trades se Postgres{' '}
          <code style={{ color: T.yellow }}>lifetime_realized_pnl</code> dubara calculate karega.
        </p>
        <Btn
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMsg('');
            try {
              const j = await backfillLeaderboardPnl();
              if (j?.clearLeaderboardClientCache !== false) clearLeaderboardClientCacheAndNotify();
              setMsg(`Leaderboard P/L synced for ${j.usersUpdated ?? 0} user(s).`);
            } catch (e) {
              setMsg(e?.message || 'P/L sync failed.');
            }
            setBusy(false);
          }}
          style={{ background: T.card2, color: T.white, border: `1px solid ${T.border}`, fontWeight: 800 }}
        >
          {busy ? 'Working…' : 'Sync leaderboard P/L'}
        </Btn>
      </Card>

      <Card style={{ marginTop: 16, padding: 16 }}>
        <h2 style={{ color: T.white, marginTop: 0, fontSize: 16 }}>Block / unblock user</h2>
        <p style={{ color: T.text, fontSize: 13, lineHeight: 1.45 }}>
          Blocked users cannot call <code style={{ color: T.yellow }}>/api/data/me</code> or open trades (BFF). They are
          hidden from the server leaderboard and should be signed out on next profile refresh.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <input
            value={targetUid}
            onChange={(e) => setTargetUid(e.target.value)}
            placeholder="Firebase UID to block"
            style={{
              flex: 1,
              minWidth: 200,
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: '#0a0a0a',
              color: T.white,
              fontSize: 13
            }}
          />
          <Btn type="button" onClick={blockUser} disabled={busy} style={{ background: T.yellow, color: '#000', fontWeight: 800 }}>
            Block
          </Btn>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ color: T.text, fontSize: 12, marginBottom: 6 }}>Blocked ({blockedUids.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
            {blockedUids.length === 0 ? (
              <span style={{ color: T.text, fontSize: 13 }}>None</span>
            ) : (
              blockedUids.map((id) => (
                <div
                  key={id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: T.card2,
                    border: `1px solid ${T.border}`
                  }}
                >
                  <code style={{ color: T.white, fontSize: 11, wordBreak: 'break-all' }}>{id}</code>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => unblockUser(id)}
                    style={{
                      flexShrink: 0,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: `1px solid ${T.green}`,
                      background: 'transparent',
                      color: T.green,
                      fontWeight: 700,
                      cursor: busy ? 'wait' : 'pointer',
                      fontSize: 12
                    }}
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      <Card style={{ marginTop: 18, padding: 16 }}>
        <h2 style={{ color: T.white, marginTop: 0, fontSize: 16 }}>Group chat control</h2>
        <p style={{ color: T.text, fontSize: 13, lineHeight: 1.45 }}>
          Community band karne ke baad wapas <strong style={{ color: T.green }}>Enable</strong> kar sakte ho — chat screen par bhi admin ko Enable button dikhega.
        </p>
        <Btn
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMsg('');
            try {
              const j = await enableAllCommunityRooms();
              setRoomStatuses(Array.isArray(j.rooms) ? j.rooms : []);
              setMsg('All group chats enabled.');
            } catch (e) {
              setMsg(e?.message || 'Enable all failed.');
            }
            setBusy(false);
          }}
          style={{ marginTop: 10, background: T.green, color: '#fff', fontSize: 13 }}
        >
          Enable all group chats
        </Btn>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          {(
            roomStatuses.length
              ? roomStatuses
              : [
                  { roomId: 'community', displayName: 'Aurox trade Community', chatEnabled: true },
                  { roomId: 'roast', displayName: 'Roast Community', chatEnabled: true }
                ]
          ).map((room) => {
            const label = room.displayName || room.roomId;
            const on = room.chatEnabled !== false;
            return (
              <div
                key={room.roomId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: T.card2,
                  border: `1px solid ${on ? 'rgba(0,168,132,0.35)' : 'rgba(246,70,93,0.45)'}`
                }}
              >
                <div>
                  <div style={{ color: T.white, fontWeight: 700, fontSize: 14 }}>{label}</div>
                  <div style={{ color: on ? T.green : T.red, fontSize: 12, marginTop: 2 }}>
                    {on ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
                <Btn
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    const next = !on;
                    if (!next && !window.confirm(`${label} chat band karni hai?`)) return;
                    setBusy(true);
                    setMsg('');
                    try {
                      const j = await toggleCommunityRoom(room.roomId, next);
                      setRoomStatuses(Array.isArray(j.rooms) ? j.rooms : []);
                      setMsg(`${label} ${next ? 'enabled' : 'disabled'}.`);
                    } catch (e) {
                      setMsg(e?.message || 'Toggle failed.');
                    }
                    setBusy(false);
                  }}
                  style={{
                    background: on ? T.red : T.green,
                    color: '#fff',
                    fontSize: 12,
                    minWidth: 88
                  }}
                >
                  {on ? 'Disable' : 'Enable'}
                </Btn>
              </div>
            );
          })}
        </div>
      </Card>

      {msg ? (
        <div style={{ marginTop: 14, color: T.text, fontSize: 13, whiteSpace: 'pre-wrap' }}>
          {msg}
        </div>
      ) : null}
    </div>
  );
}
