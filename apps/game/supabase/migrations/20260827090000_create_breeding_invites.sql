-- Invitations: the mirror image of a join request.
--
-- A request is a cat's owner asking to come in; an invite is the breeding's
-- creator asking a cat to join. Both name a cat rather than a user, because
-- membership is by cat and the app has no user directory to pick from.
--
-- Kept in its own table rather than a `direction` column on breeding_requests:
-- the two differ in exactly the ways RLS cares about — who may create one, and
-- who may decide it.

create table if not exists public.breeding_invites (
  id uuid primary key default gen_random_uuid(),
  breeding_id uuid not null references public.breedings(id) on delete cascade,
  cat_id uuid not null references public.cats(id) on delete cascade,
  -- The cat's owner at the time of inviting: the person who gets to answer.
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- One *pending* invite per cat per breeding; a declined one may be sent again.
create unique index if not exists breeding_invites_one_pending_per_cat
  on public.breeding_invites (breeding_id, cat_id)
  where status = 'pending';

create index if not exists breeding_invites_invited_idx
  on public.breeding_invites (invited_user_id, status);

alter table public.breeding_invites enable row level security;

-- Visible to the two parties: the breeding's creator and the invited owner.
drop policy if exists "read own invites" on public.breeding_invites;
create policy "read own invites" on public.breeding_invites
  for select to authenticated using (
    invited_user_id = auth.uid()
    or exists (
      select 1 from public.breedings b
      where b.id = breeding_id and b.owner_user_id = auth.uid()
    )
  );

-- Only the creator invites, and only a cat that really belongs to the person
-- being invited.
drop policy if exists "creator invites cats" on public.breeding_invites;
create policy "creator invites cats" on public.breeding_invites
  for insert to authenticated with check (
    exists (
      select 1 from public.breedings b
      where b.id = breeding_id and b.owner_user_id = auth.uid()
    )
    and exists (
      select 1 from public.cats c
      where c.id = cat_id and c.owner_user_id = invited_user_id
    )
  );

-- Only the invited owner answers it. The creator may not accept on their behalf.
drop policy if exists "invited owner decides" on public.breeding_invites;
create policy "invited owner decides" on public.breeding_invites
  for update to authenticated using (invited_user_id = auth.uid());

-- Accepting an invite is the one case where somebody other than the breeding's
-- creator may put a cat on the roster — and only their own cat, and only while
-- the invite is still open.
drop policy if exists "invited owner joins" on public.breeding_cats;
create policy "invited owner joins" on public.breeding_cats
  for insert to authenticated with check (
    exists (
      select 1
      from public.breeding_invites i
      join public.cats c on c.id = i.cat_id
      where i.breeding_id = breeding_id
        and i.cat_id = cat_id
        and i.status = 'pending'
        and i.invited_user_id = auth.uid()
        and c.owner_user_id = auth.uid()
    )
  );

-- Grants — RLS does not imply table privileges. See
-- 20260805120000_grant_cats_privileges.sql.
grant select, insert, update on public.breeding_invites to authenticated;
grant all on public.breeding_invites to service_role;
