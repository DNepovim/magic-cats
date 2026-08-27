-- Gender, mating and pregnancy.
--
-- Every cat is male or female; existing cats are assigned one at random, which
-- is as fair as anything else after the fact. A successful mating leaves the
-- female pregnant for roughly nine days, during which she eats more and her
-- mood wanders — both handled by the replay in src/lib/game/care.ts. The birth
-- itself cannot happen in a pure replay, so it is written lazily when the owner
-- next loads their dashboard.

alter table public.cats
  add column if not exists gender text not null
    default (case when random() < 0.5 then 'male' else 'female' end),
  add column if not exists pregnant_since timestamptz,
  add column if not exists due_at timestamptz,
  add column if not exists last_mated_at timestamptz,
  -- Kept for flavour and for the family tree the dashboard shows.
  add column if not exists mother_cat_id uuid references public.cats(id) on delete set null,
  add column if not exists father_cat_id uuid references public.cats(id) on delete set null;

do $$
begin
  alter table public.cats add constraint cats_gender check (gender in ('male', 'female'));
exception when duplicate_object then null;
end;
$$;

-- A pregnancy is either fully set or not set at all.
do $$
begin
  alter table public.cats add constraint cats_pregnancy_complete
    check ((pregnant_since is null) = (due_at is null));
exception when duplicate_object then null;
end;
$$;

create index if not exists cats_due_idx on public.cats (due_at) where due_at is not null;

-- Kittens are born to their mother's owner, so no new policies are needed:
-- the existing "insert own cat" rule already covers the row the API writes.
