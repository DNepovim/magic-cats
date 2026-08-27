import { isNight } from '$lib/game/care';
import { canMate, dueDateFrom, MATING_COOLDOWN_MS } from '$lib/game/mating';
import type { CatRow } from '$lib/supabase/types';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = { partner_cat_id?: string };

const REFUSALS = {
  'same-gender': 'They are the same gender',
  unhappy: 'Both cats must be at least half happy',
  'already-expecting': 'She is already expecting',
  ill: 'An ill cat will not mate',
  resting: 'One of them mated too recently',
  asleep: 'They are asleep — come back when they wake',
} as const;

/**
 * Puts two cats together. Whether it takes is decided here, once: the client
 * cannot retry the roll, only the mating, and that costs both cats a cooldown.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  const partnerId = typeof body?.partner_cat_id === 'string' ? body.partner_cat_id : '';
  if (!partnerId) throw error(400, 'partner_cat_id is required');
  if (partnerId === params.id) throw error(400, 'A cat cannot mate with herself');

  // One of the pair must be yours; the other may belong to anyone.
  const { data: mine } = await locals.supabase
    .from('cats')
    .select('*')
    .eq('id', params.id)
    .eq('owner_user_id', locals.user.id)
    .maybeSingle<CatRow>();

  if (!mine) throw error(403, 'That cat is not yours');

  const { data: partner } = await locals.supabase
    .from('cats')
    .select('*')
    .eq('id', partnerId)
    .maybeSingle<CatRow>();

  if (!partner) throw error(404, 'No such cat');

  const now = Date.now();
  if (isNight(now)) throw error(409, REFUSALS.asleep);

  const ready = canMate(mine, partner, now);
  if (!ready.ok) throw error(409, REFUSALS[ready.reason]);

  const succeeded = Math.random() < ready.chance;
  const at = new Date(now).toISOString();

  // Both cats rest afterwards either way, so the roll cannot be repeated.
  const { error: coolError } = await locals.supabase
    .from('cats')
    .update({ last_mated_at: at })
    .in('id', [mine.id, partner.id]);

  if (coolError) throw error(500, coolError.message);

  if (!succeeded) {
    return json({ mated: false, chance: ready.chance, retry_after_ms: MATING_COOLDOWN_MS });
  }

  const mother = mine.gender === 'female' ? mine : partner;
  const father = mine.gender === 'female' ? partner : mine;

  const { error: pregnancyError } = await locals.supabase
    .from('cats')
    .update({
      pregnant_since: at,
      due_at: new Date(dueDateFrom(now)).toISOString(),
      father_cat_id: father.id,
    })
    .eq('id', mother.id);

  if (pregnancyError) throw error(500, pregnancyError.message);

  return json({
    mated: true,
    chance: ready.chance,
    mother: { id: mother.id, name: mother.name },
    due_at: new Date(dueDateFrom(now)).toISOString(),
  });
};
