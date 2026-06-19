-- Multi-room community chat + Roast Community rewards

alter table public.community_messages add column if not exists room_id text not null default 'community';
alter table public.community_messages add column if not exists hidden boolean not null default false;

create index if not exists community_messages_room_created_idx
  on public.community_messages (room_id, created_at desc);

alter table public.community_read_state add column if not exists room_id text not null default 'community';

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'community_read_state_pkey'
      and conrelid = 'public.community_read_state'::regclass
  ) then
    alter table public.community_read_state drop constraint community_read_state_pkey;
  end if;
exception when others then null;
end $$;

alter table public.community_read_state
  add constraint community_read_state_pkey primary key (uid, room_id);

create table if not exists public.community_room_config (
  room_id text primary key,
  display_name text not null,
  chat_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.community_room_config (room_id, display_name)
values
  ('community', 'AuronX Trade Community'),
  ('roast', 'Roast Community')
on conflict (room_id) do nothing;

create table if not exists public.roast_leaderboard (
  uid text primary key,
  roast_points int not null default 0,
  message_count int not null default 0,
  roast_pnl numeric not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists roast_leaderboard_points_idx
  on public.roast_leaderboard (roast_points desc, message_count desc);
