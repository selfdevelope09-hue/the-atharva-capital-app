import { bff } from './serverBff';
import { mergeTipEditorFallbackUids } from '../stockTips/tipEditorUid';

export async function disableCommunityMessage(messageId) {
  return bff('/api/admin/community-message-disable', {
    method: 'POST',
    body: JSON.stringify({ messageId })
  });
}

export async function toggleCommunityRoom(room, enabled) {
  return bff('/api/admin/community-room-toggle', {
    method: 'POST',
    body: JSON.stringify({ room, enabled })
  });
}

export async function fetchCommunityRoomStatus(room = 'community') {
  return bff(`/api/chat/community-room-status?room=${encodeURIComponent(room)}`);
}

export async function fetchAdminCommunityRoomStatuses() {
  return bff('/api/admin/community-room-status');
}

export async function enableAllCommunityRooms() {
  return bff('/api/admin/community-room-enable-all', { method: 'POST', body: JSON.stringify({}) });
}

export async function fetchAdminEditors() {
  const j = await bff('/api/admin/config');
  return mergeTipEditorFallbackUids(j.editors || []);
}

export async function fetchBlockedUids() {
  const j = await bff('/api/admin/config');
  return Array.isArray(j.blockedUids) ? j.blockedUids : [];
}

export async function blockUid(uid) {
  return bff('/api/admin/config/blocked', { method: 'POST', body: JSON.stringify({ action: 'add', uid }) });
}

export async function unblockUid(uid) {
  return bff('/api/admin/config/blocked', { method: 'POST', body: JSON.stringify({ action: 'remove', uid }) });
}

export async function searchUsers(q) {
  const j = await bff('/api/admin/search-users', { method: 'POST', body: JSON.stringify({ q }) });
  return Array.isArray(j.users) ? j.users : [];
}

export async function fetchShowcaseRows() {
  const j = await bff('/api/admin/showcase');
  return {
    rows: Array.isArray(j.rows) ? j.rows : [],
    firestoreSynced: Number(j.firestoreSynced) || 0
  };
}

export async function syncShowcaseFromFirestore() {
  const j = await bff('/api/admin/showcase/sync-firestore', { method: 'POST', body: JSON.stringify({}) });
  return {
    rows: Array.isArray(j.rows) ? j.rows : [],
    imported: Number(j.imported) || 0
  };
}

export async function createShowcaseRow(body) {
  const j = await bff('/api/admin/showcase', { method: 'POST', body: JSON.stringify(body) });
  return j.row;
}

export async function updateShowcaseRow(id, body) {
  const j = await bff(`/api/admin/showcase/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
  return j.row;
}

export async function deleteShowcaseRow(id) {
  await bff(`/api/admin/showcase/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function setShowcasePresence(profileUid, entryId, online) {
  await bff('/api/admin/showcase-presence', {
    method: 'POST',
    body: JSON.stringify({ profileUid, entryId, online })
  });
}

/** Random N showcase users online or offline (bulk). Per-row Online/Offline unchanged. */
export async function bulkSetShowcasePresence(count, mode) {
  return bff('/api/admin/showcase-presence-bulk', {
    method: 'POST',
    body: JSON.stringify({ count: Number(count), mode })
  });
}

export async function showcaseFollow(entryId, targetUid) {
  await bff(`/api/admin/showcase/${encodeURIComponent(entryId)}/follow`, {
    method: 'POST',
    body: JSON.stringify({ targetUid })
  });
}

export async function exportShowcasePack() {
  const j = await bff('/api/admin/showcase/export');
  return j.pack;
}

export async function importShowcaseRows(rows) {
  return bff('/api/admin/showcase/import', { method: 'POST', body: JSON.stringify({ rows }) });
}

export async function rebuildShowcaseTrades() {
  return bff('/api/admin/showcase/rebuild-trades', { method: 'POST', body: JSON.stringify({}) });
}

export async function finalizeLeaderboardCampaign(force = false) {
  return bff('/api/admin/leaderboard/finalize-campaign', {
    method: 'POST',
    body: JSON.stringify({ force })
  });
}

export async function syncLeaderboardWinners() {
  return bff('/api/admin/leaderboard/sync-winners', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export async function fetchLeaderboardCampaignStatus() {
  return bff('/api/admin/leaderboard/campaign-status');
}

/** Add profit or loss to existing showcase P/L + append one realistic closed trade. */
export async function appendShowcasePnl(id, delta) {
  const j = await bff('/api/admin/showcase-add-pnl', {
    method: 'POST',
    body: JSON.stringify({ id: String(id), delta: Number(delta) })
  });
  return j;
}

export async function fetchChatLogs() {
  const j = await bff('/api/admin/chat-logs');
  return Array.isArray(j.logs) ? j.logs : [];
}

export async function fetchTipQueries() {
  const j = await bff('/api/admin/tip-queries');
  return Array.isArray(j.queries) ? j.queries : [];
}

export async function setUserAppLogin(uid, password, loginId) {
  return bff('/api/admin/user-app-login', {
    method: 'POST',
    body: JSON.stringify({ uid, password, loginId: loginId || undefined })
  });
}

/** Monthly reset: real + showcase, plan balances, leaderboard/showcase P/L zero (rows kept). */
export async function runMonthlyReset() {
  return bff('/api/admin/monthly-reset', { method: 'POST', body: JSON.stringify({}) });
}

/** Recompute lifetime_realized_pnl from closed trade history (Postgres). */
export async function backfillLeaderboardPnl() {
  return bff('/api/admin/backfill-leaderboard-pnl', { method: 'POST', body: JSON.stringify({}) });
}

/** Admin: liquidate one open position for any user (natural LIQUIDATED close at liq price). */
export async function adminLiquidatePosition(targetUid, uiIndex, position) {
  return bff('/api/admin/liquidate-position', {
    method: 'POST',
    body: JSON.stringify({ targetUid, uiIndex, position })
  });
}

export async function adjustFollowers(targetUid, action, count) {
  return bff('/api/admin/adjust-followers', {
    method: 'POST',
    body: JSON.stringify({
      targetUid,
      action,
      count: Number(count)
    })
  });
}

/** Soft-delete: user stays visible as "Removed user", cannot trade/chat; old messages kept. */
export async function removePlatformUser(targetUid) {
  return bff('/api/admin/remove-user', {
    method: 'POST',
    body: JSON.stringify({ targetUid })
  });
}

export async function restorePlatformUser(targetUid) {
  return bff('/api/admin/restore-user', {
    method: 'POST',
    body: JSON.stringify({ targetUid })
  });
}

/** Admin: delete one community group chat message (others keep their history). */
export async function deleteCommunityChatMessage(messageId) {
  return bff('/api/chat/community-delete', {
    method: 'POST',
    body: JSON.stringify({ messageId })
  });
}
