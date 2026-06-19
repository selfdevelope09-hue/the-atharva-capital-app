-- Paid member subscription (₹49/month — admin grant or future payment webhook)

alter table public.users add column if not exists is_paid_member boolean not null default false;
alter table public.users add column if not exists paid_member_granted_at timestamptz;
alter table public.users add column if not exists paid_member_granted_by text;
alter table public.users add column if not exists creds_paid_bonus integer not null default 0;

create index if not exists users_is_paid_member_idx on public.users (is_paid_member) where is_paid_member = true;
