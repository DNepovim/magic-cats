import { RUN_DURATION_MS, RUN_GRACE_MS, grantsFor } from '$lib/game/supply';
import type { UserItemRow } from '$lib/supabase/types';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = { run_id?: string; caught?: number[] };
type RunRow = {
  id: string;
  seed: number;
  started_at: string;
  finished_at: string | null;
  breeding_id: string | null;
};

/**
 * Hands a run in. The claimed catches are checked against the schedule the
 * seed produces, so only items that were genuinely in the air can be earned,
 * and each one only once.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  const runId = typeof body?.run_id === 'string' ? body.run_id : '';
  const caught = Array.isArray(body?.caught) ? body.caught : [];
  if (!runId) throw error(400, 'run_id is required');

  const { data: run } = await locals.supabase
    .from('supply_runs')
    .select('id, seed, started_at, finished_at, breeding_id')
    .eq('id', runId)
    .eq('user_id', locals.user.id)
    .maybeSingle<RunRow>();

  if (!run) throw error(404, 'No such run');
  if (run.finished_at) throw error(409, 'That run is already handed in');

  const deadline = Date.parse(run.started_at) + RUN_DURATION_MS + RUN_GRACE_MS;
  if (Date.now() > deadline) throw error(410, 'That run has expired');

  const granted = grantsFor(run.seed, caught);

  // Fold duplicates so each item is one upsert rather than one per catch.
  const totals = new Map<string, number>();
  for (const itemId of granted) totals.set(itemId, (totals.get(itemId) ?? 0) + 1);

  if (totals.size > 0 && run.breeding_id) {
    // A run made for a breeding stocks its shelf; the runner keeps nothing.
    for (const [itemId, count] of totals) {
      const { error: shelfError } = await locals.supabase.rpc('credit_breeding_shelf', {
        b_id: run.breeding_id,
        item: itemId,
        qty: count,
      });
      if (shelfError) throw error(409, shelfError.message);
    }
  } else if (totals.size > 0) {
    const { data: existing } = await locals.supabase
      .from('user_items')
      .select('*')
      .eq('user_id', locals.user.id)
      .in('item_id', [...totals.keys()])
      .returns<UserItemRow[]>();

    const owned = new Map((existing ?? []).map((row) => [row.item_id, row.quantity]));

    const { error: upsertError } = await locals.supabase.from('user_items').upsert(
      [...totals].map(([item_id, count]) => ({
        user_id: locals.user!.id,
        item_id,
        quantity: (owned.get(item_id) ?? 0) + count,
      })),
    );

    if (upsertError) throw error(500, upsertError.message);
  }

  const { error: finishError } = await locals.supabase
    .from('supply_runs')
    .update({ finished_at: new Date().toISOString() })
    .eq('id', run.id);

  if (finishError) throw error(500, finishError.message);

  return json({ granted: [...totals].map(([item_id, count]) => ({ item_id, count })) });
};
