-- Care, second pass: satiety, tastes, illness, and an item inventory.
--
-- A cat's condition is a snapshot (`satiety`, `happiness`, `illness`) plus the
-- moment it was taken (`state_at`). Readers simulate forward from there — see
-- src/lib/game/care.ts. Illness onset is rolled from a PRNG seeded by the cat
-- id and the step index, so the server and the browser derive the same cat
-- without the server having to write on every page load.
--
-- Feeding and medicine are gated by inventory rather than by cooldowns: you
-- can only give what you have won in a supply run.

alter table public.cats
  add column if not exists satiety int not null default 60,
  add column if not exists illness text,
  add column if not exists ill_since timestamptz,
  add column if not exists last_petted_at timestamptz,
  -- Persistent per-cat palate. Two cats never rate the same bowl alike.
  add column if not exists taste_seed int not null default (floor(random() * 1000000))::int;

alter table public.cats rename column happiness_at to state_at;
alter table public.cats drop column if exists last_hugged_at;
alter table public.cats drop column if exists last_fed_at;

do $$
begin
  alter table public.cats add constraint cats_satiety_range check (satiety between 0 and 100);
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.cats add constraint cats_illness_kind
    check (illness is null or illness in ('sniffles', 'earmites', 'furball'));
exception when duplicate_object then null;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Inventory: one row per user per item kind, holding a count.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.user_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  quantity int not null default 0 check (quantity >= 0),
  primary key (user_id, item_id)
);

alter table public.user_items enable row level security;

drop policy if exists "read own items" on public.user_items;
create policy "read own items" on public.user_items
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "write own items" on public.user_items;
create policy "write own items" on public.user_items
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "update own items" on public.user_items;
create policy "update own items" on public.user_items
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "delete own items" on public.user_items;
create policy "delete own items" on public.user_items
  for delete to authenticated using (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────
-- Supply runs: the server hands out a seed, the client plays the run, and the
-- server re-derives the very same item schedule from that seed when the run is
-- handed in. A client that invents a catch is claiming an item that was never
-- in the air.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.supply_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seed bigint not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists supply_runs_user_idx on public.supply_runs (user_id, started_at desc);

alter table public.supply_runs enable row level security;

drop policy if exists "read own runs" on public.supply_runs;
create policy "read own runs" on public.supply_runs
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "start own run" on public.supply_runs;
create policy "start own run" on public.supply_runs
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "finish own run" on public.supply_runs;
create policy "finish own run" on public.supply_runs
  for update to authenticated using (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────
-- Grants — RLS does not imply table privileges. See
-- 20260805120000_grant_cats_privileges.sql.
-- ──────────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.user_items to authenticated;
grant select, insert, update on public.supply_runs to authenticated;

grant all on public.user_items to service_role;
grant all on public.supply_runs to service_role;
