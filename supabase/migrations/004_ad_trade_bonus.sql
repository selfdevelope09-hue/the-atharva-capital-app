alter table public.users
  add column if not exists daily_ad_trade_bonus integer not null default 0;
