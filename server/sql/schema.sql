-- AuronX realtime server — Postgres schema (run once on DigitalOcean)
-- Matches supabase/schema.sql trading columns + migration audit fields

create extension if not exists pgcrypto;

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
  doc jsonb,
  source_doc_path text,
  source_updated_at timestamptz,
  source_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_lifetime_realized_pnl_idx on public.users (lifetime_realized_pnl desc);
create index if not exists users_virtual_balance_idx on public.users (virtual_balance desc);
create index if not exists users_updated_at_idx on public.users (updated_at desc);

create table if not exists public.payments (
  id text primary key,
  uid text not null,
  doc jsonb not null,
  source_doc_path text not null,
  source_updated_at timestamptz,
  source_hash text not null,
  migrated_at timestamptz not null default now()
);

create table if not exists public.dm_threads (
  id text primary key,
  doc jsonb not null,
  source_doc_path text not null,
  source_updated_at timestamptz,
  source_hash text not null,
  migrated_at timestamptz not null default now()
);

create table if not exists public.dm_messages (
  thread_id text not null,
  id text not null,
  doc jsonb not null,
  source_doc_path text not null,
  source_updated_at timestamptz,
  source_hash text not null,
  migrated_at timestamptz not null default now(),
  primary key (thread_id, id)
);

create index if not exists payments_uid_idx on public.payments(uid);
create index if not exists dm_messages_thread_idx on public.dm_messages(thread_id);

-- Row-level security: enable only if you add Supabase-style JWT later.
-- For Node server, use a dedicated DB user with least privilege (no superuser).
