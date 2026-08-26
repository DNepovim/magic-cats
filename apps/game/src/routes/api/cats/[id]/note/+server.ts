import type { CatNoteRow } from '$lib/supabase/types';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = { body?: string };

const MAX_LENGTH = 2000;

/**
 * Saves the private note on one of your own cats. An empty note deletes the
 * row rather than storing a blank one, so "no note" has a single shape.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const payload = (await request.json().catch(() => null)) as Payload | null;
  const body = typeof payload?.body === 'string' ? payload.body.trim() : '';
  if (body.length > MAX_LENGTH) throw error(400, `A note can be at most ${MAX_LENGTH} characters`);

  // The RLS insert policy checks this too; doing it here turns "not yours"
  // into a clear 403 rather than a silent no-op.
  const { data: cat } = await locals.supabase
    .from('cats')
    .select('id')
    .eq('id', params.id)
    .eq('owner_user_id', locals.user.id)
    .maybeSingle();

  if (!cat) throw error(403, 'That cat is not yours');

  if (body.length === 0) {
    const { error: deleteError } = await locals.supabase
      .from('cat_notes')
      .delete()
      .eq('cat_id', params.id);

    if (deleteError) throw error(500, deleteError.message);
    return json({ note: null });
  }

  const { data, error: dbError } = await locals.supabase
    .from('cat_notes')
    .upsert({
      cat_id: params.id,
      owner_user_id: locals.user.id,
      body,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single<CatNoteRow>();

  if (dbError) throw error(500, dbError.message);

  return json({ note: data });
};
