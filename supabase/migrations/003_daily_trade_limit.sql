-- Daily open cap (IST calendar day), synced with app Firestore fields dailyTradesDate / dailyTradesCount
alter table public.users
  add column if not exists daily_trades_date text,
  add column if not exists daily_trades_count integer not null default 0;
