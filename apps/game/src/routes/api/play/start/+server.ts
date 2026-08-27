import { canPlay } from '$lib/game/care';
import { GAME_DURATION_MS, GAME_IDS, type GameId } from '$lib/game/play';
import type { CatRow } from '$lib/supabase/types';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = { cat_id?: string; game?: GameId };

const REFUSALS = {
  resting: 'She has had enough playing for now',
  ill: 'She is too ill to play — cure her first',
  asleep: 'She is asleep — come back when she wakes',
} as const;

/** Opens a round and hands out its seed. The plan is derived from the seed on
 *  both sides — see $lib/game/play. */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  const catId = typeof body?.cat_id === 'string' ? body.cat_id : '';
  const game = body?.game;

  if (!catId) throw error(400, 'cat_id is required');
  if (!game || !GAME_IDS.includes(game)) throw error(400, 'Unknown game');

  const { data: cat } = await locals.supabase
    .from('cats')
    .select('*')
    .eq('id', catId)
    .eq('owner_user_id', locals.user.id)
    .maybeSingle<CatRow>();

  if (!cat) throw error(403, 'That cat is not yours');

  // Refusing here rather than after the round means nobody plays for nothing.
  const ready = canPlay(cat);
  if (!ready.ok) throw error(ready.reason === 'resting' ? 429 : 409, REFUSALS[ready.reason]);

  const seed = Math.floor(Math.random() * 2_000_000_000);

  const { data, error: dbError } = await locals.supabase
    .from('play_rounds')
    .insert({ user_id: locals.user.id, cat_id: cat.id, game, seed })
    .select('id, seed')
    .single<{ id: string; seed: number }>();

  if (dbError) throw error(500, dbError.message);

  return json(
    { round_id: data.id, seed: data.seed, duration_ms: GAME_DURATION_MS[game] },
    { status: 201 },
  );
};
