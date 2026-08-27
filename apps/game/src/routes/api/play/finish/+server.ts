import { applyPlay } from '$lib/game/care';
import {
  GAME_DURATION_MS,
  ROUND_GRACE_MS,
  gameAffinity,
  happinessForRound,
  scoreRound,
  type Claim,
  type GameId,
} from '$lib/game/play';
import type { CatRow } from '$lib/supabase/types';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = { round_id?: string; claim?: Claim };

type RoundRow = {
  id: string;
  cat_id: string;
  game: GameId;
  seed: number;
  started_at: string;
  finished_at: string | null;
};

const REFUSALS = {
  resting: 'She has had enough playing for now',
  ill: 'She is too ill to play — cure her first',
  asleep: 'She is asleep — come back when she wakes',
} as const;

/**
 * Hands a round in. The claim is scored against what the seed actually
 * contained — and, for the games whose moves are not seeded objects, capped by
 * how long the round really lasted.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  const roundId = typeof body?.round_id === 'string' ? body.round_id : '';
  const claim = (body?.claim ?? {}) as Claim;
  if (!roundId) throw error(400, 'round_id is required');

  const { data: round } = await locals.supabase
    .from('play_rounds')
    .select('id, cat_id, game, seed, started_at, finished_at')
    .eq('id', roundId)
    .eq('user_id', locals.user.id)
    .maybeSingle<RoundRow>();

  if (!round) throw error(404, 'No such round');
  if (round.finished_at) throw error(409, 'That round is already handed in');

  const now = Date.now();
  const elapsed = now - Date.parse(round.started_at);
  if (elapsed > GAME_DURATION_MS[round.game] + ROUND_GRACE_MS) {
    throw error(410, 'That round has expired');
  }

  const { data: cat } = await locals.supabase
    .from('cats')
    .select('*')
    .eq('id', round.cat_id)
    .eq('owner_user_id', locals.user.id)
    .maybeSingle<CatRow>();

  if (!cat) throw error(403, 'That cat is not yours');

  const score = scoreRound(round.game, round.seed, claim, elapsed);
  const affinity = gameAffinity(cat.taste_seed, round.game);
  const gain = happinessForRound(score, affinity);

  const outcome = applyPlay(cat, gain, now);
  if (!outcome.ok) {
    throw error(outcome.reason === 'resting' ? 429 : 409, REFUSALS[outcome.reason]);
  }

  const next = outcome.snapshot;
  const { data: updated, error: catError } = await locals.supabase
    .from('cats')
    .update({
      satiety: next.satiety,
      happiness: next.happiness,
      illness: next.illness,
      ill_since: next.ill_since,
      state_at: next.state_at,
      last_petted_at: next.state_at,
    })
    .eq('id', cat.id)
    .select('*')
    .single<CatRow>();

  if (catError) throw error(500, catError.message);

  const { error: roundError } = await locals.supabase
    .from('play_rounds')
    .update({ finished_at: new Date(now).toISOString(), score, happiness_gain: gain })
    .eq('id', round.id);

  if (roundError) throw error(500, roundError.message);

  // The affinity is deliberately not returned: which games she loves is for the
  // player to notice, not for the UI to announce.
  return json({ score, happiness_gain: gain, cat: updated });
};
