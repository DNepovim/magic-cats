import { nextRunReadyAt } from '$lib/supabase/supply-runs';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/');

  // ?for=<breeding> sends the haul to that breeding's shelf instead.
  const forBreeding = url.searchParams.get('for');
  const { data: breeding } = forBreeding
    ? await locals.supabase
        .from('breedings')
        .select('id, name')
        .eq('id', forBreeding)
        .maybeSingle<{ id: string; name: string }>()
    : { data: null };

  const { data: items } = await locals.supabase
    .from('user_items')
    .select('item_id, quantity')
    .eq('user_id', locals.user.id)
    .gt('quantity', 0)
    .returns<{ item_id: string; quantity: number }[]>();

  return {
    forBreeding: breeding,
    stock: Object.fromEntries((items ?? []).map((row) => [row.item_id, row.quantity])),
    // The button knows when it may be pressed again; the API checks it anyway.
    readyAt: await nextRunReadyAt(locals.supabase, locals.user.id),
  };
};
