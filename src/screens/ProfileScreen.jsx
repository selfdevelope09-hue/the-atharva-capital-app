import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot
} from 'firebase/firestore';
import { AuthContext } from '../authContext';
import { db } from '../firebaseClient';
import { activateBffQuotaFallback, isBffDataMode, isSupabaseFallbackEnabled } from '../config/dataBackend';
import { bff } from '../api/serverBff';
import { shouldFallbackFromFirestoreToSupabase } from '../utils/firestoreQuota';
import { T } from '../app/theme';
import PaidMemberBadge, { PlanTierChip } from '../components/PaidMemberBadge';
import { isPaidMember } from '../config/paidPlan';
import { Card, Btn } from '../components/ui/AppPrimitives';
import { avatarLetterGradient, avatarLetterTextColor } from '../utils/avatarLetterColor';
import LeaderboardRowAvatar from '../components/LeaderboardRowAvatar';
import { toUidList } from '../utils/userDoc';
import { maybeMigrateFollowArrays } from '../utils/googleProfileSync';
import { useHotPrices } from '../hooks/useHotPrices';
import { grossPnlUsdt, quantityFromNotional, liquidationPrice } from '../tradingEngine';
import { adminLiquidatePosition } from '../api/adminDevApi';
import { notifyLeaderboardBackgroundRefresh } from '../utils/leaderboardClientCache';
import { lookupLivePrice, normalizeBinanceSymbol, parseLiveMarkPrice } from '../utils/marketSymbol';
import {
  profilePhotoReferrerPolicy,
  resolveProfilePhotoFromUser
} from '../utils/profilePhotoUrl';
import { withTradeAsBody } from '../utils/chatAsUid';
import { AppLoginCredentials } from '../components/AppLoginCredentials';
import { useTipEditorAccess } from '../hooks/useTipEditorAccess';

