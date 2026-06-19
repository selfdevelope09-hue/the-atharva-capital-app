const { Server } = require('socket.io');
const { socketAuthMiddleware } = require('../middleware/socketAuth');
const { registerTradingHandlers } = require('./tradingHandlers');
const { startBinanceFeed } = require('../services/marketData/binanceFeed');

function attachSocketIo(httpServer, { corsOrigins }) {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000
  });

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    console.log('[socket] connected', socket.uid, socket.id);
    registerTradingHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected', socket.uid, reason);
    });
  });

  startBinanceFeed(io);
  return io;
}

module.exports = { attachSocketIo };
