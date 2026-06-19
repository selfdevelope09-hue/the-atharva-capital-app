-- Safe chat schema upgrade (never drop existing threads/messages)

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

create table if not exists public.dm_messages (
  id text primary key,
  thread_id text not null references public.dm_threads(id) on delete cascade,
  from_uid text not null,
  from_name text not null default 'Trader',
  text text not null default '',
  image_url text,
  file_url text,
  file_name text,
  media_kind text,
  reply_to jsonb,
  created_at timestamptz not null default now()
);

alter table public.dm_messages add column if not exists file_url text;
alter table public.dm_messages add column if not exists file_name text;
alter table public.dm_messages add column if not exists media_kind text;
alter table public.dm_threads add column if not exists typing_by_user jsonb not null default '{}'::jsonb;
alter table public.dm_threads add column if not exists last_preview text not null default '';
alter table public.dm_threads add column if not exists last_from_name text not null default '';
alter table public.dm_threads add column if not exists last_from_uid text not null default '';

create index if not exists dm_messages_thread_created_idx on public.dm_messages (thread_id, created_at asc);
