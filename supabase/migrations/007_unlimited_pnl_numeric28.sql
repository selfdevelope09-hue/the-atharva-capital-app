-- Raise P/L precision above numeric(18,6) (~999B USD cap). Safe to re-run.
alter table public.users
  alter column virtual_balance type numeric(28,6),
  alter column lifetime_realized_pnl type numeric(28,6);
