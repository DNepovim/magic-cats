-- Handing a cat to another member of her breeding.
--
-- This cannot be a plain update: the RLS policy on cats uses its USING clause
-- as the WITH CHECK too, so an owner may not write a row that is no longer
-- theirs. A function with its own checks is the honest way to allow exactly
-- this one transfer.

create or replace function public.give_cat_to_member(cat uuid, to_cat uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  giver uuid := auth.uid();
  recipient uuid;
  shared_breeding uuid;
begin
  if giver is null then
    raise exception 'Not signed in';
  end if;

  if not exists (
    select 1 from public.cats c
    where c.id = cat and c.owner_user_id = giver and c.died_at is null
  ) then
    raise exception 'That cat is not yours';
  end if;

  select owner_user_id into recipient
    from public.cats where id = to_cat and died_at is null;

  if recipient is null then
    raise exception 'No such cat';
  end if;
  if recipient = giver then
    raise exception 'That cat is already yours';
  end if;

  -- The cat must be on a roster the recipient also belongs to: you hand a cat
  -- to someone you share a breeding with, not to a stranger.
  select bc.breeding_id into shared_breeding
    from public.breeding_cats bc
   where bc.cat_id = cat
     and public.is_breeding_member(bc.breeding_id, recipient)
   limit 1;

  if shared_breeding is null then
    raise exception 'You share no breeding with them';
  end if;

  update public.cats set owner_user_id = recipient where id = cat;
end;
$$;

grant execute on function public.give_cat_to_member(uuid, uuid) to authenticated;
