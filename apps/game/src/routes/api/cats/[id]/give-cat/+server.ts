import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = { to_cat_id?: string };

/**
 * Hands one of your cats to another member of her breeding. The recipient is
 * named by one of their cats, as everywhere else — the client never handles
 * user ids.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  const toCatId = typeof body?.to_cat_id === 'string' ? body.to_cat_id : '';
  if (!toCatId) throw error(400, 'to_cat_id is required');

  const { error: rpcError } = await locals.supabase.rpc('give_cat_to_member', {
    cat: params.id,
    to_cat: toCatId,
  });

  if (rpcError) throw error(409, rpcError.message);

  return json({ ok: true });
};
