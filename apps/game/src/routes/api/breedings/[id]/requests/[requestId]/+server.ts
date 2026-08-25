import type { BreedingRequestRow } from '$lib/supabase/types';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = { action?: 'accept' | 'reject' };

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  const action = body?.action;
  if (action !== 'accept' && action !== 'reject') {
    throw error(400, 'action must be "accept" or "reject"');
  }

  // Only the breeding's creator decides. RLS enforces this too, but an explicit
  // check gives a 403 rather than a confusing empty update.
  const { data: breeding } = await locals.supabase
    .from('breedings')
    .select('id')
    .eq('id', params.id)
    .eq('owner_user_id', locals.user.id)
    .maybeSingle();

  if (!breeding) throw error(403, 'Only the breeding admin can decide requests');

  const { data: pending } = await locals.supabase
    .from('breeding_requests')
    .select('*')
    .eq('id', params.requestId)
    .eq('breeding_id', params.id)
    .eq('status', 'pending')
    .maybeSingle<BreedingRequestRow>();

  if (!pending) throw error(404, 'No pending request with that id');

  if (action === 'accept') {
    // Add the cat first: if it slipped into another breeding since the request
    // was made, the unique constraint rejects it and the request stays pending
    // rather than being marked accepted with nothing added.
    const { error: addError } = await locals.supabase
      .from('breeding_cats')
      .insert({ breeding_id: params.id, cat_id: pending.cat_id });

    if (addError) {
      if (addError.code === '23505') throw error(409, 'That cat already belongs to a breeding');
      throw error(500, addError.message);
    }
  }

  const { data, error: updateError } = await locals.supabase
    .from('breeding_requests')
    .update({
      status: action === 'accept' ? 'accepted' : 'rejected',
      decided_at: new Date().toISOString(),
    })
    .eq('id', params.requestId)
    .select('*')
    .single<BreedingRequestRow>();

  if (updateError) throw error(500, updateError.message);

  return json({ request: data });
};
