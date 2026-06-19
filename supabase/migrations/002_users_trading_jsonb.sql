-- Run after schema.sql if your project was created from the first version.
-- Adds Firestore-shaped trading + wallet fields on public.users.

alter table public.users add column if not exists positions jsonb not null default '[]'::jsonb;
alter table public.users add column if not exists closed_positions jsonb not null default '[]'::jsonb;
alter table public.users add column if not exists portfolio jsonb not null default '[]'::jsonb;
alter table public.users add column if not exists last_processed_reset_payment_id text;
alter table public.users add column if not exists reset_at timestamptz;
