create table if not exists public.community_messages (
  id text primary key,
  from_uid text not null,
  from_name text not null default 'Trader',
  text text not null default '',
  image_url text,
  file_url text,
  file_name text,
  media_kind text,
  created_at timestamptz not null default now()
);

create index if not exists community_messages_created_idx on public.community_messages (created_at desc);

create table if not exists public.community_read_state (
  uid text primary key,
  from_name text not null default 'Trader',
  last_seen_at timestamptz not null default now()
);

create index if not exists community_read_state_seen_idx on public.community_read_state (last_seen_at desc);

create table if not exists public.community_message_reads (
  message_id text not null references public.community_messages(id) on delete cascade,
  uid text not null,
  from_name text not null default 'Trader',
  read_at timestamptz not null default now(),
  primary key (message_id, uid)
);

create index if not exists community_message_reads_msg_idx on public.community_message_reads (message_id);
