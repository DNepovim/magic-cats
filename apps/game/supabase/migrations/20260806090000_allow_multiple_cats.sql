-- Allow a user to own several cats.
--
-- The one-cat-per-user rule was a unique constraint on owner_user_id. The rule
-- is now "at most MAX_CATS" (see src/lib/game/constants.ts), which a unique
-- constraint cannot express, so enforcement moves to the API route in
-- src/routes/api/cats/+server.ts. Keeping it in application code is also what
-- lets the limit change later without a migration.

alter table public.cats drop constraint if exists cats_one_per_user;

-- owner_user_id is now looked up as a non-unique key on every dashboard load.
create index if not exists cats_owner_user_id_idx on public.cats (owner_user_id);
