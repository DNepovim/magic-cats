import type { ProfileRow } from '$lib/supabase/types';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = { username?: string };

const VALID = /^[\p{L}\p{N} _-]{3,20}$/u;

/** Claims or changes your username. */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  const username = typeof body?.username === 'string' ? body.username.trim() : '';

  if (!VALID.test(username)) {
    throw error(400, 'A name is 3–20 letters, numbers, spaces, dashes or underscores');
  }

  const { data, error: dbError } = await locals.supabase
    .from('profiles')
    .upsert({ user_id: locals.user.id, username })
    .select('*')
    .single<ProfileRow>();

  if (dbError) {
    // The unique index on lower(username) is what actually reserves a name.
    if (dbError.code === '23505') throw error(409, 'Someone already goes by that name');
    throw error(500, dbError.message);
  }

  return json({ profile: data });
};
