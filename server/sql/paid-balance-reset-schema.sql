-- Defer paid-plan starting balance until paid_balance_reset_at (IST monthly / campaign).

alter table public.users add column if not exists paid_balance_reset_at timestamptz;
alter table public.users add column if not exists paid_balance_reset_applied_at timestamptz;

-- June 1 2026 00:00 IST = 2026-05-31 18:30:00 UTC
update public.users
set paid_balance_reset_at = timestamptz '2026-05-31 18:30:00+00'
where is_paid_member = true
  and paid_balance_reset_at is null;
