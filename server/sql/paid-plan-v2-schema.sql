-- Paid plan v2: Basic / Pro tiers + monthly expiry

alter table public.users add column if not exists paid_plan_type text;
alter table public.users add column if not exists paid_member_until timestamptz;

update public.users set paid_plan_type = 'basic'
  where is_paid_member = true and paid_plan_type is null;

create index if not exists users_paid_plan_type_idx on public.users (paid_plan_type) where paid_plan_type is not null;
