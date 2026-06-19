-- TradingView chart/layout storage + optional message file metadata

create table if not exists public.tv_chart_keys (
  chart_user_id text primary key,
  uid text not null,
  expires_at bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists tv_chart_keys_uid_idx on public.tv_chart_keys (uid);

create table if not exists public.tv_charts (
  id text primary key,
  client_id text not null default 'auronx',
  user_key text not null,
  name text not null default 'Chart',
  symbol text not null default '',
  resolution text not null default '',
  content text not null default '',
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists tv_charts_user_key_idx on public.tv_charts (user_key, updated_at desc);

create table if not exists public.tv_study_templates (
  id text primary key,
  client_id text not null default 'auronx',
  user_key text not null,
  name text not null,
  content text not null default '',
  created_at bigint not null,
  updated_at bigint not null
);

create unique index if not exists tv_study_templates_user_name_idx
  on public.tv_study_templates (client_id, user_key, name);

alter table public.dm_messages add column if not exists file_url text;
alter table public.dm_messages add column if not exists file_name text;
alter table public.dm_messages add column if not exists media_kind text;
