import type { BreedingRow } from '$lib/supabase/types';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** A cat of yours, reduced to what the list needs to name it. */
export type CatBadge = { id: string; name: string };

export type BreedingListItem = BreedingRow & {
  /** Your cats invited to this breeding and yet to answer. */
  invited_cats: CatBadge[];
  cat_count: number;
  /** You founded it. */
  is_admin: boolean;
  /** You founded it, or one of your cats lives in it. */
  is_member: boolean;
  /** Your cats on this roster. */
  my_cats: CatBadge[];
  /** Your cats waiting for this breeding's admin to decide. */
  pending_cats: CatBadge[];
};

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/');

  const userId = locals.user.id;

  const { data: breedings } = await locals.supabase
    .from('breedings')
    .select('*')
    .order('created_at', { ascending: false })
    .returns<BreedingRow[]>();

  // The cat comes along so the list can name which of yours is where.
  const { data: memberships } = await locals.supabase
    .from('breeding_cats')
    .select('breeding_id, cats(id, name, owner_user_id)')
    .returns<
      { breeding_id: string; cats: { id: string; name: string; owner_user_id: string } | null }[]
    >();

  const counts = new Map<string, number>();
  const myCatsByBreeding = new Map<string, CatBadge[]>();
  for (const { breeding_id, cats } of memberships ?? []) {
    counts.set(breeding_id, (counts.get(breeding_id) ?? 0) + 1);
    if (cats?.owner_user_id === userId) {
      myCatsByBreeding.set(breeding_id, [
        ...(myCatsByBreeding.get(breeding_id) ?? []),
        { id: cats.id, name: cats.name },
      ]);
    }
  }

  // Only your own pending requests — RLS hides everyone else's anyway.
  const { data: myRequests } = await locals.supabase
    .from('breeding_requests')
    .select('breeding_id, cat_id, cats(name)')
    .eq('requester_user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .returns<{ breeding_id: string; cat_id: string; cats: { name: string } | null }[]>();

  const pendingByBreeding = new Map<string, CatBadge[]>();
  for (const { breeding_id, cat_id, cats } of myRequests ?? []) {
    pendingByBreeding.set(breeding_id, [
      ...(pendingByBreeding.get(breeding_id) ?? []),
      { id: cat_id, name: cats?.name ?? '' },
    ]);
  }

  // RLS narrows this to invites addressed to you (and any you sent as admin).
  const { data: invites } = await locals.supabase
    .from('breeding_invites')
    .select('breeding_id, cat_id, cats(name)')
    .eq('invited_user_id', userId)
    .eq('status', 'pending')
    .returns<{ breeding_id: string; cat_id: string; cats: { name: string } | null }[]>();

  const invitedByBreeding = new Map<string, CatBadge[]>();
  for (const { breeding_id, cat_id, cats } of invites ?? []) {
    invitedByBreeding.set(breeding_id, [
      ...(invitedByBreeding.get(breeding_id) ?? []),
      { id: cat_id, name: cats?.name ?? '' },
    ]);
  }

  return {
    breedings: (breedings ?? []).map((b) => {
      const my_cats = myCatsByBreeding.get(b.id) ?? [];
      const is_admin = b.owner_user_id === userId;
      return {
        ...b,
        cat_count: counts.get(b.id) ?? 0,
        is_admin,
        is_member: is_admin || my_cats.length > 0,
        my_cats,
        pending_cats: pendingByBreeding.get(b.id) ?? [],
        invited_cats: invitedByBreeding.get(b.id) ?? [],
      };
    }),
  };
};
