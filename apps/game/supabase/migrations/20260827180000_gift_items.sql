-- Giving an item to another player.
--
-- The recipient is named by one of their cats, never by their user id: the
-- client has no business knowing who owns what beyond the cats it can already
-- see. Like the shelf moves, the two halves happen in one statement.

create or replace function public.gift_item_to_cat_owner(target_cat uuid, item text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  giver uuid := auth.uid();
  recipient uuid;
begin
  if giver is null then
    raise exception 'Not signed in';
  end if;

  select owner_user_id into recipient
    from public.cats
   where id = target_cat and died_at is null;

  if recipient is null then
    raise exception 'No such cat';
  end if;
  if recipient = giver then
    raise exception 'That cat is already yours';
  end if;

  update public.user_items
     set quantity = quantity - 1
   where user_id = giver and item_id = item and quantity > 0;

  if not found then
    raise exception 'You have none of those to give';
  end if;

  insert into public.user_items (user_id, item_id, quantity)
  values (recipient, item, 1)
  on conflict (user_id, item_id)
    do update set quantity = public.user_items.quantity + 1;
end;
$$;

grant execute on function public.gift_item_to_cat_owner(uuid, text) to authenticated;
