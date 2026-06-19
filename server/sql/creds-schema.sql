-- Ratings & Creds gamification fields on users

alter table public.users add column if not exists total_minutes_online integer not null default 0;
alter table public.users add column if not exists creds_active_days integer not null default 0;
alter table public.users add column if not exists creds_streak_days integer not null default 0;
alter table public.users add column if not exists creds_last_active_date text not null default '';
alter table public.users add column if not exists creds_liquidations_count integer not null default 0;

create index if not exists users_total_minutes_online_idx on public.users (total_minutes_online desc);
