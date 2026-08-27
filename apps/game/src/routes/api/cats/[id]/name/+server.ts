import type { CatRow } from '$lib/supabase/types';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = { name?: string };

/**
 * Names a newborn kitten. Only while she is still unnamed — this is the naming
 * that follows a birth, not a rename tool.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > 32) throw error(400, 'Name must be 1–32 characters');

  const { data, error: dbError } = await locals.supabase
    .from('cats')
    .update({ name, named: true })
    .eq('id', params.id)
    .eq('owner_user_id', locals.user.id)
    .eq('named', false)
    .select('*')
    .maybeSingle<CatRow>();

  if (dbError) throw error(500, dbError.message);
  if (!data) throw error(409, 'That kitten already has her name');

  return json({ cat: data });
};
