import type { BreedingRequestRow } from '$lib/supabase/types';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = { cat_id?: string };

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  const catId = typeof body?.cat_id === 'string' ? body.cat_id : '';
  if (!catId) throw error(400, 'cat_id is required');

  // The RLS insert policy already requires the cat to be the caller's, but
  // checking here turns "not yours" into a clear 403 instead of an RLS denial.
  const { data: cat } = await locals.supabase
    .from('cats')
    .select('id')
    .eq('id', catId)
    .eq('owner_user_id', locals.user.id)
    .maybeSingle();

  if (!cat) throw error(403, 'That cat is not yours');

  const { data: alreadyIn } = await locals.supabase
    .from('breeding_cats')
    .select('breeding_id')
    .eq('cat_id', catId)
    .maybeSingle();

  if (alreadyIn) throw error(409, 'That cat already belongs to a breeding');

  const { data, error: dbError } = await locals.supabase
    .from('breeding_requests')
    .insert({
      breeding_id: params.id,
      cat_id: catId,
      requester_user_id: locals.user.id,
    })
    .select('*')
    .single<BreedingRequestRow>();

  if (dbError) {
    // Partial unique index on (breeding_id, cat_id) where status = 'pending'.
    if (dbError.code === '23505') throw error(409, 'A request for that cat is already pending');
    throw error(500, dbError.message);
  }

  return json({ request: data }, { status: 201 });
};
