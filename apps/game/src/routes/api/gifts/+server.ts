import { itemById } from '$lib/game/items';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = { to_cat_id?: string; item_id?: string };

/**
 * Gives one item to another player, addressed by one of their cats. One-way by
 * design: you may put something in someone's pantry, never take from it.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  const toCatId = typeof body?.to_cat_id === 'string' ? body.to_cat_id : '';
  const itemId = typeof body?.item_id === 'string' ? body.item_id : '';

  if (!toCatId) throw error(400, 'to_cat_id is required');
  if (!itemById(itemId)) throw error(400, 'Unknown item');

  const { error: rpcError } = await locals.supabase.rpc('gift_item_to_cat_owner', {
    target_cat: toCatId,
    item: itemId,
  });

  if (rpcError) throw error(409, rpcError.message);

  return json({ ok: true });
};
