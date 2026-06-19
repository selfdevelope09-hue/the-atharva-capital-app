-- Soft-delete: user stays in DB, visible as "Removed user", cannot trade/chat.
alter table users add column if not exists account_removed boolean not null default false;
alter table users add column if not exists account_removed_at timestamptz;
create index if not exists users_account_removed_idx on users (account_removed) where account_removed = true;
