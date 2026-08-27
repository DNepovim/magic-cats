import { ageInDays } from '$lib/game/care';
import { litterFor } from '$lib/game/mating';
import type { CatRow } from '$lib/supabase/types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Delivers any litters that have come due for this owner.
 *
 * A birth cannot happen inside the pure replay, and there is no scheduler here,
 * so it happens the next time the owner looks at their cats. Clearing the
 * pregnancy is the guard: the update only matches while `due_at` is still set,
 * so of two concurrent loads exactly one delivers the litter.
 *
 * Kittens are deliberately not counted against MAX_CATS — they arrive whether
 * there is room or not, which is rather the point of kittens.
 */
export type Death = { name: string; age_days: number };

/**
 * Retires any cat who has reached her lifespan.
 *
 * The row stays — kittens keep their parents' names, and a family tree should
 * outlive its family — but a dead cat is excluded everywhere by `died_at`.
 * Whoever writes `died_at` reports the death, so it is announced exactly once.
 */
export const retireDueCats = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<Death[]> => {
  const { data: living } = await supabase
    .from('cats')
    .select('id, name, birth_at, lifespan_days')
    .eq('owner_user_id', userId)
    .is('died_at', null)
    .returns<{ id: string; name: string; birth_at: string; lifespan_days: number }[]>();

  const deaths: Death[] = [];

  for (const cat of living ?? []) {
    const age = ageInDays(cat.birth_at);
    if (age < cat.lifespan_days) continue;

    const { data: claimed } = await supabase
      .from('cats')
      .update({ died_at: new Date().toISOString() })
      .eq('id', cat.id)
      .is('died_at', null)
      .select('id')
      .maybeSingle();

    if (claimed) deaths.push({ name: cat.name, age_days: Math.floor(age) });
  }

  return deaths;
};

export const deliverDueLitters = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<number> => {
  const { data: due } = await supabase
    .from('cats')
    .select('*')
    .eq('owner_user_id', userId)
    .is('died_at', null)
    .not('due_at', 'is', null)
    .lte('due_at', new Date().toISOString())
    .returns<CatRow[]>();

  if (!due || due.length === 0) return 0;

  let born = 0;

  for (const mother of due) {
    // Whoever clears the pregnancy owns the birth.
    const { data: claimed } = await supabase
      .from('cats')
      .update({ pregnant_since: null, due_at: null })
      .eq('id', mother.id)
      .not('due_at', 'is', null)
      .select('id')
      .maybeSingle();

    if (!claimed) continue;

    const { data: father } = mother.father_cat_id
      ? await supabase
          .from('cats')
          .select('image_url, domestication_points')
          .eq('id', mother.father_cat_id)
          .maybeSingle<Pick<CatRow, 'image_url' | 'domestication_points'>>()
      : { data: null };

    const parents = [
      { image_url: mother.image_url, domestication_points: mother.domestication_points },
      ...(father ? [father] : []),
    ];

    const kittens = litterFor(mother.id, mother.due_at ?? '', parents);

    const { error: insertError } = await supabase.from('cats').insert(
      kittens.map((kitten) => ({
        owner_user_id: userId,
        // A suggestion only — the owner names the kitten, as they do a cat they
        // tame, and `named` stays false until they do.
        name: kitten.name,
        named: false,
        origin: 'born',
        birth_at: new Date().toISOString(),
        image_url: kitten.image_url,
        domestication_points: kitten.domestication_points,
        gender: kitten.gender,
        taste_seed: kitten.taste_seed,
        mother_cat_id: mother.id,
        father_cat_id: mother.father_cat_id,
      })),
    );

    if (!insertError) born += kittens.length;
  }

  return born;
};
