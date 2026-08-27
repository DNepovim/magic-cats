<script lang="ts">
  import {
    CURE_SATIETY,
    MOOD_EMOJI,
    STAT_MAX,
    ageInDays,
    cuddleCooldownLeft,
    formatCountdown,
    hungerTier,
    isNight,
    moodTier,
    petCooldownLeft,
    simulate,
    wakesAt,
  } from '$lib/game/care';
  import { ILLNESS_EMOJI } from '$lib/game/items';
  import { GENDER_SYMBOL } from '$lib/game/mating';
  import { pregnancyProgress } from '$lib/game/care';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import type { CatBreeding, CatRow } from '$lib/supabase/types';

  const {
    cat,
    parents = null,
    breeding = null,
    busy = false,
    cuddling = false,
    note = '',
    savingNote = false,
    onDropItem,
    onCuddle,
    onSaveNote,
  }: {
    cat: CatRow;
    /** Her mother and father, for a cat born here. */
    parents?: { mother: string | null; father: string | null } | null;
    breeding?: CatBreeding | null;
    busy?: boolean;
    /** True while the cuddle animation is running. */
    cuddling?: boolean;
    /** Your private note on this cat, as stored. */
    note?: string;
    savingNote?: boolean;
    onDropItem: (itemId: string) => void;
    onCuddle: () => void;
    onSaveNote: (body: string) => void;
  } = $props();

  // The draft follows the stored note, resetting when a different cat is
  // selected or when a save comes back — both are read inside the effect so it
  // actually re-runs, rather than capturing whatever the props were at setup.
  let draft = $state('');
  let syncedWith = $state<string | null>(null);
  $effect(() => {
    const key = `${cat.id}\u0000${note}`;
    if (syncedWith !== key) {
      draft = note;
      syncedWith = key;
    }
  });

  const dirty = $derived(draft.trim() !== note.trim());

  // She keeps living while you look at her, so the clock is state.
  let now = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 5000);
    return () => clearInterval(id);
  });

  let dragOver = $state(false);

  const condition = $derived(simulate(cat, now));
  const petLeft = $derived(petCooldownLeft(cat, now));
  const asleep = $derived(isNight(now));
  const carrying = $derived(pregnancyProgress(cat, now));
  const dueIn = $derived(cat.due_at ? Math.max(0, Date.parse(cat.due_at) - now) : 0);
  const cuddleLeft = $derived(cuddleCooldownLeft(cat, now));
  const age = $derived(Math.floor(ageInDays(cat.birth_at, now)));
  const wakesIn = $derived(Math.max(0, wakesAt(now) - now));

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
    <div class="flex items-center gap-2">
      <span class="font-retro text-[0.55rem]" style="color: var(--color-silver);">{value}%</span>
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
      {#if carrying !== null}
        <span
          class="expecting absolute top-2 left-2 z-10 grid h-9 w-9 place-items-center rounded-full text-lg"
          style="background: var(--color-void); border: 2px solid var(--color-magenta); color: var(--color-magenta);"
          title={m.pregnancy_expecting({ percent: Math.round(carrying * 100) })}
        >
          🤰
        </span>
      {/if}

      <span
        class="absolute right-2 bottom-2 z-10 grid h-9 w-9 place-items-center rounded-full text-lg"
        style="background: var(--color-void); border: 2px solid {cat.gender === 'female'
          ? 'var(--color-magenta)'
          : 'var(--color-cyan)'}; color: {cat.gender === 'female'
          ? 'var(--color-magenta)'
          : 'var(--color-cyan)'};"
        title={cat.gender}
      >
        {GENDER_SYMBOL[cat.gender]}
      </span>
      {#if cuddling}
        {#each [0, 1, 2, 3] as heart (heart)}
          <span class="cuddle-heart" style="--delay: {heart * 0.14}s; --drift: {(heart - 1.5) * 34}px;"
            >💗</span
          >
        {/each}
      {/if}
      <img
        src={cat.image_url}
        alt={cat.name}
        width="220"
        height="220"
        class="float-anim relative rounded-full object-cover"
        class:squeeze={cuddling}
        style="width:220px;height:220px;border:4px solid {dragOver
          ? 'var(--color-lime)'
          : carrying !== null
            ? 'var(--color-magenta)'
            : 'var(--color-gold)'};box-shadow:0 0 30px {dragOver
          ? 'var(--color-lime)'
          : carrying !== null
            ? 'var(--color-magenta)'
            : 'var(--color-gold)'},0 0 {carrying !== null
          ? 30 + carrying * 60
          : 60}px var(--color-magic);"
      />

    </div>

    <h2
      class="title-shimmer text-center"
      style="font-family: var(--font-chunky); font-size: clamp(2rem, 6vw, 3.5rem); line-height: 1.1;"
    >
      {cat.name}
    </h2>

    <p class="font-cursive text-xl" style="color: var(--color-cyan);">
      {#if asleep}
        😴 {m.sleep_asleep()} · {hunger}
      {:else}
        {condition.illness
          ? ILLNESS_EMOJI[condition.illness]
          : MOOD_EMOJI[moodTier(condition.happiness)]}
        {mood} · {hunger}
      {/if}
    </p>

    {#if asleep}
      <div
        class="w-full rounded-lg px-3 py-2 text-center"
        style="background: rgba(0,10,40,0.6); border: 1px solid var(--color-cyan);"
      >
        <p class="font-retro text-[0.6rem]" style="color: var(--color-cyan);">
          😴 {m.sleep_title()}
        </p>
        <p class="font-cursive text-base" style="color: var(--color-silver);">
          {m.sleep_wakes({ time: formatCountdown(wakesIn) })}
        </p>
      </div>
    {/if}

    {#if carrying !== null}
      <div
        class="w-full rounded-lg px-3 py-2 text-center"
        style="background: rgba(40,0,30,0.6); border: 1px solid var(--color-magenta);"
      >
        <p class="font-retro text-[0.6rem]" style="color: var(--color-magenta);">
          🤰 {m.pregnancy_expecting({ percent: Math.round(carrying * 100) })}
        </p>
        <p class="font-cursive text-base" style="color: var(--color-silver);">
          {m.pregnancy_due({ time: formatCountdown(dueIn) })}
        </p>
      </div>
    {/if}

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

    <p class="font-retro text-center text-xs" style="color: var(--color-silver); opacity: 0.7;">
      {m.cat_age({ days: age })} ·
      {#if cat.origin === 'born'}
        {m.cat_born_to({
          mother: parents?.mother ?? m.cat_unknown_parent(),
          father: parents?.father ?? m.cat_unknown_parent(),
        })}
      {:else}
        {m.cat_tamed_on({ date: formatted })}
      {/if}
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
      onclick={onCuddle}
      disabled={busy || asleep || cuddleLeft > 0}
      class="font-retro w-full rounded-md px-3 py-3 text-[0.6rem] disabled:opacity-40"
      style="color: var(--color-void); background: var(--color-magenta); border: 1px solid var(--color-magenta);"
    >
      {cuddleLeft > 0 ? `🤗 ${formatCountdown(cuddleLeft)}` : m.care_cuddle()}
    </button>

    {#if asleep || condition.illness || petLeft > 0}
      <span
        class="font-retro w-full rounded-md px-3 py-3 text-center text-[0.6rem] opacity-40"
        style="color: var(--color-void); background: var(--color-gold); border: 1px solid var(--color-gold);"
      >
        {#if asleep}
          {m.care_play_asleep()}
        {:else if condition.illness}
          {m.care_play_ill()}
        {:else}
          🧶 {formatCountdown(petLeft)}
        {/if}
      </span>
    {:else}
      <a
        href="/play/{cat.id}"
        class="font-retro w-full rounded-md px-3 py-3 text-center text-[0.6rem]"
        style="color: var(--color-void); background: var(--color-gold); border: 1px solid var(--color-gold);"
      >
        {m.care_play()}
      </a>
    {/if}

    <p class="font-retro text-center text-[0.5rem]" style="color: var(--color-silver); opacity: 0.6;">
      {m.care_drop_hint()}
    </p>

    <!-- private notes -->
    <div class="flex w-full flex-col gap-2 border-t pt-4" style="border-color: rgba(155,0,255,0.4);">
      <div class="flex items-center justify-between gap-2">
        <p class="font-retro text-xs" style="color: var(--color-cyan);">{m.note_title()}</p>
        <span class="font-retro text-[0.5rem]" style="color: var(--color-silver); opacity: 0.6;">
          🔒 {m.note_private()}
        </span>
      </div>

      <textarea
        bind:value={draft}
        maxlength="2000"
        rows="3"
        placeholder={m.note_placeholder({ name: cat.name })}
        class="w-full rounded-lg px-3 py-2 outline-none"
        style="background: rgba(0,0,0,0.5); color: var(--color-silver); font-family: var(--font-pixel); font-size: 0.85rem; border: 2px solid var(--color-magic);"
      ></textarea>

      <button
        type="button"
        onclick={() => onSaveNote(draft)}
        disabled={savingNote || !dirty}
        class="font-retro rounded-md px-3 py-2 text-[0.6rem] disabled:opacity-40"
        style="color: var(--color-cyan); background: rgba(255,255,255,0.04); border: 1px solid var(--color-cyan);"
      >
        {savingNote ? m.note_saving() : dirty ? m.note_save() : m.note_saved()}
      </button>
    </div>
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

  .expecting {
    animation: expecting-pulse 2.4s ease-in-out infinite;
  }

  @keyframes expecting-pulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.12);
    }
  }

  .squeeze {
    animation: squeeze 0.45s ease-in-out 2;
  }

  @keyframes squeeze {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(0.94);
    }
  }

  .cuddle-heart {
    position: absolute;
    top: 30%;
    left: 50%;
    font-size: 1.5rem;
    pointer-events: none;
    animation: cuddle-rise 1.2s ease-out var(--delay) both;
  }

  @keyframes cuddle-rise {
    0% {
      transform: translate(-50%, 0) scale(0.5);
      opacity: 0;
    }
    25% {
      opacity: 1;
    }
    100% {
      transform: translate(calc(-50% + var(--drift)), -120px) scale(1.1);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .drop-zone {
      transition: none;
    }

    .squeeze,
    .cuddle-heart,
    .expecting {
      animation: none;
    }
  }
</style>
