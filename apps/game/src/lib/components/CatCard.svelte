<script lang="ts">
  import { MOOD_EMOJI, moodTier, simulate } from '$lib/game/care';
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
      Partial<Pick<CatRow, 'satiety' | 'happiness' | 'state_at' | 'illness'>>;
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
      : state.illness
        ? ILLNESS_EMOJI[state.illness]
        : MOOD_EMOJI[moodTier(state.happiness)],
  );

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
    class="flex w-24 shrink-0 flex-col items-center gap-2 rounded-xl p-2"
    style="background: rgba(8,0,26,0.6); border: 1px solid var(--color-magic);"
  >
    <img
      src={cat.image_url}
      alt={cat.name}
      width="64"
      height="64"
      class="rounded-full object-cover"
      style="width:64px;height:64px;border:2px solid var(--color-cyan);box-shadow:0 0 6px var(--color-cyan);"
    />
    <p
      class="w-full truncate text-center font-bold"
      style="font-family: var(--font-display); color: var(--color-gold); font-size: 0.8rem;"
      title={cat.name}
    >
      {cat.name}
    </p>
    <p class="font-retro text-[0.5rem]" style="color: var(--color-silver); opacity: 0.7;">
      {mood ?? ''}
      {cat.domestication_points} pts
    </p>
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
    style="background: rgba(8,0,26,0.6); border: 2px solid var(--color-magic); box-shadow: 0 0 8px rgba(155,0,255,0.4);"
  >
    <img
      src={cat.image_url}
      alt={cat.name}
      width="56"
      height="56"
      class="rounded-full object-cover"
      style="width:56px;height:56px;border:2px solid var(--color-cyan);box-shadow:0 0 8px var(--color-cyan);"
    />
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
        {cat.domestication_points} pts · {formatted}
      </p>
      {#if breeding}
        <p class="font-retro truncate text-[0.55rem]" style="color: var(--color-lime);">
          🏰 {breeding.name}
        </p>
      {/if}
    </div>
  </article>
{/if}
