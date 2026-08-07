import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  // The RLS "delete own cat" policy already restricts this to the owner, so the
  // owner_user_id filter is belt-and-braces — but it also turns someone else's
  // cat id into a clean 404 instead of a silent no-op.
  const { data, error: dbError } = await locals.supabase
    .from('cats')
    .delete()
    .eq('id', params.id)
    .eq('owner_user_id', locals.user.id)
    .select('id')
    .maybeSingle();

  if (dbError) throw error(500, dbError.message);
  if (!data) throw error(404, 'Cat not found');

  return json({ id: data.id });
};
