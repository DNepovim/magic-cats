<script lang="ts">
  import { m } from '$lib/paraglide/messages';

  const {
    left,
    right,
    outcome = null,
    onClose,
  }: {
    left: { name: string; image_url: string };
    right: { name: string; image_url: string };
    /** Null while they are still getting acquainted. */
    outcome?: { mated: boolean; chance: number; motherName: string | null } | null;
    onClose: () => void;
  } = $props();

  // The meeting plays for its own sake: even if the server answers instantly,
  // the result waits until the cats have actually met.
  let metLongEnough = $state(false);
  $effect(() => {
    const timer = setTimeout(() => (metLongEnough = true), 2600);
    return () => clearTimeout(timer);
  });

  const settled = $derived(outcome !== null && metLongEnough);

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
  };
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="fixed inset-0 z-50 flex items-center justify-center p-4"
  style="background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);"
  role="dialog"
  aria-modal="true"
  aria-labelledby="mating-title"
>
  <!-- The backdrop is a button so clicking outside closes without tripping
       the a11y rules that a click-handling <div> would. -->
  <button
    type="button"
    class="absolute inset-0 cursor-default"
    aria-label={m.modal_close()}
    onclick={onClose}
  ></button>

  <div
    class="relative z-10 w-full max-w-md rounded-2xl p-6 text-center"
    style="background: linear-gradient(145deg,#1a0016,#2a0030,#10001a); border: 2px solid var(--color-magenta); box-shadow: 0 0 30px rgba(255,0,128,0.5);"
  >
    <h2
      id="mating-title"
      class="mb-6"
      style="font-family: var(--font-display); color: var(--color-magenta); font-size: 1.3rem; text-shadow: 0 0 10px var(--color-magenta);"
    >
      {settled
        ? outcome?.mated
          ? m.mating_modal_joy()
          : m.mating_modal_shrug()
        : m.mating_modal_meeting({ a: left.name, b: right.name })}
    </h2>

    <div class="relative mx-auto mb-6 h-40">
      <img
        src={left.image_url}
        alt={left.name}
        class="cat cat-left absolute top-1/2 h-28 w-28 rounded-full object-cover"
        class:parted={settled && !outcome?.mated}
        style="border: 3px solid var(--color-cyan);"
      />
      <img
        src={right.image_url}
        alt={right.name}
        class="cat cat-right absolute top-1/2 h-28 w-28 rounded-full object-cover"
        class:parted={settled && !outcome?.mated}
        style="border: 3px solid var(--color-magenta);"
      />

      {#if !settled || outcome?.mated}
        {#each [0, 1, 2, 3, 4] as heart (heart)}
          <span class="heart" style="--delay: {heart * 0.22}s; --drift: {(heart - 2) * 26}px;">
            {settled ? '💞' : '💗'}
          </span>
        {/each}
      {/if}
    </div>

    {#if settled}
      <p class="font-cursive mb-5 text-lg" style="color: var(--color-silver);">
        {outcome?.mated
          ? m.mating_success({ name: outcome.motherName ?? '' })
          : m.mating_failure({ chance: Math.round((outcome?.chance ?? 0) * 100) })}
      </p>
      <button type="button" onclick={onClose} class="btn-magic w-full text-lg">
        {m.mating_modal_done()}
      </button>
    {:else}
      <p class="font-retro text-[0.6rem]" style="color: var(--color-silver); opacity: 0.7;">
        {m.mating_modal_wait()}
      </p>
    {/if}
  </div>
</div>

<style>
  /* Local rather than in app.css: that file is duplicated byte-for-byte in
     apps/web, and these two cats are the game's business alone. */
  .cat {
    transform: translateY(-50%);
    animation: approach 2.6s ease-in-out forwards;
  }

  .cat-left {
    left: 6%;
  }

  .cat-right {
    right: 6%;
    animation-name: approach-right;
  }

  @keyframes approach {
    0% {
      transform: translate(-140%, -50%) rotate(-8deg);
      opacity: 0.7;
    }
    60% {
      transform: translate(38%, -50%) rotate(4deg);
      opacity: 1;
    }
    75% {
      transform: translate(30%, -50%) rotate(-4deg);
    }
    100% {
      transform: translate(34%, -50%) rotate(0deg);
    }
  }

  @keyframes approach-right {
    0% {
      transform: translate(140%, -50%) rotate(8deg);
      opacity: 0.7;
    }
    60% {
      transform: translate(-38%, -50%) rotate(-4deg);
      opacity: 1;
    }
    75% {
      transform: translate(-30%, -50%) rotate(4deg);
    }
    100% {
      transform: translate(-34%, -50%) rotate(0deg);
    }
  }

  /* Nothing came of it: they sit back down facing away. */
  .cat.parted {
    animation: part 0.6s ease-out forwards;
  }

  @keyframes part {
    to {
      transform: translate(0, -50%) rotate(0deg);
      opacity: 0.75;
    }
  }

  .heart {
    position: absolute;
    top: 40%;
    left: 50%;
    font-size: 1.6rem;
    pointer-events: none;
    animation: rise 1.8s ease-out var(--delay) infinite;
  }

  @keyframes rise {
    0% {
      transform: translate(-50%, 20px) scale(0.5);
      opacity: 0;
    }
    30% {
      opacity: 1;
    }
    100% {
      transform: translate(calc(-50% + var(--drift)), -90px) scale(1.2);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cat,
    .cat.parted,
    .heart {
      animation: none;
    }
  }
</style>
