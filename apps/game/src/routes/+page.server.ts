import type { CatRow } from '$lib/supabase/types';
import type { PageServerLoad } from './$types';

type OtherCat = Pick<
  CatRow,
  'id' | 'name' | 'image_url' | 'domesticated_at' | 'domestication_points'
>;

type PageState =
  | { state: 'login' }
  | { state: 'tame-cta' }
  | {
      state: 'dashboard';
      myCats: CatRow[];
      otherCats: OtherCat[];
    };

export const load: PageServerLoad = async ({ locals }): Promise<PageState> => {
  if (!locals.user) return { state: 'login' };

  const { data: myCats } = await locals.supabase
    .from('cats')
    .select('*')
    .eq('owner_user_id', locals.user.id)
    .order('domesticated_at', { ascending: true })
    .returns<CatRow[]>();

  if (!myCats || myCats.length === 0) return { state: 'tame-cta' };

  const { data: otherCats } = await locals.supabase
    .from('cats')
    .select('id, name, image_url, owner_user_id, domesticated_at, domestication_points')
    .neq('owner_user_id', locals.user.id)
    .order('domesticated_at', { ascending: false })
    .limit(20)
    .returns<OtherCat[]>();

  return {
    state: 'dashboard',
    myCats,
    otherCats: otherCats ?? [],
  };
};
