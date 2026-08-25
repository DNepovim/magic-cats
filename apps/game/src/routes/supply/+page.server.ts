import { RUN_COOLDOWN_MS } from '$lib/game/supply';
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

  const { data: last } = await locals.supabase
    .from('supply_runs')
    .select('started_at')
    .eq('user_id', locals.user.id)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ started_at: string }>();

  return {
    stock: Object.fromEntries((items ?? []).map((row) => [row.item_id, row.quantity])),
    // The button knows when it may be pressed again; the API checks it anyway.
    readyAt: last ? new Date(Date.parse(last.started_at) + RUN_COOLDOWN_MS).toISOString() : null,
  };
};
