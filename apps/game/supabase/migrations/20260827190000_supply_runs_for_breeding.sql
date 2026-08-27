-- A supply run can be made on behalf of a breeding: whatever is caught goes
-- onto that breeding's shelf rather than into the runner's own pantry.

alter table public.supply_runs
  add column if not exists breeding_id uuid references public.breedings(id) on delete set null;

-- Crediting the shelf directly (rather than moving something already owned)
-- needs its own function: breeding_items takes no direct writes.
create or replace function public.credit_breeding_shelf(b_id uuid, item text, qty int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  if not public.is_breeding_member(b_id, uid) then
    raise exception 'Only members can stock the shelf';
  end if;
  if qty is null or qty < 1 then
    raise exception 'Nothing to add';
  end if;

  insert into public.breeding_items (breeding_id, item_id, quantity)
  values (b_id, item, qty)
  on conflict (breeding_id, item_id)
    do update set quantity = public.breeding_items.quantity + qty;
end;
$$;

grant execute on function public.credit_breeding_shelf(uuid, text, int) to authenticated;
