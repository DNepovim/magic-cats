import { MAX_CATS, THRESHOLD } from '$lib/game/constants';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canonicalCatImageUrl } from '$lib/game/images';

type Payload = {
  name?: string;
  image_url?: string;
  domestication_points?: number;
};

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  if (!body) throw error(400, 'Invalid JSON');

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const imageUrl = typeof body.image_url === 'string' ? body.image_url : '';
  const points =
    typeof body.domestication_points === 'number' ? body.domestication_points : -1;

  if (name.length < 1 || name.length > 32) throw error(400, 'Name must be 1–32 characters');
  if (!isHttpUrl(imageUrl)) throw error(400, 'image_url must be a valid URL');

  // The client should already have done this, but the row the API writes is
  // the one that has to render.
  const canonicalUrl = canonicalCatImageUrl(imageUrl);
  if (points < THRESHOLD) throw error(400, `Cat is not domesticated yet (${points}/${THRESHOLD})`);

  const { count, error: countError } = await locals.supabase
    .from('cats')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', locals.user.id);

  if (countError) throw error(500, countError.message);
  if ((count ?? 0) >= MAX_CATS) throw error(409, `You already have ${MAX_CATS} cats`);

  const { data, error: dbError } = await locals.supabase
    .from('cats')
    .insert({
      owner_user_id: locals.user.id,
      name,
      image_url: canonicalUrl,
      domestication_points: points,
    })
    .select('*')
    .single();

  if (dbError) throw error(500, dbError.message);

  return json({ cat: data }, { status: 201 });
};
