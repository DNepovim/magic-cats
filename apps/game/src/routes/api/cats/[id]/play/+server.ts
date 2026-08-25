import { applyPlay } from '$lib/game/care';
import type { CatRow } from '$lib/supabase/types';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** A play session with you: costs nothing, lifts her mood, then she wants a break. */
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
  const next = applyPlay(cat, now);
  if (!next) throw error(429, 'She has had enough playing for now');

  const { data: updated, error: dbError } = await locals.supabase
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

  if (dbError) throw error(500, dbError.message);

  return json({ cat: updated });
};
