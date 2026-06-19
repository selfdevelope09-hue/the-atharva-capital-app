const { openTrade, closeTrade, updatePositionTpSl } = require('../services/trading/engine');
const { ensureUserFromFirebase, getUserByUid } = require('../db/usersRepo');
const { rowToAppUser } = require('../lib/userNormalize');
const { getBinanceFeed } = require('../services/marketData/binanceFeed');
const { resolveTradeActorUid } = require('../lib/tradeActor');

function ack(cb, payload) {
  if (typeof cb === 'function') cb(payload);
}

async function pushWalletSnapshot(socket) {
  let row = await getUserByUid(socket.uid);
  if (!row) {
    await ensureUserFromFirebase(socket.decoded);
    row = await getUserByUid(socket.uid);
  }
  if (!row) return null;
  const user = rowToAppUser(row);
  socket.emit('wallet:snapshot', { user });
  return user;
}

function registerTradingHandlers(io, socket) {
  socket.join(`user:${socket.uid}`);

  pushWalletSnapshot(socket).catch((e) => {
    console.warn('[wallet:snapshot]', socket.uid, e?.message);
  });

  socket.on('user:sync', async (_, cb) => {
    try {
      const user = await pushWalletSnapshot(socket);
      ack(cb, { ok: true, user });
    } catch (e) {
      ack(cb, { ok: false, error: e?.message || 'sync failed' });
    }
  });

  socket.on('ticks:subscribe', (payload, cb) => {
    const feed = getBinanceFeed();
    if (!feed) {
      ack(cb, { ok: false, error: 'Feed not ready' });
      return;
    }
    const symbols = Array.isArray(payload?.symbols) ? payload.symbols : [];
    feed.subscribeSymbols(symbols);
    ack(cb, { ok: true });
  });

  socket.on('trade:open', async (body, cb) => {
    try {
      const tradeUid = await resolveTradeActorUid(socket.uid, body || {});
      const result = await openTrade(tradeUid, socket.decoded, body || {});
      if (!result.ok) {
        ack(cb, result);
        return;
      }
      io.to(`user:${socket.uid}`).emit('wallet:update', { user: result.user, tradeUid });
      ack(cb, {
        ok: true,
        twelveTradeBonusUsd: result.twelveTradeBonusUsd,
        dailyOpensToday: result.dailyOpensToday
      });
    } catch (e) {
      console.error('[trade:open]', socket.uid, e);
      ack(cb, { ok: false, error: e?.message || 'Open failed' });
    }
  });

  socket.on('trade:update-position', async (body, cb) => {
    try {
      const tradeUid = await resolveTradeActorUid(socket.uid, body || {});
      const result = await updatePositionTpSl(tradeUid, socket.decoded, body || {});
      if (!result.ok) {
        ack(cb, result);
        return;
      }
      io.to(`user:${socket.uid}`).emit('wallet:update', { user: result.user, tradeUid });
      ack(cb, { ok: true });
    } catch (e) {
      console.error('[trade:update-position]', socket.uid, e);
      ack(cb, { ok: false, error: e?.message || 'Update failed' });
    }
  });

  socket.on('trade:close', async (body, cb) => {
    try {
      const tradeUid = await resolveTradeActorUid(socket.uid, body || {});
      const result = await closeTrade(tradeUid, socket.decoded, body || {});
      if (!result.ok) {
        ack(cb, result);
        return;
      }
      io.to(`user:${socket.uid}`).emit('wallet:update', { user: result.user, tradeUid });
      ack(cb, {
        ok: true,
        finalPnl: result.finalPnl,
        openF: result.openF,
        closeF: result.closeF
      });
    } catch (e) {
      console.error('[trade:close]', socket.uid, e);
      ack(cb, { ok: false, error: e?.message || 'Close failed' });
    }
  });
}

module.exports = { registerTradingHandlers, pushWalletSnapshot };
