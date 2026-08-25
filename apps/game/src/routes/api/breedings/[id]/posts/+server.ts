import type { BreedingPostRow } from '$lib/supabase/types';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = { body?: string };

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const payload = (await request.json().catch(() => null)) as Payload | null;
  const body = typeof payload?.body === 'string' ? payload.body.trim() : '';

  if (body.length < 1 || body.length > 2000) {
    throw error(400, 'Message must be 1–2000 characters');
  }

  const { data, error: dbError } = await locals.supabase
    .from('breeding_posts')
    .insert({
      breeding_id: params.id,
      author_user_id: locals.user.id,
      body,
    })
    .select('*')
    .single<BreedingPostRow>();

  if (dbError) {
    // The insert policy requires is_breeding_member(), so a non-member's write
    // is refused by RLS rather than by an explicit check here.
    if (dbError.code === '42501') throw error(403, 'Only members can post here');
    throw error(500, dbError.message);
  }

  return json({ post: data }, { status: 201 });
};
