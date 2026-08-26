-- Private notes on a cat.
--
-- These deliberately do NOT live on public.cats: that table is readable by
-- every signed-in user ("read all cats"), so a note column would be served to
-- anyone who asked. A separate table gets its own policies, and every one of
-- them is scoped to the note's owner.
--
-- One pad per cat rather than a log of entries — the cat id is the key.

create table if not exists public.cat_notes (
  cat_id uuid primary key references public.cats(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  updated_at timestamptz not null default now()
);

create index if not exists cat_notes_owner_idx on public.cat_notes (owner_user_id);

alter table public.cat_notes enable row level security;

-- Read, write and delete are all owner-only. There is no policy that lets a
-- second user see a row, so a note is invisible to everyone else — including
-- the rest of a breeding the cat belongs to.
drop policy if exists "read own notes" on public.cat_notes;
create policy "read own notes" on public.cat_notes
  for select to authenticated using (owner_user_id = auth.uid());

-- The cat must be yours too, so a note cannot be attached to someone else's cat.
drop policy if exists "write notes on own cats" on public.cat_notes;
create policy "write notes on own cats" on public.cat_notes
  for insert to authenticated with check (
    owner_user_id = auth.uid()
    and exists (
      select 1 from public.cats c
      where c.id = cat_id and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "update own notes" on public.cat_notes;
create policy "update own notes" on public.cat_notes
  for update to authenticated using (owner_user_id = auth.uid());

drop policy if exists "delete own notes" on public.cat_notes;
create policy "delete own notes" on public.cat_notes
  for delete to authenticated using (owner_user_id = auth.uid());

-- Grants — RLS does not imply table privileges. See
-- 20260805120000_grant_cats_privileges.sql.
grant select, insert, update, delete on public.cat_notes to authenticated;
grant all on public.cat_notes to service_role;
