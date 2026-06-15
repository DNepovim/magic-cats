import type { CatRow } from '$lib/supabase/types';
import type { PageServerLoad } from './$types';

type PageState =
  | { state: 'login' }
  | { state: 'tame-cta' }
  | {
      state: 'dashboard';
      myCat: CatRow;
      otherCats: Pick<
        CatRow,
        'id' | 'name' | 'image_url' | 'domesticated_at' | 'domestication_points'
      >[];
    };

export const load: PageServerLoad = async ({ locals }): Promise<PageState> => {
  if (!locals.user) return { state: 'login' };

  const { data: myCat } = await locals.supabase
    .from('cats')
    .select('*')
    .eq('owner_user_id', locals.user.id)
    .maybeSingle<CatRow>();

  if (!myCat) return { state: 'tame-cta' };

  const { data: otherCats } = await locals.supabase
    .from('cats')
    .select('id, name, image_url, owner_user_id, domesticated_at, domestication_points')
    .neq('owner_user_id', locals.user.id)
    .order('domesticated_at', { ascending: false })
    .limit(20);

  return {
    state: 'dashboard',
    myCat,
    otherCats: otherCats ?? [],
  };
};
