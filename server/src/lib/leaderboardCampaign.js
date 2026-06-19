const { getPool } = require('../db/pool');
const { getConfigValue, setConfigValue } = require('./platformAdminPg');
const { closeAllOpenPositionsForRow } = require('./bulkCloseUserPositions');
const { listShowcaseRows, upsertShowcaseUser } = require('./showcaseService');
const { queryLiveLeaderboardRows } = require('./leaderboardQuery');

const TZ = 'Asia/Kolkata';
const CAMPAIGN_KEY = '2026-06';
const END_LABEL = '30 June (last day, IST)';
const PAYOUT_LABEL = '1 July via UPI';
const CONFIG_KEY = 'leaderboardCampaign';

const MONTHLY_PRIZES_INR = [
  { rank: 1, amount: 11000, place: '1st' },
  { rank: 2, amount: 5000, place: '2nd' },
  { rank: 3, amount: 3000, place: '3rd' },
  { rank: 4, amount: 1200, place: '4th' },
  { rank: 5, amount: 1000, place: '5th' },
  { rank: 6, amount: 800, place: '6th' },
  { rank: 7, amount: 500, place: '7th' },
  { rank: 8, amount: 300, place: '8th' },
  { rank: 9, amount: 200, place: '9th' },
  { rank: 10, amount: 100, place: '10th' }
];

const PRIZE_TONES = ['#f0b90b', '#c0c7d1', '#cd7f32', '#9aa4b2', '#9aa4b2'];

function istMidnightUtc(y, m, d) {
  let t = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 6 * 60 * 60 * 1000;
  for (let i = 0; i < 48; i += 1) {
    const dateKey = new Date(t).toLocaleDateString('sv-SE', { timeZone: TZ });
    const [yy, mm, dd] = dateKey.split('-').map(Number);
    if (yy === y && mm === m && dd === d) break;
    const tag = yy * 10000 + mm * 100 + dd;
    const want = y * 10000 + m * 100 + d;
    t += tag < want ? 60 * 60 * 1000 : -60 * 60 * 1000;
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date(t));
  const o = {};
  parts.forEach((p) => {
    if (p.type !== 'literal') o[p.type] = Number(p.value);
  });
  return t - ((o.hour * 60 + o.minute) * 60 + o.second) * 1000;
}

/** End of campaign month: start of next month 00:00 IST (June 30 → 1 July 00:00). */
function leaderboardCampaignEndMs() {
  return istMidnightUtc(2026, 7, 1);
}

