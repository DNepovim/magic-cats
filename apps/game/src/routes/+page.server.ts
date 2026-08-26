import type {
  BreedingRow,
  CatBreeding,
  CatRow,
  DashboardBreeding,
  GameFeedItem,
} from '$lib/supabase/types';
import { nextRunReadyAt } from '$lib/supabase/supply-runs';
import type { PageServerLoad } from './$types';

type OtherCat = Pick<
  CatRow,
  | 'id'
  | 'name'
  | 'image_url'
  | 'domesticated_at'
  | 'domestication_points'
  | 'satiety'
  | 'happiness'
  | 'state_at'
  | 'illness'
>;

type PageState =
  | { state: 'login' }
  | { state: 'tame-cta' }
  | {
      state: 'dashboard';
      myCats: CatRow[];
      otherCats: OtherCat[];
      breedings: DashboardBreeding[];
      games: GameFeedItem[];
      /** item id → how many you have. */
      stock: Record<string, number>;
      /** cat id → your private note on that cat. */
      notes: Record<string, string>;
      /** When the next supply run may start, or null if one may start now. */
      supplyReadyAt: string | null;
      /** cat id → the breeding that cat lives in. */
      breedingByCat: Record<string, CatBreeding>;
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
    .select(
      'id, name, image_url, owner_user_id, domesticated_at, domestication_points, satiety, happiness, state_at, illness',
    )
    .neq('owner_user_id', locals.user.id)
    .order('domesticated_at', { ascending: false })
    .limit(20)
    .returns<OtherCat[]>();

  const { data: breedings } = await locals.supabase
    .from('breedings')
    .select('id, name, owner_user_id')
    .order('created_at', { ascending: false })
    .returns<Pick<BreedingRow, 'id' | 'name' | 'owner_user_id'>[]>();

  // One pass over the memberships feeds both the per-cat labels and the
  // per-breeding counts on the dashboard.
  const { data: memberships } = await locals.supabase
    .from('breeding_cats')
    .select('cat_id, breeding_id, breedings(id, name), cats(owner_user_id)')
    .returns<
      {
        cat_id: string;
        breeding_id: string;
        breedings: CatBreeding | null;
        cats: { owner_user_id: string } | null;
      }[]
    >();

  const breedingByCat: Record<string, CatBreeding> = {};
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  for (const row of memberships ?? []) {
    if (row.breedings) breedingByCat[row.cat_id] = row.breedings;
    counts.set(row.breeding_id, (counts.get(row.breeding_id) ?? 0) + 1);
    if (row.cats?.owner_user_id === locals.user.id) mine.add(row.breeding_id);
  }

  // Both sides of the scoreline are named, and only games one of your cats
  // took part in are worth the space.
  const myCatIds = myCats.map((cat) => cat.id);
  const { data: games } = await locals.supabase
    .from('cat_games')
    .select(
      `id, kind, challenger_score, opponent_score, winner_cat_id, played_at,
       challenger:cats!cat_games_challenger_cat_id_fkey(id, name),
       opponent:cats!cat_games_opponent_cat_id_fkey(id, name)`,
    )
    .or(`challenger_cat_id.in.(${myCatIds}),opponent_cat_id.in.(${myCatIds})`)
    .order('played_at', { ascending: false })
    .limit(8)
    .returns<GameFeedItem[]>();

  const { data: items } = await locals.supabase
    .from('user_items')
    .select('item_id, quantity')
    .eq('user_id', locals.user.id)
    .gt('quantity', 0)
    .returns<{ item_id: string; quantity: number }[]>();

  // RLS keeps this to your own notes; no filter of ours is what protects them.
  const { data: noteRows } = await locals.supabase
    .from('cat_notes')
    .select('cat_id, body')
    .returns<{ cat_id: string; body: string }[]>();

  return {
    state: 'dashboard',
    supplyReadyAt: await nextRunReadyAt(locals.supabase, locals.user.id),
    notes: Object.fromEntries((noteRows ?? []).map((row) => [row.cat_id, row.body])),
    stock: Object.fromEntries((items ?? []).map((row) => [row.item_id, row.quantity])),
    myCats,
    otherCats: otherCats ?? [],
    breedings: (breedings ?? []).map(({ id, name, owner_user_id }) => ({
      id,
      name,
      cat_count: counts.get(id) ?? 0,
      is_member: owner_user_id === locals.user?.id || mine.has(id),
    })),
    breedingByCat,
    games: games ?? [],
  };
};
