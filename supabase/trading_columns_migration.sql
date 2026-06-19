-- Fix: trade open/close errors like "column ... positions ... does not exist"
-- Run once in Supabase → SQL Editor → Run (safe to re-run).
-- Or: Vercel env DATABASE_URL + first trade auto-runs via API, or npm run db:migrate-trading

alter table public.users add column if not exists virtual_balance numeric(28,6) not null default 10000;
alter table public.users add column if not exists lifetime_realized_pnl numeric(28,6) not null default 0;
alter table public.users add column if not exists positions jsonb not null default '[]'::jsonb;
alter table public.users add column if not exists closed_positions jsonb not null default '[]'::jsonb;
alter table public.users add column if not exists portfolio jsonb not null default '[]'::jsonb;
alter table public.users add column if not exists daily_trades_date text;
alter table public.users add column if not exists daily_trades_count integer not null default 0;
alter table public.users add column if not exists daily_ad_trade_bonus integer not null default 0;
alter table public.users add column if not exists daily_twelve_reward_claimed_date text;
alter table public.users add column if not exists last_processed_reset_payment_id text;
alter table public.users add column if not exists reset_at timestamptz;

alter table public.users alter column virtual_balance type numeric(28,6);
alter table public.users alter column lifetime_realized_pnl type numeric(28,6);
