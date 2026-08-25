<script lang="ts">
  import {
    CURE_SATIETY,
    MOOD_EMOJI,
    STAT_MAX,
    formatCountdown,
    hungerTier,
    moodTier,
    petCooldownLeft,
    simulate,
  } from '$lib/game/care';
  import { ILLNESS_EMOJI } from '$lib/game/items';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import type { CatBreeding, CatRow } from '$lib/supabase/types';

  const {
    cat,
    breeding = null,
    busy = false,
    playing = false,
    onDropItem,
    onPlay,
  }: {
    cat: CatRow;
    breeding?: CatBreeding | null;
    busy?: boolean;
    /** True while the play animation is running. */
    playing?: boolean;
    onDropItem: (itemId: string) => void;
    onPlay: () => void;
  } = $props();

  // She keeps living while you look at her, so the clock is state.
  let now = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 5000);
    return () => clearInterval(id);
  });

  let dragOver = $state(false);

  const condition = $derived(simulate(cat, now));
  const petLeft = $derived(petCooldownLeft(cat, now));

  const mood = $derived(
    {
      miserable: m.mood_miserable(),
      grumpy: m.mood_grumpy(),
      content: m.mood_content(),
      happy: m.mood_happy(),
      blissful: m.mood_blissful(),
    }[moodTier(condition.happiness)],
  );

  const hunger = $derived(
    {
      starving: m.hunger_starving(),
      hungry: m.hunger_hungry(),
      peckish: m.hunger_peckish(),
      fed: m.hunger_fed(),
      stuffed: m.hunger_stuffed(),
    }[hungerTier(condition.satiety)],
  );

  const illnessName = $derived(
    condition.illness === null
      ? null
      : {
          sniffles: m.illness_sniffles(),
          earmites: m.illness_earmites(),
          furball: m.illness_furball(),
        }[condition.illness],
  );

  const formatted = $derived(
    new Date(cat.domesticated_at).toLocaleDateString(getLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
  );

  /** Five is enough to read at a glance and still show a change from one meal. */
  const PIP_COUNT = 5;

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    dragOver = false;
    const itemId = event.dataTransfer?.getData('text/plain');
    if (itemId) onDropItem(itemId);
  };
</script>

