-- Player names.
--
-- Until now a player was only ever visible through their cats. A username gives
-- them a name of their own — shown on their dashboard and wherever they are
-- named to other players — without exposing the email their account uses.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 3 and 20),
  created_at timestamptz not null default now()
);

-- Case-insensitively unique: two players called "Ana" would be worse than
-- asking the second one for another name.
create unique index if not exists profiles_username_unique on public.profiles (lower(username));

alter table public.profiles enable row level security;

-- Usernames are public to signed-in players — that is the point of them.
drop policy if exists "read all usernames" on public.profiles;
create policy "read all usernames" on public.profiles
  for select to authenticated using (true);

drop policy if exists "write own profile" on public.profiles;
create policy "write own profile" on public.profiles
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using (user_id = auth.uid());

-- Grants — RLS does not imply table privileges. See
-- 20260805120000_grant_cats_privileges.sql.
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
