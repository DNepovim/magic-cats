import { applyCuddle } from '$lib/game/care';
import type { CatRow } from '$lib/supabase/types';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const REFUSALS = {
  asleep: 'She is asleep — do not wake her',
  resting: 'She has had enough cuddling for now',
  ill: 'She is too ill',
} as const;

/** A cuddle: no item, no game, just a lift. Welcome even when she is ill. */
export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const { data: cat } = await locals.supabase
    .from('cats')
    .select('*')
    .eq('id', params.id)
    .eq('owner_user_id', locals.user.id)
    .maybeSingle<CatRow>();

  if (!cat) throw error(403, 'That cat is not yours');

  const now = Date.now();
  const outcome = applyCuddle(cat, now);
  if (!outcome.ok) throw error(outcome.reason === 'resting' ? 429 : 409, REFUSALS[outcome.reason]);

  const next = outcome.snapshot;
  const { data: updated, error: dbError } = await locals.supabase
    .from('cats')
    .update({
      satiety: next.satiety,
      happiness: next.happiness,
      illness: next.illness,
      ill_since: next.ill_since,
      state_at: next.state_at,
      last_cuddled_at: next.state_at,
    })
    .eq('id', cat.id)
    .select('*')
    .single<CatRow>();

  if (dbError) throw error(500, dbError.message);

  return json({ cat: updated });
};
