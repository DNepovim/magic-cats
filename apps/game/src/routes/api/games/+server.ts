import { applyGame, gameCooldownLeft, resolveGame, simulate } from '$lib/game/care';
import type { CatGameRow, CatRow } from '$lib/supabase/types';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = { challenger_cat_id?: string; opponent_cat_id?: string };

/**
 * Plays one game between two cats. The winner is decided here, never by the
 * client: the request only names the two cats.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  const challengerId = typeof body?.challenger_cat_id === 'string' ? body.challenger_cat_id : '';
  const opponentId = typeof body?.opponent_cat_id === 'string' ? body.opponent_cat_id : '';

  if (!challengerId || !opponentId) throw error(400, 'Both cat ids are required');
  if (challengerId === opponentId) throw error(400, 'A cat cannot play against herself');

  const { data: challenger } = await locals.supabase
    .from('cats')
    .select('*')
    .eq('id', challengerId)
    .eq('owner_user_id', locals.user.id)
    .maybeSingle<CatRow>();

  if (!challenger) throw error(403, 'That cat is not yours');

  const { data: opponent } = await locals.supabase
    .from('cats')
    .select('*')
    .eq('id', opponentId)
    .maybeSingle<CatRow>();

  if (!opponent) throw error(404, 'No such cat');

  const now = Date.now();
  if (gameCooldownLeft(challenger, now) > 0) throw error(429, 'She needs a nap first');

  const challengerNow = simulate(challenger, now);
  const opponentNow = simulate(opponent, now);

  if (challengerNow.illness) throw error(409, 'She is too ill to play');

  const outcome = resolveGame(
    { ...challengerNow, domestication_points: challenger.domestication_points },
    { ...opponentNow, domestication_points: opponent.domestication_points },
  );

  const at = new Date(now).toISOString();

  // The game row goes in first: if it fails there is nothing to undo, whereas
  // a happiness bump without a recorded game would be unexplainable.
  const { data: game, error: gameError } = await locals.supabase
    .from('cat_games')
    .insert({
      challenger_cat_id: challenger.id,
      opponent_cat_id: opponent.id,
      winner_cat_id: outcome.challengerWon ? challenger.id : opponent.id,
      kind: outcome.kind,
      challenger_score: outcome.challengerScore,
      opponent_score: outcome.opponentScore,
      played_at: at,
    })
    .select('*')
    .single<CatGameRow>();

  if (gameError) throw error(500, gameError.message);

  // Only the challenger's row moves — the opponent is someone else's cat and
  // is deliberately left untouched. See the migration's header comment.
  const next = applyGame(challenger, outcome.challengerWon, now);

  const { data: updated, error: catError } = await locals.supabase
    .from('cats')
    .update({
      satiety: next.satiety,
      happiness: next.happiness,
      illness: next.illness,
      ill_since: next.ill_since,
      state_at: next.state_at,
      last_played_at: at,
    })
    .eq('id', challenger.id)
    .select('*')
    .single<CatRow>();

  if (catError) throw error(500, catError.message);

  return json({ game, cat: updated, opponent_name: opponent.name }, { status: 201 });
};
