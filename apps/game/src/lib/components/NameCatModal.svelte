<script lang="ts">
  import type { CatEntity } from '$lib/game/types';

  const {
    cat,
    submitting,
    error,
    onSubmit,
  }: {
    cat: CatEntity;
    submitting: boolean;
    error: string | null;
    onSubmit: (name: string) => void;
  } = $props();

  let name = $state('');

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 32) return;
    onSubmit(trimmed);
  }
</script>

<div
  class="fixed inset-0 z-40 flex items-center justify-center px-4"
  style="background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);"
>
  <div
    class="relative w-full max-w-md overflow-hidden rounded-2xl p-1"
    style="background:conic-gradient(from var(--angle), var(--color-magic), var(--color-magenta), var(--color-cyan), var(--color-gold), var(--color-magic));animation:border-rotate 2s linear infinite;"
  >
    <div
      class="rounded-xl p-6"
      style="background:linear-gradient(145deg,#0a001f,#1a003a,#00101a);"
    >
      <div class="flex flex-col items-center gap-4 text-center">
        <span class="badge-new">✨ DOMESTICATED ✨</span>

        <div class="relative">
          <div
            class="starburst"
            style="width:220px;height:220px;top:50%;left:50%;transform:translate(-50%,-50%);"
          ></div>
          <img
            src={cat.imageUrl}
            alt=""
            width={140}
            height={140}
            class="relative rounded-full object-cover"
            style="width:140px;height:140px;border:4px solid var(--color-gold);box-shadow:0 0 24px var(--color-gold),0 0 48px var(--color-magic);"
          />
        </div>

        <h2
          class="title-shimmer"
          style="font-family:var(--font-chunky);font-size:clamp(1.8rem,5vw,2.4rem);line-height:1.1;"
        >
          Name your cat
        </h2>

        <p class="font-cursive text-lg" style="color:var(--color-cyan);">
          She was tamed with {cat.points} points of magical food.
        </p>

        <form class="flex w-full flex-col gap-3" onsubmit={submit}>
          <input
            type="text"
            bind:value={name}
            required
            maxlength="32"
            placeholder="e.g. Whiskers the Brave"
            class="w-full rounded-lg px-4 py-3 outline-none"
            style="background:rgba(0,0,0,0.5);color:var(--color-silver);font-family:var(--font-pixel);font-size:1rem;border:2px solid var(--color-magic);box-shadow:0 0 8px rgba(155,0,255,0.3);"
          />
          <button
            type="submit"
            class="btn-magic w-full text-lg disabled:opacity-60"
            disabled={submitting || name.trim().length < 1}
          >
            {submitting ? 'Taming…' : '🐱 Adopt her 🐱'}
          </button>
        </form>

        {#if error}
          <p class="font-retro text-xs" style="color:var(--color-magenta);">{error}</p>
        {/if}
      </div>
    </div>
  </div>
</div>
