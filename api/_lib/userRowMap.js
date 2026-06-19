const { REMOVED_USER_LABEL } = require('./removedUsers.cjs');

function asArr(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    const vals = Object.values(v);
    if (vals.length && vals.some((x) => x && typeof x === 'object')) return vals;
  }
  return [];
}

function lastSeenFieldFromDb(isoOrNull) {
  if (!isoOrNull) return null;
  const ms = new Date(isoOrNull).getTime();
  if (!Number.isFinite(ms)) return null;
  return { seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1e6 };
}

function rowToClient(row) {
  if (!row) return null;
  let positions = row.positions;
  let closedPositions = row.closed_positions;
  let portfolio = row.portfolio;
  if (typeof positions === 'string') {
    try {
      positions = JSON.parse(positions);
    } catch {
      positions = [];
    }
  }
  if (typeof closedPositions === 'string') {
    try {
      closedPositions = JSON.parse(closedPositions);
    } catch {
      closedPositions = [];
    }
  }
  if (typeof portfolio === 'string') {
    try {
      portfolio = JSON.parse(portfolio);
    } catch {
      portfolio = [];
    }
  }
  const accountRemoved = row.account_removed === true;
  return {
    uid: row.uid,
    email: row.email || '',
    name: accountRemoved ? REMOVED_USER_LABEL : row.name || 'Trader',
    accountRemoved,
    photoURL: row.photo_url || '',
    bio: row.bio || '',
    virtualBalance: Number.isFinite(Number(row.virtual_balance)) ? Number(row.virtual_balance) : 10000,
    lifetimeRealizedPnl: Number.isFinite(Number(row.lifetime_realized_pnl))
      ? Number(row.lifetime_realized_pnl)
      : 0,
    positions: asArr(positions),
    closedPositions: asArr(closedPositions),
    watchlist: asArr(row.watchlist),
    followers: asArr(row.followers),
    following: asArr(row.following),
    presenceOnline: !!row.presence_online,
    lastSeenAt: lastSeenFieldFromDb(row.last_seen_at),
    portfolio: asArr(portfolio),
    lastProcessedResetPaymentId: row.last_processed_reset_payment_id || '',
    resetAt: row.reset_at ? new Date(row.reset_at).toISOString() : '',
    dailyTradesDate: row.daily_trades_date ? String(row.daily_trades_date).slice(0, 10) : '',
    dailyTradesCount: Number(row.daily_trades_count) || 0,
    dailyAdTradeBonus: Number(row.daily_ad_trade_bonus) || 0,
    dailyTwelveRewardClaimedDate: row.daily_twelve_reward_claimed_date
      ? String(row.daily_twelve_reward_claimed_date).slice(0, 10)
      : '',
    showcasePresenceOnline: row.showcase_presence_online === true,
    showcasePresenceExplicitOffline: row.showcase_presence_online === false,
    showcasePresenceOfflineAt: row.showcase_presence_offline_at
      ? lastSeenFieldFromDb(
          typeof row.showcase_presence_offline_at === 'string'
            ? row.showcase_presence_offline_at
            : new Date(row.showcase_presence_offline_at).toISOString()
        )
      : null
  };
}

function threadRowToClient(row) {
  if (!row) return null;
  const updatedMs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
  const typingRaw = row.typing_by_user && typeof row.typing_by_user === 'object' ? row.typing_by_user : {};
  const typingByUser = { ...typingRaw };
  Object.keys(typingByUser).forEach((k) => {
    const v = typingByUser[k];
    if (v && typeof v === 'object' && typeof v.seconds === 'number') {
      typingByUser[k] = v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
    }
  });
  return {
    id: row.id,
    participants: row.participants || [],
    names: row.names || {},
    unreadByUser: row.unread_by_user || {},
    lastSeenAt: row.last_seen_at || {},
    typingByUser,
    lastPreview: row.last_preview || '',
    lastFromName: row.last_from_name || '',
    updatedAt: { seconds: Math.floor(updatedMs / 1000), nanoseconds: (updatedMs % 1000) * 1e6 }
  };
}

function messageRowToClient(row) {
  if (!row) return null;
  const ms = row.created_at ? new Date(row.created_at).getTime() : 0;
  return {
    id: row.id,
    fromUid: row.from_uid,
    fromName: row.from_name,
    text: row.text,
    imageUrl: row.image_url || '',
    replyTo: row.reply_to || null,
    createdAt: { seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1e6 }
  };
}

module.exports = { rowToClient, threadRowToClient, messageRowToClient, lastSeenFieldFromDb };
