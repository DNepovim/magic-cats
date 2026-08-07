import { MAX_CATS } from '$lib/game/constants';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/');

  const { count } = await locals.supabase
    .from('cats')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', locals.user.id);

  if ((count ?? 0) >= MAX_CATS) throw redirect(303, '/');

  return {};
};
