-- Breedings: user-created groups of cats, with a join-request flow and a forum.
--
-- Membership model: a breeding contains cats. A *user* is a member of a
-- breeding if they created it, or if they own at least one cat in it. Forum
-- access is derived from that — see is_breeding_member() below.

create table if not exists public.breedings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 48),
  description text not null default '' check (char_length(description) <= 500),
  created_at timestamptz not null default now()
);

-- A cat belongs to at most one breeding, so `unique (cat_id)` rather than just
-- the composite primary key.
create table if not exists public.breeding_cats (
  breeding_id uuid not null references public.breedings(id) on delete cascade,
  cat_id uuid not null references public.cats(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (breeding_id, cat_id),
  constraint breeding_cats_one_breeding_per_cat unique (cat_id)
);

create table if not exists public.breeding_requests (
  id uuid primary key default gen_random_uuid(),
  breeding_id uuid not null references public.breedings(id) on delete cascade,
  cat_id uuid not null references public.cats(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- Only one *pending* request per cat per breeding; rejected ones may be retried.
create unique index if not exists breeding_requests_one_pending_per_cat
  on public.breeding_requests (breeding_id, cat_id)
  where status = 'pending';

create table if not exists public.breeding_posts (
  id uuid primary key default gen_random_uuid(),
  breeding_id uuid not null references public.breedings(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists breeding_cats_breeding_idx on public.breeding_cats (breeding_id);
create index if not exists breeding_requests_breeding_idx on public.breeding_requests (breeding_id);
create index if not exists breeding_posts_breeding_created_idx
  on public.breeding_posts (breeding_id, created_at desc);

-- ──────────────────────────────────────────────────────────────────────────
-- Membership helper
--
-- SECURITY DEFINER so it reads breedings/breeding_cats/cats without RLS. If it
-- didn't, the forum policies below would re-enter the policies on those tables
-- and recurse.
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.is_breeding_member(b_id uuid, u_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from public.breedings b where b.id = b_id and b.owner_user_id = u_id)
    or exists (
      select 1
      from public.breeding_cats bc
      join public.cats c on c.id = bc.cat_id
      where bc.breeding_id = b_id and c.owner_user_id = u_id
    );
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────────────────
alter table public.breedings enable row level security;
alter table public.breeding_cats enable row level security;
alter table public.breeding_requests enable row level security;
alter table public.breeding_posts enable row level security;

-- Breedings are browsable by any signed-in user; only the creator may edit.
drop policy if exists "read all breedings" on public.breedings;
create policy "read all breedings" on public.breedings
  for select to authenticated using (true);

drop policy if exists "create own breeding" on public.breedings;
create policy "create own breeding" on public.breedings
  for insert to authenticated with check (auth.uid() = owner_user_id);

drop policy if exists "update own breeding" on public.breedings;
create policy "update own breeding" on public.breedings
  for update to authenticated using (auth.uid() = owner_user_id);

drop policy if exists "delete own breeding" on public.breedings;
create policy "delete own breeding" on public.breedings
  for delete to authenticated using (auth.uid() = owner_user_id);

-- Roster is public to signed-in users so the dashboard is browsable.
drop policy if exists "read breeding cats" on public.breeding_cats;
create policy "read breeding cats" on public.breeding_cats
  for select to authenticated using (true);

-- Only the breeding's creator adds cats (on accepting a request).
drop policy if exists "owner adds cats" on public.breeding_cats;
create policy "owner adds cats" on public.breeding_cats
  for insert to authenticated with check (
    exists (
      select 1 from public.breedings b
      where b.id = breeding_id and b.owner_user_id = auth.uid()
    )
  );

-- Removal is either the creator kicking, or the cat's owner leaving.
drop policy if exists "owner kicks or member leaves" on public.breeding_cats;
create policy "owner kicks or member leaves" on public.breeding_cats
  for delete to authenticated using (
    exists (
      select 1 from public.breedings b
      where b.id = breeding_id and b.owner_user_id = auth.uid()
    )
    or exists (
      select 1 from public.cats c
      where c.id = cat_id and c.owner_user_id = auth.uid()
    )
  );

-- Requests are visible to the requester and to the breeding's creator.
drop policy if exists "read own or owned requests" on public.breeding_requests;
create policy "read own or owned requests" on public.breeding_requests
  for select to authenticated using (
    requester_user_id = auth.uid()
    or exists (
      select 1 from public.breedings b
      where b.id = breeding_id and b.owner_user_id = auth.uid()
    )
  );

drop policy if exists "request with own cat" on public.breeding_requests;
create policy "request with own cat" on public.breeding_requests
  for insert to authenticated with check (
    requester_user_id = auth.uid()
    and exists (
      select 1 from public.cats c
      where c.id = cat_id and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "owner decides requests" on public.breeding_requests;
create policy "owner decides requests" on public.breeding_requests
  for update to authenticated using (
    exists (
      select 1 from public.breedings b
      where b.id = breeding_id and b.owner_user_id = auth.uid()
    )
  );

-- Forum: members only, read and write. No delete policy anywhere, so posts are
-- append-only for every role including the creator — deliberate.
drop policy if exists "members read posts" on public.breeding_posts;
create policy "members read posts" on public.breeding_posts
  for select to authenticated using (public.is_breeding_member(breeding_id, auth.uid()));

drop policy if exists "members write posts" on public.breeding_posts;
create policy "members write posts" on public.breeding_posts
  for insert to authenticated with check (
    author_user_id = auth.uid()
    and public.is_breeding_member(breeding_id, auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────────
-- Grants — RLS does not imply table privileges, and this stack has no default
-- privileges on public. See 20260805120000_grant_cats_privileges.sql.
-- ──────────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.breedings to authenticated;
grant select, insert, delete on public.breeding_cats to authenticated;
grant select, insert, update on public.breeding_requests to authenticated;
grant select, insert on public.breeding_posts to authenticated;

grant all on public.breedings to service_role;
grant all on public.breeding_cats to service_role;
grant all on public.breeding_requests to service_role;
grant all on public.breeding_posts to service_role;

grant execute on function public.is_breeding_member(uuid, uuid) to authenticated, service_role;
