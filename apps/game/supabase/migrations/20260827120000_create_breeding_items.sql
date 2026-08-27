-- A shared shelf inside a breeding.
--
-- Members put spare food and medicine on it; any member can take something off
-- into their own pantry. Movement happens through the two functions below
-- rather than through direct writes: taking an item is a decrement here and an
-- increment there, and doing that in two round trips from the client would let
-- two members take the same last tin.

create table if not exists public.breeding_items (
  breeding_id uuid not null references public.breedings(id) on delete cascade,
  item_id text not null,
  quantity int not null default 0 check (quantity >= 0),
  primary key (breeding_id, item_id)
);

alter table public.breeding_items enable row level security;

-- Members can see the shelf. Nobody writes to it directly — see the functions.
drop policy if exists "members read shelf" on public.breeding_items;
create policy "members read shelf" on public.breeding_items
  for select to authenticated using (public.is_breeding_member(breeding_id, auth.uid()));

-- ──────────────────────────────────────────────────────────────────────────
-- Moving one item, atomically, in one statement each way.
-- SECURITY DEFINER so the function owns the write; every rule it needs to
-- enforce is checked inside it.
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.donate_to_breeding(b_id uuid, item text)
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

  update public.user_items
     set quantity = quantity - 1
   where user_id = uid and item_id = item and quantity > 0;

  if not found then
    raise exception 'You have none of those to give';
  end if;

  insert into public.breeding_items (breeding_id, item_id, quantity)
  values (b_id, item, 1)
  on conflict (breeding_id, item_id)
    do update set quantity = public.breeding_items.quantity + 1;
end;
$$;

create or replace function public.take_from_breeding(b_id uuid, item text)
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
    raise exception 'Only members can take from the shelf';
  end if;

  update public.breeding_items
     set quantity = quantity - 1
   where breeding_id = b_id and item_id = item and quantity > 0;

  if not found then
    raise exception 'The shelf is out of those';
  end if;

  insert into public.user_items (user_id, item_id, quantity)
  values (uid, item, 1)
  on conflict (user_id, item_id)
    do update set quantity = public.user_items.quantity + 1;
end;
$$;

-- Grants — RLS does not imply table privileges. See
-- 20260805120000_grant_cats_privileges.sql.
grant select on public.breeding_items to authenticated;
grant all on public.breeding_items to service_role;

grant execute on function public.donate_to_breeding(uuid, text) to authenticated;
grant execute on function public.take_from_breeding(uuid, text) to authenticated;
