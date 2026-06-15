-- Magic Cats: cats table + RLS
create extension if not exists "uuid-ossp";

create table if not exists public.cats (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 32),
  image_url text not null,
  domestication_points int not null,
  domesticated_at timestamptz not null default now(),
  constraint cats_one_per_user unique (owner_user_id)
);

alter table public.cats enable row level security;

drop policy if exists "read all cats" on public.cats;
create policy "read all cats" on public.cats
  for select to authenticated using (true);

drop policy if exists "insert own cat" on public.cats;
create policy "insert own cat" on public.cats
  for insert to authenticated with check (auth.uid() = owner_user_id);

drop policy if exists "update own cat" on public.cats;
create policy "update own cat" on public.cats
  for update to authenticated using (auth.uid() = owner_user_id);

drop policy if exists "delete own cat" on public.cats;
create policy "delete own cat" on public.cats
  for delete to authenticated using (auth.uid() = owner_user_id);

create index if not exists cats_domesticated_at_idx
  on public.cats (domesticated_at desc);
