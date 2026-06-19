-- AuronX Trade: Supabase schema (starter production shape)
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- USERS
create table if not exists public.users (
  uid text primary key,
  email text,
  name text not null default 'Trader',
  photo_url text not null default '',
  bio text not null default '',
  virtual_balance numeric(28,6) not null default 10000,
  lifetime_realized_pnl numeric(28,6) not null default 0,
  followers text[] not null default '{}',
  following text[] not null default '{}',
  watchlist text[] not null default '{}',
  presence_online boolean not null default false,
  last_seen_at timestamptz,
  positions jsonb not null default '[]'::jsonb,
  closed_positions jsonb not null default '[]'::jsonb,
  portfolio jsonb not null default '[]'::jsonb,
  last_processed_reset_payment_id text,
  reset_at timestamptz,
  daily_trades_date text,
  daily_trades_count integer not null default 0,
  daily_ad_trade_bonus integer not null default 0,
  daily_twelve_reward_claimed_date text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_lifetime_realized_pnl_idx on public.users (lifetime_realized_pnl desc);
create index if not exists users_virtual_balance_idx on public.users (virtual_balance desc);
create index if not exists users_updated_at_idx on public.users (updated_at desc);

-- If public.users already existed without trading columns, run once:
-- see supabase/trading_columns_migration.sql

-- App-wide flags (month-end leaderboard freeze, etc.)
create table if not exists public.app_settings (
  id text primary key default 'global',
  leaderboard_frozen boolean not null default false,
  frozen_month_ist text,
  frozen_message text,
  leaderboard_snapshot jsonb,
  last_settled_month_ist text,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values ('global') on conflict (id) do nothing;

-- POSITIONS (open)
create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  user_uid text not null references public.users(uid) on delete cascade,
  position_id text not null,
  symbol text not null,
  side text not null check (side in ('LONG', 'SHORT')),
  entry_price numeric(18,8) not null,
  leverage integer not null,
  margin numeric(18,6) not null,
  total_size numeric(18,6) not null,
  quantity numeric(24,12) not null,
  open_fee numeric(18,8) not null default 0,
  fee_rate numeric(18,8) not null default 0.0004,
  take_profit numeric(18,8),
  stop_loss numeric(18,8),
  status text not null default 'OPEN',
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_uid, position_id)
);

create index if not exists positions_user_uid_idx on public.positions (user_uid, opened_at desc);
create index if not exists positions_symbol_idx on public.positions (symbol);

-- CLOSED POSITIONS
create table if not exists public.closed_positions (
  id uuid primary key default gen_random_uuid(),
  user_uid text not null references public.users(uid) on delete cascade,
  close_id text not null,
  position_id text,
  symbol text not null,
  side text not null check (side in ('LONG', 'SHORT')),
  entry_price numeric(18,8) not null,
  exit_price numeric(18,8) not null,
  quantity numeric(24,12) not null,
  margin numeric(18,6) not null,
  total_size numeric(18,6) not null,
  open_fee numeric(18,8) not null default 0,
  close_fee numeric(18,8) not null default 0,
  gross_pnl numeric(18,8) not null default 0,
  realized_pnl numeric(18,8) not null default 0,
  status text not null default 'MANUAL',
  close_reason text not null default 'MANUAL',
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_uid, close_id)
);

create index if not exists closed_positions_user_uid_idx on public.closed_positions (user_uid, closed_at desc);

-- DM THREADS
create table if not exists public.dm_threads (
  id text primary key,
  participants text[] not null,
  names jsonb not null default '{}'::jsonb,
  unread_by_user jsonb not null default '{}'::jsonb,
  last_seen_at jsonb not null default '{}'::jsonb,
  typing_by_user jsonb not null default '{}'::jsonb,
  last_preview text not null default '',
  last_from_name text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists dm_threads_updated_at_idx on public.dm_threads (updated_at desc);

-- DM MESSAGES
create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null references public.dm_threads(id) on delete cascade,
  from_uid text not null,
  from_name text not null default 'Trader',
  text text not null,
  image_url text,
  reply_to jsonb,
  created_at timestamptz not null default now()
);

create index if not exists dm_messages_thread_created_idx on public.dm_messages (thread_id, created_at asc);

-- Existing projects: add image column (safe to re-run)
alter table public.dm_messages add column if not exists image_url text;

-- Lightweight update trigger for updated_at columns
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_positions_updated_at on public.positions;
create trigger trg_positions_updated_at
before update on public.positions
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_dm_threads_updated_at on public.dm_threads;
create trigger trg_dm_threads_updated_at
before update on public.dm_threads
for each row execute procedure public.set_updated_at();

-- RLS
alter table public.users enable row level security;
alter table public.positions enable row level security;
alter table public.closed_positions enable row level security;
alter table public.dm_threads enable row level security;
alter table public.dm_messages enable row level security;

-- NOTE:
-- Your app currently uses Firebase Auth. Until JWT integration is added,
-- start with permissive authenticated policies and tighten later.
do $$ begin
  create policy "users_read_all_auth"
  on public.users for select
  to authenticated
  using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users_write_all_auth"
  on public.users for all
  to authenticated
  using (true)
  with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "positions_rw_auth"
  on public.positions for all
  to authenticated
  using (true)
  with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "closed_positions_rw_auth"
  on public.closed_positions for all
  to authenticated
  using (true)
  with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "dm_threads_rw_auth"
  on public.dm_threads for all
  to authenticated
  using (true)
  with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "dm_messages_rw_auth"
  on public.dm_messages for all
  to authenticated
  using (true)
  with check (true);
exception when duplicate_object then null; end $$;