{#snippet pips(label: string, value: number, emoji: string)}
  {@const filled = Math.round(value / (STAT_MAX / PIP_COUNT))}
  <div class="flex w-full items-center justify-between gap-3">
    <span class="font-retro text-[0.55rem]" style="color: var(--color-silver); opacity: 0.7;">
      {label}
    </span>
    <div
      class="flex gap-1"
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={STAT_MAX}
      aria-label={label}
    >
      {#each Array(PIP_COUNT) as _, pip (pip)}
        <!-- No transition here: a re-render restarts it, and a half-faded pip
             would misreport how full she is. -->
        <span
          class="text-xl"
          aria-hidden="true"
          style="opacity: {pip < filled ? 1 : 0.2}; filter: {pip < filled
            ? 'drop-shadow(0 0 4px var(--color-magic))'
            : 'grayscale(1)'};"
        >
          {emoji}
        </span>
      {/each}
    </div>
  </div>
{/snippet}

<article
  class="relative flex flex-col items-center gap-4 rounded-2xl p-1"
  style="background: conic-gradient(from var(--angle), var(--color-magic), var(--color-magenta), var(--color-cyan), var(--color-gold), var(--color-magic));animation: border-rotate 4s linear infinite;"
>
  <div
    class="flex w-full flex-col items-center gap-4 rounded-xl p-6"
    style="background: linear-gradient(145deg,#0a001f,#1a003a,#00101a);"
  >
    <span class="badge-new">{m.cat_your_cat_badge()}</span>

    <!-- The photo is the drop target: this is where food and medicine land. -->
    <div
      class="drop-zone relative rounded-full"
      class:drag-over={dragOver}
      role="region"
      aria-label={m.care_drop_here()}
      ondragover={(event) => {
        event.preventDefault();
        dragOver = true;
      }}
      ondragleave={() => (dragOver = false)}
      ondrop={handleDrop}
    >
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
        class:wiggle={playing}
        style="width:220px;height:220px;border:4px solid {dragOver
          ? 'var(--color-lime)'
          : 'var(--color-gold)'};box-shadow:0 0 30px {dragOver
          ? 'var(--color-lime)'
          : 'var(--color-gold)'},0 0 60px var(--color-magic);"
      />

      {#if playing}
        <span class="yarn" aria-hidden="true">🧶</span>
        {#each [0, 1, 2] as heart (heart)}
          <span class="heart" style="--delay: {heart * 0.18}s; --drift: {(heart - 1) * 40}px;"
            >💗</span
          >
        {/each}
      {/if}
    </div>

    <h2
      class="title-shimmer text-center"
      style="font-family: var(--font-chunky); font-size: clamp(2rem, 6vw, 3.5rem); line-height: 1.1;"
    >
      {cat.name}
    </h2>

    <p class="font-cursive text-xl" style="color: var(--color-cyan);">
      {condition.illness ? ILLNESS_EMOJI[condition.illness] : MOOD_EMOJI[moodTier(condition.happiness)]}
      {mood} · {hunger}
    </p>

    {#if condition.illness && illnessName}
      <div
        class="w-full rounded-lg px-3 py-2 text-center"
        style="background: rgba(60,0,20,0.6); border: 1px solid var(--color-magenta);"
      >
        <p class="font-retro text-[0.6rem]" style="color: var(--color-magenta);">
          {ILLNESS_EMOJI[condition.illness]}
          {m.illness_has({ illness: illnessName })}
        </p>
        <p class="font-cursive text-base" style="color: var(--color-silver);">
          {condition.satiety >= CURE_SATIETY
            ? m.illness_ready({ medicine: m.illness_needs_medicine() })
            : m.illness_too_hungry({ satiety: CURE_SATIETY })}
        </p>
      </div>
    {/if}

    {@render pips(m.care_satiety(), condition.satiety, '🐟')}
    {@render pips(m.care_happiness(), condition.happiness, '💗')}

    <p class="font-retro text-xs" style="color: var(--color-silver); opacity: 0.7;">
      {m.cat_tamed_with({ points: cat.domestication_points })} · {formatted}
    </p>

    {#if breeding}
      <a
        href="/breedings/{breeding.id}"
        class="font-retro rounded-md px-3 py-2 text-[0.6rem]"
        style="color: var(--color-lime); background: rgba(255,255,255,0.04); border: 1px solid var(--color-lime);"
      >
        🏰 {breeding.name}
      </a>
    {/if}

    <button
      type="button"
      onclick={onPlay}
      disabled={busy || petLeft > 0}
      class="font-retro w-full rounded-md px-3 py-3 text-[0.6rem] disabled:opacity-40"
      style="color: var(--color-void); background: var(--color-gold); border: 1px solid var(--color-gold);"
    >
      {petLeft > 0 ? `🧶 ${formatCountdown(petLeft)}` : m.care_play()}
    </button>

    <p class="font-retro text-center text-[0.5rem]" style="color: var(--color-silver); opacity: 0.6;">
      {m.care_drop_hint()}
    </p>
  </div>
</article>

<style>
  /* Kept local rather than in app.css: that file is duplicated byte-for-byte in
     apps/web, and these animations are the game's alone. */
  .drop-zone {
    transition: transform 0.15s ease;
  }

  .drop-zone.drag-over {
    transform: scale(1.04);
  }

  .wiggle {
    animation: wiggle 0.4s ease-in-out 3;
  }

  @keyframes wiggle {
    0%,
    100% {
      transform: rotate(0deg) translateY(0);
    }
    25% {
      transform: rotate(-7deg) translateY(-6px);
    }
    75% {
      transform: rotate(7deg) translateY(-6px);
    }
  }

  .yarn {
    position: absolute;
    top: 50%;
    left: 50%;
    font-size: 2.5rem;
    pointer-events: none;
    animation: yarn-toss 1.2s ease-in-out;
  }

  @keyframes yarn-toss {
    0% {
      transform: translate(-160px, 40px) rotate(0deg);
      opacity: 0;
    }
    20% {
      opacity: 1;
    }
    50% {
      transform: translate(0, -120px) rotate(360deg);
    }
    100% {
      transform: translate(160px, 40px) rotate(720deg);
      opacity: 0;
    }
  }

  .heart {
    position: absolute;
    top: 20%;
    left: 50%;
    font-size: 1.6rem;
    pointer-events: none;
    animation: heart-rise 1.3s ease-out var(--delay) both;
  }

  @keyframes heart-rise {
    0% {
      transform: translate(-50%, 0) scale(0.4);
      opacity: 0;
    }
    30% {
      opacity: 1;
    }
    100% {
      transform: translate(calc(-50% + var(--drift)), -140px) scale(1.2);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .wiggle,
    .yarn,
    .heart {
      animation: none;
    }
  }
</style>
