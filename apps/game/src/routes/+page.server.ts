import type {
  BreedingRow,
  CatBreeding,
  CatRow,
  DashboardAlert,
  DashboardBreeding,
  GameFeedItem,
} from '$lib/supabase/types';
import { deliverDueLitters, retireDueCats, type Death } from '$lib/supabase/births';
import { nextRunReadyAt } from '$lib/supabase/supply-runs';
import type { PageServerLoad } from './$types';

type OtherCat = Pick<
  CatRow,
  | 'id'
  | 'name'
  | 'image_url'
  | 'domesticated_at'
  | 'domestication_points'
  | 'owner_user_id'
  | 'satiety'
  | 'happiness'
  | 'state_at'
  | 'illness'
  | 'gender'
  | 'birth_at'
  | 'origin'
  | 'pregnant_since'
  | 'due_at'
  | 'last_mated_at'
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
      /** Things waiting on you: join requests to decide, invitations to answer. */
      alerts: DashboardAlert[];
      /** Cats who died of old age in this very load — announced once. */
      deaths: Death[];
      /** Your own name, or null until you have chosen one. */
      username: string | null;
      /** user id → username, for the players whose cats you can see. */
      playerNames: Record<string, string>;
      /** cat id → its parents' names, for cats born here. */
      parents: Record<string, { mother: string | null; father: string | null }>;
      /** Breedings whose shared shelf you may use. */
      memberBreedings: { id: string; name: string }[];
      /** breeding id → what is on that shelf. */
      shelves: Record<string, Record<string, number>>;
      /** cat id → the breeding that cat lives in. */
      breedingByCat: Record<string, CatBreeding>;
    };

export const load: PageServerLoad = async ({ locals }): Promise<PageState> => {
  if (!locals.user) return { state: 'login' };

  // No scheduler here, so the dashboard is where time catches up: litters that
  // came due are born, and cats who reached their span are retired. Births run
  // first so a kitten is never born to a mother who died in the same load.
  await deliverDueLitters(locals.supabase, locals.user.id);
  const deaths = await retireDueCats(locals.supabase, locals.user.id);

  const { data: myCats } = await locals.supabase
    .from('cats')
    .select('*')
    .eq('owner_user_id', locals.user.id)
    .is('died_at', null)
    .order('domesticated_at', { ascending: true })
    .returns<CatRow[]>();

  if (!myCats || myCats.length === 0) return { state: 'tame-cta' };

  const { data: otherCats } = await locals.supabase
    .from('cats')
    .select(
      'id, name, image_url, owner_user_id, domesticated_at, domestication_points, satiety, happiness, state_at, illness, gender, birth_at, origin, pregnant_since, due_at, last_mated_at',
    )
    .neq('owner_user_id', locals.user.id)
    .is('died_at', null)
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

  // Anything waiting on the player, gathered for the banner at the top of the
  // dashboard. RLS already narrows both queries to rows this user is party to —
  // requests on breedings they run, invitations addressed to them.
  const myBreedingIds = (breedings ?? [])
    .filter((b) => b.owner_user_id === locals.user?.id)
    .map((b) => b.id);

  const { data: joinRequests } = myBreedingIds.length
    ? await locals.supabase
        .from('breeding_requests')
        .select('id, breeding_id, cats(name), breedings(name)')
        .in('breeding_id', myBreedingIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .returns<
          { id: string; breeding_id: string; cats: { name: string } | null; breedings: { name: string } | null }[]
        >()
    : { data: [] as never[] };

  const { data: invitations } = await locals.supabase
    .from('breeding_invites')
    .select('id, breeding_id, cats(name), breedings(name)')
    .eq('invited_user_id', locals.user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .returns<
      { id: string; breeding_id: string; cats: { name: string } | null; breedings: { name: string } | null }[]
    >();

  const alerts: DashboardAlert[] = [
    ...(joinRequests ?? []).map((row) => ({
      kind: 'request' as const,
      breeding_id: row.breeding_id,
      breeding_name: row.breedings?.name ?? '',
      cat_name: row.cats?.name ?? '',
    })),
    ...(invitations ?? []).map((row) => ({
      kind: 'invite' as const,
      breeding_id: row.breeding_id,
      breeding_name: row.breedings?.name ?? '',
      cat_name: row.cats?.name ?? '',
    })),
  ];

  // The shelves you may use, for the exchange modal. `mine` already holds the
  // breedings one of your cats is in; founding one counts too.
  const memberBreedings = (breedings ?? [])
    .filter((b) => b.owner_user_id === locals.user?.id || mine.has(b.id))
    .map(({ id, name }) => ({ id, name }));

  const { data: shelfRows } = memberBreedings.length
    ? await locals.supabase
        .from('breeding_items')
        .select('breeding_id, item_id, quantity')
        .in(
          'breeding_id',
          memberBreedings.map((b) => b.id),
        )
        .gt('quantity', 0)
        .returns<{ breeding_id: string; item_id: string; quantity: number }[]>()
    : { data: [] as { breeding_id: string; item_id: string; quantity: number }[] };

  const shelves: Record<string, Record<string, number>> = {};
  for (const row of shelfRows ?? []) {
    shelves[row.breeding_id] = { ...(shelves[row.breeding_id] ?? {}), [row.item_id]: row.quantity };
  }

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

  // Parents, for the cats of yours that were born rather than tamed. Dead
  // parents are still named: a family tree outlives its family.
  const parentIds = myCats.flatMap((cat) =>
    [cat.mother_cat_id, cat.father_cat_id].filter((id): id is string => id !== null),
  );

  const { data: parentRows } = parentIds.length
    ? await locals.supabase
        .from('cats')
        .select('id, name')
        .in('id', parentIds)
        .returns<{ id: string; name: string }[]>()
    : { data: [] as { id: string; name: string }[] };

  const nameOf = new Map((parentRows ?? []).map((row) => [row.id, row.name]));
  const parents = Object.fromEntries(
    myCats
      .filter((cat) => cat.mother_cat_id || cat.father_cat_id)
      .map((cat) => [
        cat.id,
        {
          mother: cat.mother_cat_id ? (nameOf.get(cat.mother_cat_id) ?? null) : null,
          father: cat.father_cat_id ? (nameOf.get(cat.father_cat_id) ?? null) : null,
        },
      ]),
  );

  // Your name, and the names of the players whose cats are on screen.
  const { data: myProfile } = await locals.supabase
    .from('profiles')
    .select('username')
    .eq('user_id', locals.user.id)
    .maybeSingle<{ username: string }>();

  const otherOwnerIds = [...new Set((otherCats ?? []).map((cat) => cat.owner_user_id))];
  const { data: otherProfiles } = otherOwnerIds.length
    ? await locals.supabase
        .from('profiles')
        .select('user_id, username')
        .in('user_id', otherOwnerIds)
        .returns<{ user_id: string; username: string }[]>()
    : { data: [] as { user_id: string; username: string }[] };

  return {
    state: 'dashboard',
    username: myProfile?.username ?? null,
    playerNames: Object.fromEntries(
      (otherProfiles ?? []).map((row) => [row.user_id, row.username]),
    ),
    deaths,
    parents,
    supplyReadyAt: await nextRunReadyAt(locals.supabase, locals.user.id),
    alerts,
    memberBreedings,
    shelves,
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
