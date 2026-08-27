import { itemById } from '$lib/game/items';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = { item_id?: string; action?: 'donate' | 'take' };

/**
 * Moves one item between your pantry and the breeding's shelf. Both directions
 * go through a database function so the decrement and the increment happen in
 * one statement — otherwise two members could take the same last tin.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  const itemId = typeof body?.item_id === 'string' ? body.item_id : '';
  const action = body?.action;

  if (!itemById(itemId)) throw error(400, 'Unknown item');
  if (action !== 'donate' && action !== 'take') {
    throw error(400, 'action must be "donate" or "take"');
  }

  const { error: rpcError } = await locals.supabase.rpc(
    action === 'donate' ? 'donate_to_breeding' : 'take_from_breeding',
    { b_id: params.id, item: itemId },
  );

  // The function raises for every rule it enforces — not a member, nothing
  // left — and those are the player's problem, not a server fault.
  if (rpcError) throw error(409, rpcError.message);

  return json({ ok: true });
};
