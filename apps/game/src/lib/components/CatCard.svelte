<script lang="ts">
  import { ageInDays, isNight, MOOD_EMOJI, moodTier, simulate } from '$lib/game/care';
  import { GENDER_SYMBOL } from '$lib/game/mating';
  import { ILLNESS_EMOJI } from '$lib/game/items';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import type { CatRow } from '$lib/supabase/types';

  const {
    cat,
    variant = 'compact',
    breeding = null,
  }: {
    cat: Pick<CatRow, 'id' | 'name' | 'image_url' | 'domesticated_at' | 'domestication_points'> &
      Partial<
        Pick<
          CatRow,
          | 'satiety'
          | 'happiness'
          | 'state_at'
          | 'illness'
          | 'gender'
          | 'birth_at'
          | 'origin'
          | 'pregnant_since'
          | 'due_at'
        >
      >;
    variant?: 'compact' | 'tile';
    /** The breeding this cat lives in, when it is worth naming here. */
    breeding?: { id: string; name: string } | null;
  } = $props();

  // Only rows that carry the condition columns can show a mood — the breeding
  // roster and the dashboard both do, a bare cat reference may not.
  const state = $derived(
    cat.satiety === undefined || cat.happiness === undefined || cat.state_at === undefined
      ? null
      : simulate({
          id: cat.id,
          satiety: cat.satiety,
          happiness: cat.happiness,
          state_at: cat.state_at,
          illness: cat.illness ?? null,
        }),
  );

  const mood = $derived(
    state === null
      ? null
      : isNight()
        ? '😴'
        : state.illness
          ? ILLNESS_EMOJI[state.illness]
          : MOOD_EMOJI[moodTier(state.happiness)],
  );

  /** Named, not just an emoji: an ill cat should be unmissable in a list. */
  const illnessName = $derived(
    state?.illness
      ? {
          sniffles: m.illness_sniffles(),
          earmites: m.illness_earmites(),
          furball: m.illness_furball(),
        }[state.illness]
      : null,
  );

  const expecting = $derived(Boolean(cat.pregnant_since && cat.due_at));

  /** Her age in whole days — the number that replaced her taming points. */
  const age = $derived(cat.birth_at ? Math.floor(ageInDays(cat.birth_at)) : null);

  const formatted = $derived(
    new Date(cat.domesticated_at).toLocaleDateString(getLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
  );
</script>

{#if variant === 'tile'}
  <article
    class="flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl p-2"
    style="background: rgba(8,0,26,0.6); border: 1px solid {illnessName
      ? 'var(--color-magenta)'
      : 'var(--color-magic)'};"
  >
    <div class="relative">
      <img
        src={cat.image_url}
        alt={cat.name}
        width="64"
        height="64"
        class="rounded-full object-cover"
        style="width:64px;height:64px;border:2px solid {expecting
          ? 'var(--color-magenta)'
          : 'var(--color-cyan)'};box-shadow:0 0 6px {expecting
          ? 'var(--color-magenta)'
          : 'var(--color-cyan)'};"
      />
      {#if expecting}
        <span
          class="absolute -top-1 -left-1 grid h-5 w-5 place-items-center rounded-full text-[0.7rem]"
          style="background: var(--color-void); border: 1px solid var(--color-magenta);"
        >
          🤰
        </span>
      {/if}
      {#if cat.gender}
        <span
          class="absolute -right-1 -bottom-1 grid h-5 w-5 place-items-center rounded-full text-[0.7rem]"
          style="background: var(--color-void); border: 1px solid {cat.gender === 'female'
            ? 'var(--color-magenta)'
            : 'var(--color-cyan)'}; color: {cat.gender === 'female'
            ? 'var(--color-magenta)'
            : 'var(--color-cyan)'};"
          title={cat.gender}
        >
          {GENDER_SYMBOL[cat.gender]}
        </span>
      {/if}
    </div>
    <p
      class="w-full truncate text-center font-bold"
      style="font-family: var(--font-display); color: var(--color-gold); font-size: 0.8rem;"
      title={cat.name}
    >
      {cat.name}
    </p>
    <p class="font-retro text-[0.5rem]" style="color: var(--color-silver); opacity: 0.7;">
      {mood ?? ''}
      {age === null ? '' : m.cat_age({ days: age })}
    </p>
    {#if illnessName}
      <p
        class="font-retro w-full truncate text-center text-[0.5rem]"
        style="color: var(--color-magenta);"
        title={illnessName}
      >
        {illnessName}
      </p>
    {/if}
    {#if breeding}
      <p
        class="font-retro w-full truncate text-center text-[0.5rem]"
        style="color: var(--color-lime);"
        title={breeding.name}
      >
        🏰 {breeding.name}
      </p>
    {/if}
  </article>
{:else}
  <article
    class="flex items-center gap-3 rounded-xl p-3"
    style="background: rgba(8,0,26,0.6); border: 2px solid {illnessName
      ? 'var(--color-magenta)'
      : 'var(--color-magic)'}; box-shadow: 0 0 8px {illnessName
      ? 'rgba(255,0,128,0.45)'
      : 'rgba(155,0,255,0.4)'};"
  >
    <div class="relative shrink-0">
      <img
        src={cat.image_url}
        alt={cat.name}
        width="56"
        height="56"
        class="rounded-full object-cover"
        style="width:56px;height:56px;border:2px solid {expecting
          ? 'var(--color-magenta)'
          : 'var(--color-cyan)'};box-shadow:0 0 8px {expecting
          ? 'var(--color-magenta)'
          : 'var(--color-cyan)'};"
      />
      {#if expecting}
        <span
          class="absolute -top-1 -left-1 grid h-5 w-5 place-items-center rounded-full text-[0.7rem]"
          style="background: var(--color-void); border: 1px solid var(--color-magenta);"
        >
          🤰
        </span>
      {/if}
      {#if cat.gender}
        <span
          class="absolute -right-1 -bottom-1 grid h-5 w-5 place-items-center rounded-full text-[0.7rem]"
          style="background: var(--color-void); border: 1px solid {cat.gender === 'female'
            ? 'var(--color-magenta)'
            : 'var(--color-cyan)'}; color: {cat.gender === 'female'
            ? 'var(--color-magenta)'
            : 'var(--color-cyan)'};"
          title={cat.gender}
        >
          {GENDER_SYMBOL[cat.gender]}
        </span>
      {/if}
    </div>
    <div class="min-w-0 flex-1">
      <p
        class="truncate font-bold"
        style="font-family: var(--font-display); color: var(--color-gold); font-size: 1rem;"
      >
        {cat.name}
      </p>
      <p
        class="font-retro truncate text-[0.55rem]"
        style="color: var(--color-silver); opacity: 0.7;"
      >
        {mood ?? ''}
        {age === null ? formatted : m.cat_age({ days: age })} · {cat.origin === 'born'
          ? m.cat_born()
          : m.cat_tamed()}
      </p>
      {#if illnessName && state?.illness}
        <p class="font-retro truncate text-[0.55rem]" style="color: var(--color-magenta);">
          {ILLNESS_EMOJI[state.illness]}
          {m.illness_has({ illness: illnessName })}
        </p>
      {/if}
      {#if breeding}
        <p class="font-retro truncate text-[0.55rem]" style="color: var(--color-lime);">
          🏰 {breeding.name}
        </p>
      {/if}
    </div>
  </article>
{/if}