export const ProfileScreen = () => {
  const [bffModeRev, setBffModeRev] = useState(0);
  const { userId: userIdParam } = useParams();
  const profileUid = useMemo(() => {
    if (!userIdParam) return '';
    try {
      return decodeURIComponent(userIdParam);
    } catch {
      return userIdParam;
    }
  }, [userIdParam]);
  const { user, userData, refreshUser, actingAsUid, isActingAsShowcase } = useContext(AuthContext);
  const prices = useHotPrices();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('trades');
  const [followBusy, setFollowBusy] = useState(false);
  const [followMsg, setFollowMsg] = useState(null);
  const [relationList, setRelationList] = useState([]);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const [liquidatingIdx, setLiquidatingIdx] = useState(-1);
  const [adminLiqMsg, setAdminLiqMsg] = useState('');
  const isSelf = user && user.uid === profileUid;
  const { isEditor: isDevEditor } = useTipEditorAccess();
  const profilePhotoSrc = useMemo(
    () => resolveProfilePhotoFromUser(profile, { user, userData, isSelf }),
    [profile, user, userData, isSelf]
  );
  const avatarSize = isSelf ? 104 : 88;

  useEffect(() => {
    const fn = () => setBffModeRev((x) => x + 1);
    window.addEventListener('auron-bff-mode', fn);
    return () => window.removeEventListener('auron-bff-mode', fn);
  }, []);

  const mapProfileDoc = useCallback((d, id) => ({
    ...d,
    id: id || d.uid,
    positions: d.positions || [],
    closedPositions: d.closedPositions || [],
    followers: toUidList(d.followers),
    following: toUidList(d.following)
  }), []);

  const reloadProfile = useCallback(async () => {
    if (!profileUid) return null;
    if (isBffDataMode()) {
      const j = await bff(`/api/data/user-public?uid=${encodeURIComponent(profileUid)}`);
      if (!j.user) {
        setProfile(null);
        return null;
      }
      const next = mapProfileDoc(j.user, j.user.uid);
      setProfile(next);
      return next;
    }
    const snap = await getDoc(doc(db, 'users', profileUid));
    if (!snap.exists()) {
      setProfile(null);
      return null;
    }
    const next = mapProfileDoc(snap.data(), snap.id);
    setProfile(next);
    return next;
  }, [profileUid, mapProfileDoc, bffModeRev]);

  useEffect(() => {
    if (!profileUid) {
      setProfile(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    if (isBffDataMode()) {
      const load = () =>
        reloadProfile()
          .catch((e) => {
            console.error('profile poll', e);
            setProfile(null);
          })
          .finally(() => setLoading(false));
      load();
      const id = window.setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        reloadProfile().catch(() => {});
      }, 20000);
      return () => clearInterval(id);
    }
    const ref = doc(db, 'users', profileUid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setProfile(null);
        } else {
          const d = snap.data();
          setProfile({
            ...d,
            id: snap.id,
            positions: d.positions || [],
            closedPositions: d.closedPositions || [],
            followers: toUidList(d.followers),
            following: toUidList(d.following)
          });
        }
        setLoading(false);
      },
      (e) => {
        console.error('profile snapshot', e);
        if (shouldFallbackFromFirestoreToSupabase(e) && isSupabaseFallbackEnabled()) activateBffQuotaFallback();
        setProfile(null);
        setLoading(false);
      }
    );
    return unsub;
  }, [profileUid, bffModeRev, reloadProfile]);

  useEffect(() => {
    setFollowMsg(null);
    setAdminLiqMsg('');
  }, [profileUid]);

  const liquidateUserPosition = async (pos, uiIndex) => {
    if (!isDevEditor || isSelf || !profileUid) return;
    const sym = normalizeBinanceSymbol(pos.symbol);
    const entry = Number(pos.entryPrice || 0);
    const lev = Number(pos.leverage) || 1;
    const liq = liquidationPrice(pos.type, entry, lev);
    const liqLabel = Number.isFinite(liq) ? `$${liq.toFixed(2)}` : 'liq price';
    if (
      !window.confirm(
        `Liquidate ${sym} ${pos.type} ${lev}x for ${profile?.name || profileUid}?\n\n` +
          `Exit at ${liqLabel} — trade history mein LIQUIDATED dikhega (natural).`
      )
    ) {
      return;
    }
    setLiquidatingIdx(uiIndex);
    setAdminLiqMsg('');
    try {
      await adminLiquidatePosition(profileUid, uiIndex, {
        symbol: sym,
        type: pos.type,
        entryPrice: pos.entryPrice,
        margin: pos.margin,
        totalSize: pos.totalSize,
        leverage: pos.leverage,
        positionId: pos.positionId
      });
      await reloadProfile();
      notifyLeaderboardBackgroundRefresh();
      setAdminLiqMsg(`Liquidated ${sym} ${pos.type} at ${liqLabel}.`);
    } catch (err) {
      setAdminLiqMsg(err?.message || 'Liquidation failed.');
    }
    setLiquidatingIdx(-1);
  };

  useEffect(() => {
    setAvatarBroken(false);
  }, [profileUid, profilePhotoSrc]);


  useEffect(() => {
    const loadIds = async () => {
      if (!profile || tab === 'trades') {
        setRelationList([]);
        return;
      }
      const ids = tab === 'followers' ? profile.followers : profile.following;
      if (!ids?.length) {
        setRelationList([]);
        return;
      }
      const sliced = ids.slice(0, 50);
      let rows = [];
      if (isBffDataMode()) {
        const j = await bff('/api/data/users-bulk', {
          method: 'POST',
          body: JSON.stringify({ uids: sliced })
        });
        rows = (j.users || []).map((x) => ({
          id: x.uid,
          name: x.name || 'Trader',
          photoURL: x.photoURL || '',
          virtualBalance: x.virtualBalance ?? 0,
          followers: toUidList(x.followers).length,
          following: toUidList(x.following).length
        }));
      } else {
        const snaps = await Promise.all(sliced.map((id) => getDoc(doc(db, 'users', id))));
        rows = snaps.filter((s) => s.exists()).map((s) => {
          const x = s.data();
          return {
            id: s.id,
            name: x.name || 'Trader',
            photoURL: x.photoURL || '',
            virtualBalance: x.virtualBalance ?? 0,
            followers: toUidList(x.followers).length,
            following: toUidList(x.following).length
          };
        });
      }
      setRelationList(rows);
    };
    loadIds();
  }, [profile, tab]);

  const amFollowing =
    user && userData && profileUid && toUidList(userData.following).includes(profileUid);

  const toggleFollow = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (isSelf || !profileUid) return;
    setFollowBusy(true);
    setFollowMsg(null);
    try {
      await maybeMigrateFollowArrays(user.uid);
      if (isBffDataMode()) {
        await bff('/api/social/follow-bff', {
          method: 'POST',
          body: JSON.stringify(
            withTradeAsBody(
              { targetUid: profileUid, action: amFollowing ? 'unfollow' : 'follow' },
              actingAsUid,
              isActingAsShowcase
            )
          )
        });
        await refreshUser();
        setFollowBusy(false);
        return;
      } else {
        try {
          const meRef = doc(db, 'users', user.uid);
          const themRef = doc(db, 'users', profileUid);
          if (amFollowing) {
            await updateDoc(themRef, { followers: arrayRemove(user.uid) });
            await updateDoc(meRef, { following: arrayRemove(profileUid) });
          } else {
            await updateDoc(themRef, { followers: arrayUnion(user.uid) });
            await updateDoc(meRef, { following: arrayUnion(profileUid) });
          }
        } catch (e) {
          if (shouldFallbackFromFirestoreToSupabase(e) && isSupabaseFallbackEnabled()) {
            activateBffQuotaFallback();
            await bff('/api/social/follow-bff', {
              method: 'POST',
              body: JSON.stringify(
                withTradeAsBody(
                  { targetUid: profileUid, action: amFollowing ? 'unfollow' : 'follow' },
                  actingAsUid,
                  isActingAsShowcase
                )
              )
            });
          } else throw e;
        }
      }
      await refreshUser();
    } catch (e) {
      console.error(e);
      setFollowMsg(
        e?.code === 'permission-denied'
          ? 'Permission error. Refresh the page and try again. If a partial follow happened earlier, unfollow first and then follow again.'
          : e?.message || 'Could not complete follow action. Please check your network and retry.'
      );
    }
    setFollowBusy(false);
  };

  const tradesCount =
    (profile?.positions?.length || 0) + (profile?.closedPositions?.length || 0);
  const followersCount = profile?.followers?.length || 0;
  const followingCount = profile?.following?.length || 0;

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: T.text }}>Loading profile…</div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: T.text }}>
        Trader not found.
        <div style={{ marginTop: 16 }}>
          <Link to="/leaderboard" style={{ color: T.yellow }}>
            ← Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const initial = (profile.name || 'T').charAt(0).toUpperCase();

  return (
    <div style={{ padding: '20px 16px 40px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/leaderboard" style={{ color: T.text, fontSize: 13, textDecoration: 'none' }}>
          ← Leaderboard
        </Link>
      </div>

      <Card
        style={{
          marginBottom: 20,
          border: `1px solid rgba(240,185,11,0.2)`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 20,
          alignItems: 'flex-start'
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (profilePhotoSrc && !avatarBroken) setPhotoPreviewOpen(true);
          }}
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: '50%',
            background: avatarLetterGradient(profileUid || profile.name),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.round(avatarSize * 0.4),
            fontWeight: 900,
            color: avatarLetterTextColor(),
            flexShrink: 0,
            border: `3px solid ${T.card2}`,
            overflow: 'hidden',
            cursor: profilePhotoSrc && !avatarBroken ? 'zoom-in' : 'default',
            padding: 0
          }}
        >
          {profilePhotoSrc && !avatarBroken ? (
            <img
              src={profilePhotoSrc}
              alt=""
              referrerPolicy={profilePhotoReferrerPolicy(profilePhotoSrc)}
              width={avatarSize}
              height={avatarSize}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setAvatarBroken(true)}
            />
          ) : (
            initial
          )}
        </button>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <h1 style={{ margin: 0, color: T.white, fontSize: 22, fontWeight: 800 }}>
              {profile.name || 'Trader'}
              {isPaidMember(profile) ? <PaidMemberBadge size={18} /> : null}
              {isPaidMember(profile) ? <PlanTierChip planType={profile.paidPlanType} size="md" /> : null}
            </h1>
            {!isSelf && user && (
              <>
                <Btn
                  onClick={toggleFollow}
                  disabled={followBusy}
                  style={{
                    padding: '8px 20px',
                    width: 'auto',
                    backgroundColor: amFollowing ? T.card2 : T.yellow,
                    color: amFollowing ? T.white : '#000',
                    border: amFollowing ? `1px solid ${T.border}` : 'none'
                  }}
                >
                  {followBusy ? '…' : amFollowing ? 'Following' : 'Follow'}
                </Btn>
                <Link
                  to={`/chat?with=${encodeURIComponent(profileUid)}`}
                  style={{
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '8px 20px',
                    borderRadius: 6,
                    border: `1px solid ${T.yellow}`,
                    color: T.yellow,
                    fontWeight: 700,
                    fontSize: 15
                  }}
                >
                  Chat
                </Link>
              </>
            )}
            {!user && !isSelf && (
              <Link to="/login" style={{ textDecoration: 'none' }}>
                <Btn style={{ padding: '8px 20px', width: 'auto' }}>Follow</Btn>
              </Link>
            )}
          </div>
          {isSelf && (
            <Link
              to="/profile/edit"
              style={{
                display: 'inline-block',
                marginTop: 10,
                color: T.yellow,
                fontWeight: 700,
                fontSize: 13,
                textDecoration: 'none'
              }}
            >
              Edit profile (name, photo, bio)
            </Link>
          )}
          {isSelf && isDevEditor ? (
            <Link
              to="/developer/stock-tips"
              style={{
                display: 'inline-block',
                marginTop: 8,
                marginLeft: 0,
                color: T.white,
                fontWeight: 800,
                fontSize: 13,
                textDecoration: 'none',
                padding: '8px 14px',
                borderRadius: 8,
                border: `1px solid ${T.yellow}`,
                background: 'rgba(240,185,11,0.12)'
              }}
            >
              🛠 Developer panel
            </Link>
          ) : null}
          {profile.bio ? (
            <p
              style={{
                color: T.text,
                fontSize: 14,
                lineHeight: 1.5,
                margin: '12px 0 0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {profile.bio}
            </p>
          ) : null}
          {followMsg && (
            <div style={{ color: T.red, fontSize: 12, marginTop: 10, maxWidth: 420 }}>{followMsg}</div>
          )}
          <div style={{ color: T.text, fontSize: 13, marginTop: 8 }}>
            Virtual balance{' '}
            <span style={{ color: T.green, fontWeight: 700 }}>
              $
              {parseFloat(profile.virtualBalance || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2
              })}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 24,
              marginTop: 18,
              flexWrap: 'wrap'
            }}
          >
            <button
              type="button"
              onClick={() => setTab('trades')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                textAlign: 'left'
              }}
            >
              <span style={{ color: T.white, fontWeight: 800, fontSize: 18 }}>{tradesCount}</span>
              <span style={{ color: T.text, fontSize: 13, display: 'block' }}>Trades</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('followers')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                textAlign: 'left'
              }}
            >
              <span style={{ color: T.white, fontWeight: 800, fontSize: 18 }}>
                {followersCount}
              </span>
              <span style={{ color: T.text, fontSize: 13, display: 'block' }}>Followers</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('following')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                textAlign: 'left'
              }}
            >
              <span style={{ color: T.white, fontWeight: 800, fontSize: 18 }}>
                {followingCount}
              </span>
              <span style={{ color: T.text, fontSize: 13, display: 'block' }}>Following</span>
            </button>
          </div>
        </div>
      </Card>

      {isSelf && user ? (
        <AppLoginCredentials userData={userData} onUpdated={() => refreshUser?.()} />
      ) : null}

      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${T.border}`,
          marginBottom: 16,
          gap: 8
        }}
      >
        {[
          ['trades', 'Trades'],
          ['followers', 'Followers'],
          ['following', 'Following']
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: tab === id ? T.yellow : T.text,
              fontWeight: tab === id ? 800 : 500,
              fontSize: 14,
              borderBottom: tab === id ? `2px solid ${T.yellow}` : '2px solid transparent',
              marginBottom: -1
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'trades' && (
        <div>
          {isDevEditor && !isSelf && profile.positions?.length ? (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px dashed rgba(246,70,93,0.45)',
                background: 'rgba(246,70,93,0.06)',
                fontSize: 12,
                color: T.text,
                lineHeight: 1.5
              }}
            >
              <strong style={{ color: T.red }}>Admin only</strong> — Liquidate se position liq price par band
              hogi; user ko history mein normal LIQUIDATED dikhega.
              {adminLiqMsg ? (
                <div style={{ color: adminLiqMsg.startsWith('Liquidated') ? T.green : T.red, marginTop: 6, fontWeight: 700 }}>
                  {adminLiqMsg}
                </div>
              ) : null}
            </div>
          ) : null}
          <h3 style={{ color: T.white, fontSize: 16, marginBottom: 12 }}>Open positions</h3>
          {profile.positions?.length ? (
            profile.positions.map((pos, i) => (
              (() => {
                const sym = normalizeBinanceSymbol(pos.symbol);
                const mark =
                  parseLiveMarkPrice(lookupLivePrice(prices, sym)) ||
                  Number(pos.entryPrice ?? 0);
                const entry = Number(pos.entryPrice || 0);
                const lev = Number(pos.leverage) || 1;
                const liq = liquidationPrice(pos.type, entry, lev);
                const qty =
                  Number.isFinite(Number(pos.quantity)) && Number(pos.quantity) > 0
                    ? Number(pos.quantity)
                    : quantityFromNotional(Number(pos.totalSize || 0), entry);
                const pnl = grossPnlUsdt(pos.type, entry, mark, qty);
                return (
                  <Card
                    key={`o-${i}`}
                    style={{
                      marginBottom: 10,
                      borderLeft: `3px solid ${pos.type === 'LONG' ? T.green : T.red}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ color: pos.type === 'LONG' ? T.green : T.red, fontWeight: 700 }}>
                          {pos.symbol} {pos.type} {pos.leverage}x
                        </span>
                        <div style={{ color: T.text, fontSize: 12, marginTop: 6 }}>
                          Entry ${Number(pos.entryPrice).toFixed(2)} · Mark ${Number(mark).toFixed(2)} · Size $
                          {Number(pos.totalSize).toFixed(2)}
                        </div>
                        {Number.isFinite(liq) ? (
                          <div style={{ color: T.text, fontSize: 11, marginTop: 4 }}>
                            Liq ${liq.toFixed(2)}
                          </div>
                        ) : null}
                        <div style={{ color: pnl >= 0 ? T.green : T.red, fontSize: 12, marginTop: 4, fontWeight: 700 }}>
                          Live PnL: {pnl >= 0 ? '+' : ''}${Number.isFinite(pnl) ? pnl.toFixed(2) : '0.00'}
                        </div>
                      </div>
                      {isDevEditor && !isSelf ? (
                        <button
                          type="button"
                          disabled={liquidatingIdx >= 0}
                          onClick={() => liquidateUserPosition(pos, i)}
                          style={{
                            flexShrink: 0,
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: `1px solid ${T.red}`,
                            background: 'rgba(246,70,93,0.14)',
                            color: T.red,
                            fontWeight: 800,
                            fontSize: 11,
                            cursor: liquidatingIdx >= 0 ? 'wait' : 'pointer',
                            opacity: liquidatingIdx === i ? 0.65 : 1
                          }}
                        >
                          {liquidatingIdx === i ? '…' : 'Liquidate'}
                        </button>
                      ) : null}
                    </div>
                  </Card>
                );
              })()
            ))
          ) : (
            <Card style={{ color: T.text, textAlign: 'center', padding: 24 }}>No open positions.</Card>
          )}
          <h3 style={{ color: T.white, fontSize: 16, margin: '24px 0 12px' }}>Trade history</h3>
          {profile.closedPositions?.length ? (
            profile.closedPositions
              .slice()
              .reverse()
              .map((pos, idx) => (
                <Card key={`c-${idx}`} style={{ marginBottom: 8, opacity: 0.95 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <span
                      style={{
                        color:
                          pos.status === 'LIQUIDATED' || pos.closeReason === 'LIQUIDATED'
                            ? T.red
                            : pos.type === 'LONG'
                              ? T.green
                              : T.red,
                        fontWeight: 600
                      }}
                    >
                      {pos.symbol} {pos.type}
                      {pos.status === 'LIQUIDATED' || pos.closeReason === 'LIQUIDATED' ? ' • LIQUIDATED' : ''}
                    </span>
                    <span style={{ color: pos.realizedPnl >= 0 ? T.green : T.red, fontWeight: 600 }}>
                      {pos.realizedPnl >= 0 ? '+' : ''}${Number(pos.realizedPnl).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ color: T.text, fontSize: 12, marginTop: 4 }}>
                    {pos.closedAt ? new Date(pos.closedAt).toLocaleString() : ''}
                  </div>
                  <div style={{ color: T.text, fontSize: 12, marginTop: 4 }}>
                    Entry ${Number(pos.entryPrice || 0).toFixed(2)} → Exit $
                    {Number(pos.exitPrice ?? pos.entryPrice ?? 0).toFixed(2)} · Size $
                    {Number(pos.totalSize || 0).toFixed(2)} · {Number(pos.leverage || 1)}x
                  </div>
                </Card>
              ))
          ) : (
            <Card style={{ color: T.text, textAlign: 'center', padding: 24 }}>No closed trades yet.</Card>
          )}
        </div>
      )}

      {tab === 'followers' && (
        <div>
          {relationList.length === 0 ? (
            <Card style={{ color: T.text, textAlign: 'center', padding: 32 }}>No followers yet.</Card>
          ) : (
            relationList.map((r) => (
              <Link
                key={r.id}
                to={`/profile/${encodeURIComponent(r.id)}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <Card
                  style={{
                    marginBottom: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    border: `1px solid ${T.border}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <LeaderboardRowAvatar photoURL={r.photoURL} name={r.name} seed={r.uid || r.id} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: T.white, fontWeight: 700 }}>{r.name}</div>
                      <div style={{ color: T.text, fontSize: 12, marginTop: 4 }}>
                        {r.followers} followers · {r.following} following
                      </div>
                    </div>
                  </div>
                  <span style={{ color: T.green, fontWeight: 600 }}>
                    ${parseFloat(r.virtualBalance).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </Card>
              </Link>
            ))
          )}
        </div>
      )}

      {tab === 'following' && (
        <div>
          {relationList.length === 0 ? (
            <Card style={{ color: T.text, textAlign: 'center', padding: 32 }}>
              Not following anyone yet.
            </Card>
          ) : (
            relationList.map((r) => (
              <Link
                key={r.id}
                to={`/profile/${encodeURIComponent(r.id)}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <Card
                  style={{
                    marginBottom: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    border: `1px solid ${T.border}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <LeaderboardRowAvatar photoURL={r.photoURL} name={r.name} seed={r.uid || r.id} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: T.white, fontWeight: 700 }}>{r.name}</div>
                      <div style={{ color: T.text, fontSize: 12, marginTop: 4 }}>
                        {r.followers} followers · {r.following} following
                      </div>
                    </div>
                  </div>
                  <span style={{ color: T.green, fontWeight: 600 }}>
                    ${parseFloat(r.virtualBalance).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </Card>
              </Link>
            ))
          )}
        </div>
      )}
      {photoPreviewOpen && profilePhotoSrc && !avatarBroken && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPhotoPreviewOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 5000,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
        >
          <img
            src={profilePhotoSrc}
            alt={`${profile.name || 'Trader'} profile`}
            referrerPolicy={profilePhotoReferrerPolicy(profilePhotoSrc)}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(72vw, 300px)',
              aspectRatio: '1 / 1',
              objectFit: 'cover',
              borderRadius: '50%',
              border: `3px solid ${T.yellow}`,
              boxShadow: '0 14px 40px rgba(0,0,0,0.45)'
            }}
          />
        </div>
      )}
    </div>
  );
};
