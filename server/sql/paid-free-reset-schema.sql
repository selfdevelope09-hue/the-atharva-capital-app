-- Paid plan manual trading resets (Basic: 3, Pro: 5 per active subscription).
alter table public.users add column if not exists paid_free_resets_used integer not null default 0;

update public.users
set paid_free_resets_used = 0
where paid_free_resets_used is null;
