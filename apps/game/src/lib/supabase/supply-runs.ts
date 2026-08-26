import { RUN_COOLDOWN_MS } from '$lib/game/supply';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * When this user may start their next supply run, or null if they may start one
 * now. Both the supply page and the dashboard show a countdown from this; the
 * start endpoint checks the same rule itself, so this is only ever a hint.
 */
export const nextRunReadyAt = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> => {
  const { data: last } = await supabase
    .from('supply_runs')
    .select('started_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ started_at: string }>();

  if (!last) return null;

  const readyAt = Date.parse(last.started_at) + RUN_COOLDOWN_MS;
  return readyAt > Date.now() ? new Date(readyAt).toISOString() : null;
};
