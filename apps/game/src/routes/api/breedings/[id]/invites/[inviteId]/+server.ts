import type { BreedingInviteRow } from '$lib/supabase/types';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Payload = { action?: 'accept' | 'decline' };

/** Answers an invitation. Only the invited owner may, and only once. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const body = (await request.json().catch(() => null)) as Payload | null;
  const action = body?.action;
  if (action !== 'accept' && action !== 'decline') {
    throw error(400, 'action must be "accept" or "decline"');
  }

  const { data: invite } = await locals.supabase
    .from('breeding_invites')
    .select('*')
    .eq('id', params.inviteId)
    .eq('breeding_id', params.id)
    .eq('invited_user_id', locals.user.id)
    .eq('status', 'pending')
    .maybeSingle<BreedingInviteRow>();

  if (!invite) throw error(404, 'No open invitation of yours with that id');

  if (action === 'accept') {
    // Roster first: if the cat slipped into another breeding meanwhile, the
    // unique constraint says so and the invite stays open rather than being
    // marked accepted with nothing joined.
    const { error: joinError } = await locals.supabase
      .from('breeding_cats')
      .insert({ breeding_id: params.id, cat_id: invite.cat_id });

    if (joinError) {
      if (joinError.code === '23505') throw error(409, 'That cat already belongs to a breeding');
      throw error(500, joinError.message);
    }
  }

  const { data, error: updateError } = await locals.supabase
    .from('breeding_invites')
    .update({
      status: action === 'accept' ? 'accepted' : 'declined',
      decided_at: new Date().toISOString(),
    })
    .eq('id', invite.id)
    .select('*')
    .single<BreedingInviteRow>();

  if (updateError) throw error(500, updateError.message);

  return json({ invite: data });
};
