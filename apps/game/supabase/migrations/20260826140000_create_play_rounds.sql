-- Play sessions: one row per round of a mini-game with a cat.
--
-- The server issues the seed and re-derives the round from it when the claim
-- comes back, the same way supply runs are validated — a browser cannot simply
-- ask for happiness. Which games a cat enjoys is not stored: it falls out of her
-- taste_seed (see gameAffinity() in src/lib/game/play.ts), so there is nothing
-- here to keep in sync with the cat.

create table if not exists public.play_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cat_id uuid not null references public.cats(id) on delete cascade,
  game text not null check (game in ('laser', 'bugs', 'yarn', 'brush', 'boxes')),
  seed bigint not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- 0…100, how well it went; null until the round is handed in.
  score int check (score is null or score between 0 and 100),
  happiness_gain int
);

create index if not exists play_rounds_cat_idx on public.play_rounds (cat_id, started_at desc);

alter table public.play_rounds enable row level security;

drop policy if exists "read own rounds" on public.play_rounds;
create policy "read own rounds" on public.play_rounds
  for select to authenticated using (user_id = auth.uid());

-- You may only open a round for a cat you own.
drop policy if exists "start round with own cat" on public.play_rounds;
create policy "start round with own cat" on public.play_rounds
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.cats c where c.id = cat_id and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "finish own rounds" on public.play_rounds;
create policy "finish own rounds" on public.play_rounds
  for update to authenticated using (user_id = auth.uid());

-- Grants — RLS does not imply table privileges. See
-- 20260805120000_grant_cats_privileges.sql.
grant select, insert, update on public.play_rounds to authenticated;
grant all on public.play_rounds to service_role;
