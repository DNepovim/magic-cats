import { RUN_COOLDOWN_MS, RUN_DURATION_MS, RUN_ITEM_COUNT } from '$lib/game/supply';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type RunRow = { id: string; seed: number; started_at: string };
type Payload = { breeding_id?: string };

/** Opens a run and hands out its seed. The schedule is derived from the seed
 *  on both sides — see $lib/game/supply. */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  const breedingId = typeof body?.breeding_id === 'string' ? body.breeding_id : null;

  const { data: last } = await locals.supabase
    .from('supply_runs')
    .select('id, seed, started_at')
    .eq('user_id', locals.user.id)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle<RunRow>();

  const now = Date.now();
  if (last) {
    const left = Date.parse(last.started_at) + RUN_COOLDOWN_MS - now;
    if (left > 0) throw error(429, `The shops are restocking — ${Math.ceil(left / 60000)} min`);
  }

  const seed = Math.floor(Math.random() * 2_000_000_000);

  const { data, error: dbError } = await locals.supabase
    .from('supply_runs')
    .insert({ user_id: locals.user.id, seed, breeding_id: breedingId })
    .select('id, seed, started_at')
    .single<RunRow>();

  if (dbError) throw error(500, dbError.message);

  return json(
    { run_id: data.id, seed: data.seed, duration_ms: RUN_DURATION_MS, item_count: RUN_ITEM_COUNT },
    { status: 201 },
  );
};
