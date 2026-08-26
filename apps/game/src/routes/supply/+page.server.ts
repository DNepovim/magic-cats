import { nextRunReadyAt } from '$lib/supabase/supply-runs';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/');

  const { data: items } = await locals.supabase
    .from('user_items')
    .select('item_id, quantity')
    .eq('user_id', locals.user.id)
    .gt('quantity', 0)
    .returns<{ item_id: string; quantity: number }[]>();

  return {
    stock: Object.fromEntries((items ?? []).map((row) => [row.item_id, row.quantity])),
    // The button knows when it may be pressed again; the API checks it anyway.
    readyAt: await nextRunReadyAt(locals.supabase, locals.user.id),
  };
};
