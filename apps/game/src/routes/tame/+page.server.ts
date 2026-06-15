import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/');

  const { data: myCat } = await locals.supabase
    .from('cats')
    .select('id')
    .eq('owner_user_id', locals.user.id)
    .maybeSingle();

  if (myCat) throw redirect(303, '/');

  return {};
};
