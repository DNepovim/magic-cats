import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Removes a cat from a breeding. Serves both directions: the creator kicking a
 * cat out, and a cat's owner leaving. The RLS delete policy permits exactly
 * those two, so an unrelated user's delete matches no rows and 404s.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const { data, error: dbError } = await locals.supabase
    .from('breeding_cats')
    .delete()
    .eq('breeding_id', params.id)
    .eq('cat_id', params.catId)
    .select('cat_id')
    .maybeSingle();

  if (dbError) throw error(500, dbError.message);
  if (!data) throw error(404, 'That cat is not in this breeding, or you may not remove it');

  return json({ cat_id: data.cat_id });
};
