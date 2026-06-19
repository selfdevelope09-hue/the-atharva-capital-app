-- Ensure P/L columns support unlimited values (numeric(18,6) caps ~999B USD / ~1T).
alter table public.users
  alter column virtual_balance type numeric(28,6),
  alter column lifetime_realized_pnl type numeric(28,6);

alter table public.leaderboard_showcase
  alter column pnl type numeric(28,6);