function formatPrizeInr(amount) {
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

function prizeForRank(rank) {
  return MONTHLY_PRIZES_INR.find((p) => p.rank === rank) || null;
}

async function getBlockedUidSet() {
  const blocked = await getConfigValue('blockedUsers');
  const uids = blocked?.uids;
  return new Set(Array.isArray(uids) ? uids.map(String) : []);
}

async function loadCampaignConfig() {
  return getConfigValue(CONFIG_KEY);
}

async function querySortedLeaderboardForWinners(blocked) {
  const rows = await queryLiveLeaderboardRows(500);
  return rows.filter((r) => !blocked.has(String(r.uid || '')));
}

async function closeAllUserOpenPositions(closedAtIso) {
  let processed = 0;
  let offset = 0;
  const page = 80;
  for (;;) {
    const { rows } = await getPool().query(
      `select uid, positions, virtual_balance, closed_positions from users
       order by uid asc offset $1 limit $2`,
      [offset, page]
    );
    if (!rows.length) break;
    for (const row of rows) {
      if (!Array.isArray(row.positions) || !row.positions.length) continue;
      const patch = closeAllOpenPositionsForRow(row, closedAtIso);
      await getPool().query(
        `update users set
          virtual_balance = $2,
          positions = '[]'::jsonb,
          closed_positions = $3::jsonb,
          lifetime_realized_pnl = $4,
          updated_at = now()
         where uid = $1`,
        [row.uid, patch.virtual_balance, JSON.stringify(patch.closed_positions), patch.lifetime_realized_pnl]
      );
      processed += 1;
    }
    if (rows.length < page) break;
    offset += page;
  }
  return processed;
}

async function finalizeShowcaseTradesAt(campaignEndMs) {
  const closedAtIso = new Date(campaignEndMs).toISOString();
  const rows = await listShowcaseRows();
  let rebuilt = 0;
  for (const row of rows) {
    const profileUid = row.profile_uid;
    if (!profileUid) continue;
    const { rows: uRows } = await getPool().query(
      `select photo_url, bio, showcase_presence_online, showcase_presence_offline_at from users where uid = $1`,
      [profileUid]
    );
    const u = uRows[0] || {};
    await upsertShowcaseUser(
      {
        uid: profileUid,
        name: row.displayName,
        photo_url: u.photo_url || '',
        bio: u.bio || '',
        lifetime_realized_pnl: row.pnl,
        showcase_trade_count: row.tradeCount,
        showcase_presence_online: u.showcase_presence_online,
        showcase_presence_offline_at: u.showcase_presence_offline_at,
        closedAtEndMs: campaignEndMs
      },
      false
    );
    rebuilt += 1;
  }
  return { rebuilt, closedAtIso };
}

function buildWinnersFromRows(sortedRows) {
  const winners = [];
  for (let i = 0; i < Math.min(10, sortedRows.length); i += 1) {
    const r = sortedRows[i];
    const rank = i + 1;
    const prize = prizeForRank(rank);
    if (!prize) continue;
    winners.push({
      rank,
      uid: r.uid,
      name: r.name || 'Trader',
      photoURL: r.photoURL || '',
      realizedPnlTotal: r.realizedPnlTotal,
      prizeInr: prize.amount,
      prizeLabel: formatPrizeInr(prize.amount),
      placeLabel: prize.place,
      tone: PRIZE_TONES[Math.min(rank - 1, PRIZE_TONES.length - 1)]
    });
  }
  return winners;
}

function buildCampaignPayload({ existing, sortedRows, winners, finalizedAt, positionsClosedUsers, showcaseRebuilt }) {
  const frozenMessage = `June leaderboard locked (${END_LABEL}). Winners on /winners · payout ${PAYOUT_LABEL}.`;
  return {
    finalized: true,
    campaignKey: CAMPAIGN_KEY,
    endsLabel: END_LABEL,
    payoutLabel: PAYOUT_LABEL,
    finalizedAt,
    frozenMessage,
    winners,
    positionsClosedUsers: positionsClosedUsers ?? existing?.positionsClosedUsers ?? 0,
    showcaseRebuilt: showcaseRebuilt ?? existing?.showcaseRebuilt ?? 0,
    snapshot: {
      monthIst: CAMPAIGN_KEY,
      rows: sortedRows.slice(0, 120),
      settledAt: finalizedAt,
      frozenMessage
    }
  };
}

/** Re-read live leaderboard top 10 into campaign config (no trade closes). */
async function syncLeaderboardWinnersFromLive() {
  const existing = await loadCampaignConfig();
  const blocked = await getBlockedUidSet();
  const sortedRows = await querySortedLeaderboardForWinners(blocked);
  const winners = buildWinnersFromRows(sortedRows);
  const finalizedAt = existing?.finalizedAt || new Date().toISOString();
  const payload = buildCampaignPayload({
    existing,
    sortedRows,
    winners,
    finalizedAt,
    positionsClosedUsers: existing?.positionsClosedUsers,
    showcaseRebuilt: existing?.showcaseRebuilt
  });
  await setConfigValue(CONFIG_KEY, payload, 'system');
  return { ok: true, synced: true, winnerNames: winners.map((w) => w.name), ...payload };
}

/**
 * Finalize active monthly campaign: close open trades, stamp showcase histories, publish winners.
 */
async function finalizeLeaderboardCampaign({ force = false } = {}) {
  const existing = await loadCampaignConfig();
  if (existing?.finalized && existing?.campaignKey === CAMPAIGN_KEY) {
    if (force) return syncLeaderboardWinnersFromLive();
    return { ok: true, alreadyFinalized: true, ...existing };
  }

  const endMs = leaderboardCampaignEndMs();
  const now = Date.now();
  if (!force && now < endMs) {
    return { ok: false, error: 'Campaign has not ended yet', endMs, endsLabel: END_LABEL };
  }

  const closedAtIso = new Date(endMs).toISOString();
  const positionsClosedUsers = await closeAllUserOpenPositions(closedAtIso);
  const showcase = await finalizeShowcaseTradesAt(endMs);

  const blocked = await getBlockedUidSet();
  const sortedRows = await querySortedLeaderboardForWinners(blocked);
  const winners = buildWinnersFromRows(sortedRows);
  const finalizedAt = new Date().toISOString();

  const payload = buildCampaignPayload({
    existing,
    sortedRows,
    winners,
    finalizedAt,
    positionsClosedUsers,
    showcaseRebuilt: showcase.rebuilt
  });

  await setConfigValue(CONFIG_KEY, payload, 'system');

  return { ok: true, ...payload };
}

async function maybeAutoFinalizeLeaderboardCampaign() {
  const endMs = leaderboardCampaignEndMs();
  if (Date.now() < endMs) return null;
  const existing = await loadCampaignConfig();
  if (existing?.finalized && existing?.campaignKey === CAMPAIGN_KEY) return null;
  return finalizeLeaderboardCampaign({ force: false });
}

function getWinnerForUid(campaign, uid) {
  if (!campaign?.finalized || !uid || !Array.isArray(campaign.winners)) return null;
  if (campaign.campaignKey !== CAMPAIGN_KEY) return null;
  return campaign.winners.find((w) => String(w.uid) === String(uid)) || null;
}

/** Only show frozen banner when the current month's campaign ended and was finalized. */
function isLeaderboardCampaignFrozen(campaign) {
  if (!campaign?.finalized || !campaign?.winners?.length) return false;
  if (campaign.campaignKey !== CAMPAIGN_KEY) return false;
  if (Date.now() < leaderboardCampaignEndMs()) return false;
  return true;
}

/** Clear stale May (or other month) finalized configs so the live board stays open. */
async function ensureActiveLeaderboardCampaign() {
  const existing = await loadCampaignConfig();
  const endMs = leaderboardCampaignEndMs();
  const now = Date.now();
  const staleFinalized =
    existing?.finalized &&
    (existing.campaignKey !== CAMPAIGN_KEY || now < endMs);
  const staleKey = existing?.campaignKey && existing.campaignKey !== CAMPAIGN_KEY;

  if (staleFinalized || staleKey) {
    const payload = {
      campaignKey: CAMPAIGN_KEY,
      finalized: false,
      winners: [],
      frozenMessage: '',
      endsLabel: END_LABEL,
      payoutLabel: PAYOUT_LABEL
    };
    await setConfigValue(CONFIG_KEY, payload, 'system');
    return payload;
  }
  return existing;
}

module.exports = {
  CAMPAIGN_KEY,
  END_LABEL,
  CONFIG_KEY,
  MONTHLY_PRIZES_INR,
  leaderboardCampaignEndMs,
  loadCampaignConfig,
  finalizeLeaderboardCampaign,
  syncLeaderboardWinnersFromLive,
  maybeAutoFinalizeLeaderboardCampaign,
  getWinnerForUid,
  isLeaderboardCampaignFrozen,
  ensureActiveLeaderboardCampaign,
  formatPrizeInr
};
