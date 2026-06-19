-- AuronX ID + password (separate from Google / Firebase email login)

alter table public.users add column if not exists app_login_id text;
alter table public.users add column if not exists app_password_hash text;
alter table public.users add column if not exists app_login_temp_plain text;
alter table public.users add column if not exists app_password_must_change boolean not null default true;

create unique index if not exists users_app_login_id_uidx on public.users (lower(app_login_id))
  where app_login_id is not null and app_login_id <> '';
