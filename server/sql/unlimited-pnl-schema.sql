-- Raise P/L columns above numeric(18,6) cap (~999B USD). Safe to re-run.
alter table public.users
  alter column virtual_balance type numeric(28,6),
  alter column lifetime_realized_pnl type numeric(28,6);

alter table public.leaderboard_showcase
  alter column pnl type numeric(28,6);
