-- Developer panel + showcase (run on DigitalOcean Postgres after schema.sql)

create table if not exists public.platform_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.leaderboard_showcase (
  id text primary key,
  display_name text not null default '',
  pnl numeric(28,6) not null default 0,
  trade_count integer not null default 12,
  profile_uid text not null,
  showcase_presence_online boolean not null default false,
  showcase_presence_offline_at timestamptz,
  doc jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leaderboard_showcase_pnl_idx on public.leaderboard_showcase (pnl desc);
create index if not exists leaderboard_showcase_profile_uid_idx on public.leaderboard_showcase (profile_uid);

create table if not exists public.admin_chat_logs (
  id text primary key default gen_random_uuid()::text,
  thread_id text,
  peer_showcase_id text,
  peer_showcase_name text not null default '',
  from_uid text not null default '',
  from_name text not null default '',
  text text not null default '',
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists admin_chat_logs_created_idx on public.admin_chat_logs (created_at desc);

create table if not exists public.tip_queries (
  id text primary key,
  doc jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tip_queries_created_idx on public.tip_queries (created_at desc);

create table if not exists public.learn_strategies (
  id text primary key,
  doc jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists learn_strategies_created_idx on public.learn_strategies (created_at desc);

-- Showcase presence on user rows (users.uid = showcase__*)
alter table public.users add column if not exists is_showcase_profile boolean not null default false;
alter table public.users add column if not exists showcase_presence_online boolean;
alter table public.users add column if not exists showcase_presence_offline_at timestamptz;
alter table public.users add column if not exists showcase_trade_count integer;
