import type {
  BreedingInviteRow,
  BreedingPostRow,
  BreedingRequestRow,
  BreedingRow,
  CatRow,
} from '$lib/supabase/types';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export type PendingRequest = BreedingRequestRow & { cat: CatRow | null };

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/');

  const { data: breeding } = await locals.supabase
    .from('breedings')
    .select('*')
    .eq('id', params.id)
    .maybeSingle<BreedingRow>();

  if (!breeding) throw error(404, 'Breeding not found');

  const { data: memberCats } = await locals.supabase
    .from('breeding_cats')
    .select('added_at, cats(*)')
    .eq('breeding_id', params.id)
    .order('added_at', { ascending: true })
    .returns<{ added_at: string; cats: CatRow | null }[]>();

  const cats = (memberCats ?? [])
    .map((row) => row.cats)
    .filter((cat): cat is CatRow => cat !== null);

  const isAdmin = breeding.owner_user_id === locals.user.id;
  const isMember = isAdmin || cats.some((cat) => cat.owner_user_id === locals.user?.id);

  // Posts are member-only at the RLS level, so a non-member simply gets none
  // back rather than an error.
  const { data: posts } = isMember
    ? await locals.supabase
        .from('breeding_posts')
        .select('*')
        .eq('breeding_id', params.id)
        .order('created_at', { ascending: true })
        .returns<BreedingPostRow[]>()
    : { data: [] as BreedingPostRow[] };

  const { data: requests } = isAdmin
    ? await locals.supabase
        .from('breeding_requests')
        .select('*, cats(*)')
        .eq('breeding_id', params.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .returns<(BreedingRequestRow & { cats: CatRow | null })[]>()
    : { data: [] as (BreedingRequestRow & { cats: CatRow | null })[] };

  // Only cats that are free to join, so the apply form can't offer an
  // impossible choice.
  const { data: ownedCats } = await locals.supabase
    .from('cats')
    .select('*')
    .eq('owner_user_id', locals.user.id)
    .returns<CatRow[]>();

  const { data: placements } = await locals.supabase
    .from('breeding_cats')
    .select('cat_id')
    .returns<{ cat_id: string }[]>();

  const placed = new Set((placements ?? []).map((p) => p.cat_id));

  // Named, not just counted, so the aside can say *which* cat is waiting.
  const { data: myPending } = await locals.supabase
    .from('breeding_requests')
    .select('cat_id, created_at, cats(name)')
    .eq('breeding_id', params.id)
    .eq('requester_user_id', locals.user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .returns<{ cat_id: string; created_at: string; cats: { name: string } | null }[]>();

  const pendingCatIds = new Set((myPending ?? []).map((r) => r.cat_id));

  // Invitations, from both ends. RLS returns only rows this user is party to,
  // so the admin sees what they sent and everyone else sees what they were sent.
  const { data: invites } = await locals.supabase
    .from('breeding_invites')
    .select('*, cats(*)')
    .eq('breeding_id', params.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .returns<(BreedingInviteRow & { cats: CatRow | null })[]>();

  const openInvites = (invites ?? []).map((invite) => ({ ...invite, cat: invite.cats }));

  // Cats the admin could still invite: other people's, not already placed, not
  // already asked. An invite nobody could accept is worse than none.
  const invitedCatIds = new Set(openInvites.map((invite) => invite.cat_id));
  const { data: freeCats } = isAdmin
    ? await locals.supabase
        .from('cats')
        .select('id, name, image_url, owner_user_id')
        .neq('owner_user_id', locals.user.id)
        .order('domesticated_at', { ascending: false })
        .limit(40)
        .returns<Pick<CatRow, 'id' | 'name' | 'image_url' | 'owner_user_id'>[]>()
    : { data: [] as Pick<CatRow, 'id' | 'name' | 'image_url' | 'owner_user_id'>[] };

  // The shared shelf, and what you personally have to put on it. Both are
  // member-only: RLS returns nothing here to anyone else.
  const { data: shelf } = isMember
    ? await locals.supabase
        .from('breeding_items')
        .select('item_id, quantity')
        .eq('breeding_id', params.id)
        .gt('quantity', 0)
        .returns<{ item_id: string; quantity: number }[]>()
    : { data: [] as { item_id: string; quantity: number }[] };

  const { data: myItems } = isMember
    ? await locals.supabase
        .from('user_items')
        .select('item_id, quantity')
        .eq('user_id', locals.user.id)
        .gt('quantity', 0)
        .returns<{ item_id: string; quantity: number }[]>()
    : { data: [] as { item_id: string; quantity: number }[] };

  return {
    breeding,
    cats,
    shelf: Object.fromEntries((shelf ?? []).map((row) => [row.item_id, row.quantity])),
    myStock: Object.fromEntries((myItems ?? []).map((row) => [row.item_id, row.quantity])),
    /** Open invites the admin has sent. */
    sentInvites: isAdmin ? openInvites : [],
    /** Open invites addressed to you. */
    myInvites: openInvites.filter((invite) => invite.invited_user_id === locals.user?.id),
    invitableCats: (freeCats ?? []).filter(
      (cat) => !placed.has(cat.id) && !invitedCatIds.has(cat.id),
    ),
    posts: posts ?? [],
    pendingRequests: (requests ?? []).map((r) => ({ ...r, cat: r.cats })),
    isAdmin,
    isMember,
    myUserId: locals.user.id,
    availableCats: (ownedCats ?? []).filter(
      (cat) => !placed.has(cat.id) && !pendingCatIds.has(cat.id),
    ),
    myPendingCats: (myPending ?? []).map((r) => ({
      cat_id: r.cat_id,
      name: r.cats?.name ?? '',
      created_at: r.created_at,
    })),
  };
};
