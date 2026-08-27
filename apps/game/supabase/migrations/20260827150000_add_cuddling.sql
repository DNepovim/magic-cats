-- Cuddling: a small, frequent kindness, separate from playing.
--
-- Its own timestamp rather than sharing last_petted_at, so a cuddle does not
-- eat the play cooldown and vice versa.

alter table public.cats
  add column if not exists last_cuddled_at timestamptz;
