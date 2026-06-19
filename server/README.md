# AuronX Realtime Server (DigitalOcean)

Socket.io + Postgres trading backend. Firebase Auth only (identity); **zero Firestore reads** for live ticks / buy / sell.

## Deploy (PM2)

```bash
ssh root@64.227.188.248
cd /opt/auron-realtime   # clone or rsync this server/ folder
cp .env.example .env     # fill PG_URL + FIREBASE_SERVICE_ACCOUNT_JSON
npm install
npm run db:schema
pm2 start ecosystem.config.cjs
pm2 save
ufw allow 3000/tcp
```

## Client env (React app)

```
REACT_APP_REALTIME_SERVER_URL=http://64.227.188.248:3000
REACT_APP_REALTIME_SOCKET_ENABLED=true
REACT_APP_REALTIME_TRADE_MODE=true
```

## Socket events

| Direction | Event | Payload |
|-----------|-------|---------|
| Server → All | `tick` | `{ symbol, price, change24h, eventTime }` |
| Server → User | `wallet:snapshot` | `{ user }` on connect |
| Server → User | `wallet:update` | `{ user }` after trade |
| Client → Server | `trade:open` | `{ symbol, side, leverage, amount, execPrice, orderType, tp?, sl? }` |
| Client → Server | `trade:close` | `{ enriched, uiIndex, closeReason }` |
| Client → Server | `user:sync` | refresh wallet |
| Client → Server | `ticks:subscribe` | `{ symbols: ['BTCUSDT'] }` |

All trade handlers use Socket.io acknowledgement callbacks: `(ack) => ack({ ok, ... })`.

## Health

`GET http://64.227.188.248:3000/health`
