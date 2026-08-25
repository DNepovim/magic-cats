import type { BreedingRow } from '$lib/supabase/types';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = {
  name?: string;
  description?: string;
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  if (!body) throw error(400, 'Invalid JSON');

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (name.length < 1 || name.length > 48) throw error(400, 'Name must be 1–48 characters');
  if (description.length > 500) throw error(400, 'Description must be at most 500 characters');

  const { data, error: dbError } = await locals.supabase
    .from('breedings')
    .insert({ owner_user_id: locals.user.id, name, description })
    .select('*')
    .single<BreedingRow>();

  if (dbError) throw error(500, dbError.message);

  return json({ breeding: data }, { status: 201 });
};
