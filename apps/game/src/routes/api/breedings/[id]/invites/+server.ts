import type { BreedingInviteRow, CatRow } from '$lib/supabase/types';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = { cat_id?: string };

/**
 * Invites a cat to a breeding. Only the breeding's creator may send one, and
 * only to a cat that is free to join — an invite the recipient could not accept
 * is worse than no invite.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  const catId = typeof body?.cat_id === 'string' ? body.cat_id : '';
  if (!catId) throw error(400, 'cat_id is required');

  const { data: breeding } = await locals.supabase
    .from('breedings')
    .select('id')
    .eq('id', params.id)
    .eq('owner_user_id', locals.user.id)
    .maybeSingle();

  if (!breeding) throw error(403, 'Only the breeding admin can invite');

  const { data: cat } = await locals.supabase
    .from('cats')
    .select('id, owner_user_id, name')
    .eq('id', catId)
    .maybeSingle<Pick<CatRow, 'id' | 'owner_user_id' | 'name'>>();

  if (!cat) throw error(404, 'No such cat');
  if (cat.owner_user_id === locals.user.id) {
    throw error(400, 'Your own cats join directly — no invite needed');
  }

  const { data: alreadyIn } = await locals.supabase
    .from('breeding_cats')
    .select('breeding_id')
    .eq('cat_id', catId)
    .maybeSingle();

  if (alreadyIn) throw error(409, 'That cat already belongs to a breeding');

  const { data, error: dbError } = await locals.supabase
    .from('breeding_invites')
    .insert({
      breeding_id: params.id,
      cat_id: catId,
      invited_user_id: cat.owner_user_id,
    })
    .select('*')
    .single<BreedingInviteRow>();

  if (dbError) {
    // Partial unique index on (breeding_id, cat_id) where status = 'pending'.
    if (dbError.code === '23505') throw error(409, 'That cat is already invited');
    throw error(500, dbError.message);
  }

  return json({ invite: data }, { status: 201 });
};
