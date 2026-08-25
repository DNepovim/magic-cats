import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = { cat_id?: string };

/**
 * Adds a cat to a breeding directly, skipping the request flow. Only the
 * breeding's creator may do this, and only with a cat they own — asking
 * yourself for permission to join your own breeding makes no sense.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  const catId = typeof body?.cat_id === 'string' ? body.cat_id : '';
  if (!catId) throw error(400, 'cat_id is required');

  // RLS lets the creator insert any cat; the ownership check below is what
  // actually keeps someone else's cat out of your breeding.
  const { data: breeding } = await locals.supabase
    .from('breedings')
    .select('id')
    .eq('id', params.id)
    .eq('owner_user_id', locals.user.id)
    .maybeSingle();

  if (!breeding) throw error(403, 'Only the breeding admin can add cats directly');

  const { data: cat } = await locals.supabase
    .from('cats')
    .select('id')
    .eq('id', catId)
    .eq('owner_user_id', locals.user.id)
    .maybeSingle();

  if (!cat) throw error(403, 'That cat is not yours');

  const { data, error: dbError } = await locals.supabase
    .from('breeding_cats')
    .insert({ breeding_id: params.id, cat_id: catId })
    .select('cat_id')
    .single<{ cat_id: string }>();

  if (dbError) {
    // breeding_cats_one_breeding_per_cat — a cat lives in one breeding at most.
    if (dbError.code === '23505') throw error(409, 'That cat already belongs to a breeding');
    throw error(500, dbError.message);
  }

  return json({ cat_id: data.cat_id }, { status: 201 });
};
