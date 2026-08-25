-- Cat care and cat games.
--
-- Happiness is stored as a value plus the moment it was true, and read back
-- through a decay function (src/lib/game/care.ts). Nothing has to tick it down
-- on a schedule — the value only ever moves when someone acts on the cat.
--
-- Games never touch the opponent's row: a challenge is something you do *with*
-- your own cat, so only the challenger's happiness moves. That keeps every
-- write inside the existing owner-only update policy on cats, and means a
-- stranger can't drain your cat by spamming challenges.

alter table public.cats
  add column if not exists happiness int not null default 60,
  add column if not exists happiness_at timestamptz not null default now(),
  add column if not exists last_fed_at timestamptz,
  add column if not exists last_hugged_at timestamptz,
  add column if not exists last_played_at timestamptz;

do $$
begin
  alter table public.cats add constraint cats_happiness_range check (happiness between 0 and 100);
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.cat_games (
  id uuid primary key default gen_random_uuid(),
  challenger_cat_id uuid not null references public.cats(id) on delete cascade,
  opponent_cat_id uuid not null references public.cats(id) on delete cascade,
  winner_cat_id uuid not null references public.cats(id) on delete cascade,
  kind text not null check (kind in ('chase', 'wrestle', 'yarn')),
  challenger_score int not null,
  opponent_score int not null,
  played_at timestamptz not null default now(),
  constraint cat_games_needs_two_cats check (challenger_cat_id <> opponent_cat_id)
);

create index if not exists cat_games_challenger_idx on public.cat_games (challenger_cat_id, played_at desc);
create index if not exists cat_games_opponent_idx on public.cat_games (opponent_cat_id, played_at desc);
create index if not exists cat_games_played_at_idx on public.cat_games (played_at desc);

-- ──────────────────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────────────────
alter table public.cat_games enable row level security;

-- Results are public to signed-in users: both sides want to see the scoreline.
drop policy if exists "read all games" on public.cat_games;
create policy "read all games" on public.cat_games
  for select to authenticated using (true);

-- You may only record a game your own cat played, and the API decides the
-- winner — a client that lies about the score still cannot insert for a cat
-- it does not own.
drop policy if exists "play with own cat" on public.cat_games;
create policy "play with own cat" on public.cat_games
  for insert to authenticated with check (
    exists (
      select 1 from public.cats c
      where c.id = challenger_cat_id and c.owner_user_id = auth.uid()
    )
  );

-- No update or delete policy anywhere: a played game is a fact, not a draft.

-- ──────────────────────────────────────────────────────────────────────────
-- Grants — RLS does not imply table privileges. See
-- 20260805120000_grant_cats_privileges.sql.
-- ──────────────────────────────────────────────────────────────────────────
grant select, insert on public.cat_games to authenticated;
grant all on public.cat_games to service_role;
