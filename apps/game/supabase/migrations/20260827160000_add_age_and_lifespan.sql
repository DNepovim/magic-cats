-- Age, origin and mortality.
--
-- A cat's age is real time since `birth_at`, in days. A cat you tamed was
-- already 10–40 days old when you caught her, so her birth is backdated; a cat
-- born here starts at zero. Every cat gets a lifespan of 80–120 days, and dies
-- when she reaches it — the death is written lazily by the dashboard, the same
-- way births are, since there is no scheduler.
--
-- Taming points stay in the table: they still decide cat-versus-cat games. They
-- are simply no longer shown.

alter table public.cats
  add column if not exists birth_at timestamptz not null default now(),
  add column if not exists lifespan_days int not null default (80 + floor(random() * 41))::int,
  add column if not exists origin text not null default 'tamed',
  add column if not exists died_at timestamptz;

do $$
begin
  alter table public.cats add constraint cats_origin check (origin in ('tamed', 'born'));
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.cats add constraint cats_lifespan_range check (lifespan_days between 1 and 400);
exception when duplicate_object then null;
end;
$$;

-- Cats that already existed: kittens were born here, everything else was tamed
-- at an age we now have to invent — 10 to 40 days, as for any tamed cat.
update public.cats
set origin = 'born',
    birth_at = domesticated_at
where mother_cat_id is not null;

update public.cats
set birth_at = domesticated_at - make_interval(days => (10 + floor(random() * 31))::int)
where mother_cat_id is null;

-- The living are looked up constantly; the dead only for family trees.
create index if not exists cats_alive_idx on public.cats (owner_user_id) where died_at is null;
