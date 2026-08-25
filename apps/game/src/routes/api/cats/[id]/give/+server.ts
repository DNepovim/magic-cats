import { applyFood, applyMedicine } from '$lib/game/care';
import { itemById } from '$lib/game/items';
import type { CatRow, UserItemRow } from '$lib/supabase/types';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = { item_id?: string };

const MEDICINE_ERRORS = {
  'not-ill': 'She is not ill',
  'wrong-medicine': 'That is not the medicine for what she has',
  'too-hungry': 'She is too hungry to keep medicine down — feed her first',
} as const;

/**
 * Gives one item from the inventory to one of your cats. Food, dainty and
 * medicine all arrive here: the item decides what happens, and the stock is
 * spent only once the effect actually applied.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  const itemId = typeof body?.item_id === 'string' ? body.item_id : '';
  const item = itemById(itemId);
  if (!item) throw error(400, 'Unknown item');

  const { data: cat } = await locals.supabase
    .from('cats')
    .select('*')
    .eq('id', params.id)
    .eq('owner_user_id', locals.user.id)
    .maybeSingle<CatRow>();

  if (!cat) throw error(403, 'That cat is not yours');

  const { data: stock } = await locals.supabase
    .from('user_items')
    .select('*')
    .eq('user_id', locals.user.id)
    .eq('item_id', itemId)
    .maybeSingle<UserItemRow>();

  if (!stock || stock.quantity < 1) throw error(409, 'You have none of those left');

  const now = Date.now();
  const result =
    item.kind === 'medicine' ? applyMedicine(cat, itemId, now) : applyFood(cat, itemId, now);

  if (!result) throw error(400, 'That item cannot be given');
  if ('ok' in result && !result.ok) throw error(409, MEDICINE_ERRORS[result.reason]);

  const next = 'ok' in result ? result.snapshot : result;

  const { data: updated, error: catError } = await locals.supabase
    .from('cats')
    .update({
      satiety: next.satiety,
      happiness: next.happiness,
      illness: next.illness,
      ill_since: next.ill_since,
      state_at: next.state_at,
    })
    .eq('id', cat.id)
    .select('*')
    .single<CatRow>();

  if (catError) throw error(500, catError.message);

  // Spent last: a failed effect above leaves the item in the drawer.
  const { error: stockError } = await locals.supabase
    .from('user_items')
    .update({ quantity: stock.quantity - 1 })
    .eq('user_id', locals.user.id)
    .eq('item_id', itemId);

  if (stockError) throw error(500, stockError.message);

  return json({
    cat: updated,
    satiety_gain: 'satietyGain' in result ? result.satietyGain : 0,
    happiness_gain: 'happinessGain' in result ? result.happinessGain : 0,
    taste: 'taste' in result ? result.taste : null,
    cured: item.kind === 'medicine',
  });
};
