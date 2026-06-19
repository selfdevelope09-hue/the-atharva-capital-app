-- $1000 USDT bonus when user hits 8 opens in an IST day (claimed once per day) — see app rewardConstants
alter table public.users
  add column if not exists daily_twelve_reward_claimed_date text;

-- Global app flags + optional frozen leaderboard snapshot (month-end)
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
