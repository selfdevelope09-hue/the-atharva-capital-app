# AGENTS.md

## Cursor Cloud specific instructions

### What this product is
AuronX Trade ("The Atharva Capital") is a virtual / paper crypto trading platform. It ships as a React web app / PWA (root `src/`) plus an Android Capacitor wrapper (`android/`), backed by a realtime Socket.io + Postgres server (`server/`) and optional Vercel serverless proxies (`api/`).

### Services and how to run them (dev)
- Web frontend (the primary client): `npm start` (Create React App / `react-scripts`, serves on port 3000). This is the main thing to run for development.
  - By default the frontend talks to the HOSTED DigitalOcean realtime backend at `http://64.227.188.248:3000` (see `DEFAULT_REALTIME_ORIGIN` in `src/config/realtimeServer.js` and `.env.local.example`). So you can run and fully exercise the app (login, live prices, open/close trades) with only `npm start` — no local backend needed.
  - Override the backend with `REACT_APP_REALTIME_SERVER_URL` in `.env.local` (copy `.env.local.example`). `.env.local` is gitignored.
  - Firebase Auth config is hardcoded public keys in `src/firebaseClient.js` (project `theatharvacapital-trading`), so email/password and Google login work out of the box. `/signup` self-registration (use "Register with email & password instead") grants $10,000 virtual USDT — this is the quickest way to get a logged-in test account.
- Realtime server (`server/`): `npm run dev` (node --watch). Running it locally is NOT required for frontend dev and is generally blocked in cloud: it needs both `PG_URL` (a reachable Postgres) and `FIREBASE_SERVICE_ACCOUNT_JSON` (a Firebase service-account secret, not in the repo) or it throws at startup (`server/src/config/env.js`, `server/src/lib/firebaseAdmin.js`). See `server/.env.example` and `server/README.md`; apply schema with `npm run db:schema` (from `server/`).
  - Port clash: both CRA and the server default to port 3000. If you run both locally, set the server `PORT` (e.g. 3001) and point `REACT_APP_REALTIME_SERVER_URL` at it.

### Lint / test / build
- Lint: there is no standalone lint script; ESLint (`eslint-config-react-app`) runs automatically during `npm start` and `npm run build`. Existing `react-hooks/exhaustive-deps` and `no-unused-vars` warnings are pre-existing and do not block compilation.
- Tests: none exist. `npm test` prints "No tests found" (CRA Jest harness is wired but there are no spec files).
- Build: `npm run build` (runs `scripts/copy-charting-library.cjs`, which no-ops unless a licensed TradingView `charting_library/` is present, then `react-scripts build`).

### Trading UI gotcha
On the trade order panel there are two Buy/Long buttons; you must scroll down in the order panel and click the lower "Buy / Long BTC" button to actually execute a trade. Open positions and their "Close" buttons appear on the Dashboard/Portfolio view.

### Out of scope / optional
`api/` (Vercel functions, proxy to the realtime server), Supabase, and Firestore are disabled/legacy in "Postgres mode" (`src/config/dataBackend.js`). Android/Capacitor and payments (PhonePe/UPI) are not needed to verify the core web product.
