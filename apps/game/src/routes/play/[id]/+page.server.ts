import { canPlay, petCooldownLeft } from '$lib/game/care';
import type { CatRow } from '$lib/supabase/types';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/');

  const { data: cat } = await locals.supabase
    .from('cats')
    .select('*')
    .eq('id', params.id)
    .eq('owner_user_id', locals.user.id)
    .maybeSingle<CatRow>();

  if (!cat) throw error(404, 'No such cat of yours');

  const ready = canPlay(cat);

  return {
    cat,
    // The picker greys itself out for the same reasons the API would refuse.
    refusal: ready.ok ? null : ready.reason,
    restingFor: petCooldownLeft(cat),
  };
};
