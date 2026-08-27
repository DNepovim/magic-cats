-- Kittens arrive unnamed: the owner names them, as they do a cat they tame.
-- Existing cats all have names their owners chose, so they default to named.

alter table public.cats
  add column if not exists named boolean not null default true;
