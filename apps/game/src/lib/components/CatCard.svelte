<script lang="ts">
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import type { CatRow } from '$lib/supabase/types';

  const {
    cat,
    variant = 'compact',
  }: {
    cat: Pick<CatRow, 'id' | 'name' | 'image_url' | 'domesticated_at' | 'domestication_points'>;
    variant?: 'hero' | 'compact';
  } = $props();

  const formatted = $derived(
    new Date(cat.domesticated_at).toLocaleDateString(getLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
  );
</script>

{#if variant === 'hero'}
  <article
    class="relative flex flex-col items-center gap-4 rounded-2xl p-1"
    style="background: conic-gradient(from var(--angle), var(--color-magic), var(--color-magenta), var(--color-cyan), var(--color-gold), var(--color-magic));animation: border-rotate 4s linear infinite;"
  >
    <div
      class="flex w-full flex-col items-center gap-4 rounded-xl p-6"
      style="background: linear-gradient(145deg,#0a001f,#1a003a,#00101a);"
    >
      <span class="badge-new">{m.cat_your_cat_badge()}</span>

      <div class="relative">
        <div
          class="starburst"
          style="width:300px;height:300px;top:50%;left:50%;transform:translate(-50%,-50%);"
        ></div>
        <img
          src={cat.image_url}
          alt={cat.name}
          width="220"
          height="220"
          class="float-anim relative rounded-full object-cover"
          style="width:220px;height:220px;border:4px solid var(--color-gold);box-shadow:0 0 30px var(--color-gold),0 0 60px var(--color-magic);"
        />
      </div>

      <h2
        class="title-shimmer text-center"
        style="font-family: var(--font-chunky); font-size: clamp(2rem, 6vw, 3.5rem); line-height: 1.1;"
      >
        {cat.name}
      </h2>

      <p class="font-cursive text-xl" style="color: var(--color-cyan);">
        {m.cat_tamed_with({ points: cat.domestication_points })}
      </p>
      <p class="font-retro text-xs" style="color: var(--color-silver); opacity: 0.7;">
        {m.cat_domesticated_on({ date: formatted })}
      </p>
    </div>
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
        {cat.domestication_points} pts · {formatted}
      </p>
    </div>
  </article>
{/if}
