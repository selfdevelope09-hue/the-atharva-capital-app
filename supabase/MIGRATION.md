# Supabase Migration (Firebase -> Supabase)

## 1) Create project + run schema

1. Create a new Supabase project.
2. Open SQL Editor.
3. Paste and run the **full** contents of `supabase/schema.sql` (not the file path).
4. If you already ran an older `schema.sql` without `positions` / `closed_positions` on `users`, also run `supabase/migrations/002_users_trading_jsonb.sql`.

## 2) Environment variables

### Frontend (Vercel + local)

```env
REACT_APP_SUPABASE_URL=https://xxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
REACT_APP_USE_SUPABASE_DATA=true
REACT_APP_SUPABASE_FALLBACK=true
```

When `REACT_APP_USE_SUPABASE_DATA` is **not** `true`, the app tries **Firestore** first. If Firestore fails (quota, daily limits, `permission-denied`, `unavailable`, network/timeouts, etc.), the session **automatically** switches to **BFF + Supabase** so trades and profile data keep working — **no extra toggle required** (`REACT_APP_SUPABASE_FALLBACK` defaults to on; set it to `false` only if you are not deploying `/api/*`).

When `REACT_APP_USE_SUPABASE_DATA=true`, all data traffic uses Supabase from the start (no Firestore for app data).

### Vercel serverless `/api/*` (required for Supabase data mode)

The browser talks to your domain’s `/api/*` routes. Those routes use the **service role** (never expose this key in the client).

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_secret
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

`FIREBASE_SERVICE_ACCOUNT_JSON` is the same JSON you use for other `api/` routes (Firebase Admin verifies the user’s ID token on every request).

### Capacitor (Android/iOS) and `npm start` against remote APIs

The bundled WebView uses origin `https://localhost`, so relative `/api/...` does **not** reach your Vercel deployment. Set at **build** time:

```env
REACT_APP_BFF_BASE_URL=https://your-deployment.vercel.app
```

(Use your real production or preview URL; no trailing slash.)

If the UI runs on `http://localhost:3000` but APIs stay on Vercel, use the same variable and add server env **`BFF_CORS_ORIGINS`** with a comma-separated list of allowed `Origin` values (e.g. `http://localhost:3000,https://localhost,https://your-custom-domain.com`). Defaults already include `http://localhost:3000` and `https://localhost`.

## 3) What was implemented

- **Auth:** Still **Firebase Auth** (email / Google / native).
- **Data:** When `REACT_APP_USE_SUPABASE_DATA=true`, reads/writes go through **Vercel functions** + **Postgres** (embedded `positions` / `closed_positions` JSON on `public.users`, same shape as Firestore).
- **Chat:** `dm_threads` + `dm_messages`; UI polls every few seconds (no Firestore).
- **Payments / reset:** PhonePe / `payments` collection can stay on **Firestore**; paid reset calls `/api/wallet/account-reset` which verifies the Firebase payment doc then resets the Supabase user row.

## 4) Vercel routing

`vercel.json` rewrites exclude `/api/*` from the SPA fallback so serverless routes work.

## 5) Optional: `src/supabaseClient.js`

Direct browser Supabase client (anon key) is available for future Realtime / Supabase Auth; the current migration does **not** require it for core trading/chat.

## 6) One-time import: Firestore `users` → Supabase `public.users`

Run locally (or any machine with Node 18+) using the **same** env vars as Vercel `/api/*`:

```bash
set FIREBASE_SERVICE_ACCOUNT_JSON=...   # full JSON string, or use .env loaded by your shell
set SUPABASE_URL=https://xxxx.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=...

npm run migrate:firestore-users -- --dry-run
npm run migrate:firestore-users
```

Flags:

- `--dry-run` — log batch sizes only; no Supabase writes.
- `--limit=500` — stop after N users (testing).
- `--uids=uid1,uid2` — import only these document IDs.

The script **upserts** on `uid` (idempotent). It copies `positions`, `closedPositions`, `virtualBalance`, followers/following/watchlist, and related profile fields into the shape expected by `api/_lib/userRowMap.js`. Chat (`dm_threads` / `dm_messages`) is **not** imported here; add a separate job if you need full DM history in Postgres.

## 7) Production hardening

- Tighten RLS (today’s policies are aimed at service-role server access).
- Rate-limit public `/api/*` if needed.
- Add secure “act as showcase” for chat thread list if you rely on that feature.
