<script lang="ts">
  import { m } from '$lib/paraglide/messages';
  import { GENDER_SYMBOL } from '$lib/game/mating';
  import type { CatEntity } from '$lib/game/types';

  const {
    cat,
    submitting,
    error,
    onSubmit,
    onClose,
  }: {
    cat: CatEntity;
    submitting: boolean;
    error: string | null;
    onSubmit: (name: string) => void;
    onClose: () => void;
  } = $props();

  let name = $state('');

  // Closing mid-request would leave the caller unsure whether the cat was
  // saved, so the modal holds until the request settles.
  const close = () => {
    if (!submitting) onClose();
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
  };

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 32) return;
    onSubmit(trimmed);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4"
  style="background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);"
  role="dialog"
  aria-modal="true"
  aria-labelledby="name-cat-title"
>
  <!-- The backdrop is a button so clicking outside closes without tripping
       the a11y rules that a click-handling <div> would. -->
  <button
    type="button"
    class="absolute inset-0 cursor-default"
    aria-label={m.modal_close()}
    onclick={close}
  ></button>

  <div
    class="relative z-10 flex h-full w-full flex-col overflow-hidden rounded-2xl p-1 sm:h-auto sm:max-w-md"
    style="background:conic-gradient(from var(--angle), var(--color-magic), var(--color-magenta), var(--color-cyan), var(--color-gold), var(--color-magic));animation:border-rotate 2s linear infinite;"
  >
    <div
      class="relative flex-1 overflow-y-auto rounded-xl p-6"
      style="background:linear-gradient(145deg,#0a001f,#1a003a,#00101a);"
    >
      <button
        type="button"
        onclick={close}
        disabled={submitting}
        aria-label={m.modal_close()}
        class="font-retro absolute top-3 right-3 z-10 rounded-md px-3 py-2 text-[0.7rem] disabled:opacity-40"
        style="color:var(--color-silver);background:rgba(255,255,255,0.06);border:1px solid var(--color-magic);"
      >
        ✕
      </button>

      <div class="flex min-h-full flex-col items-center justify-center gap-4 text-center">
        <span class="badge-new">{m.modal_domesticated_badge()}</span>

        <div class="relative">
          <div
            class="starburst"
            style="width:220px;height:220px;top:50%;left:50%;transform:translate(-50%,-50%);"
          ></div>
          <span
            class="absolute right-0 bottom-0 z-10 grid h-9 w-9 place-items-center rounded-full text-lg"
            style="background: var(--color-void); border: 2px solid {cat.gender === 'female'
              ? 'var(--color-magenta)'
              : 'var(--color-cyan)'}; color: {cat.gender === 'female'
              ? 'var(--color-magenta)'
              : 'var(--color-cyan)'};"
          >
            {GENDER_SYMBOL[cat.gender]}
          </span>
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
          id="name-cat-title"
          class="title-shimmer"
          style="font-family:var(--font-chunky);font-size:clamp(1.8rem,5vw,2.4rem);line-height:1.1;"
        >
          {m.modal_name_cat()}
        </h2>

        <p class="font-cursive text-lg" style="color:var(--color-cyan);">
          {m.modal_name_cat_subtitle({ points: cat.points })}
        </p>

        <form class="flex w-full flex-col gap-3" onsubmit={submit}>
          <input
            type="text"
            bind:value={name}
            required
            maxlength="32"
            placeholder={m.modal_name_placeholder()}
            class="w-full rounded-lg px-4 py-3 outline-none"
            style="background:rgba(0,0,0,0.5);color:var(--color-silver);font-family:var(--font-pixel);font-size:1rem;border:2px solid var(--color-magic);box-shadow:0 0 8px rgba(155,0,255,0.3);"
          />
          <button
            type="submit"
            class="btn-magic w-full text-lg disabled:opacity-60"
            disabled={submitting || name.trim().length < 1}
          >
            {submitting ? m.modal_adopting() : m.modal_adopt()}
          </button>
        </form>

        {#if error}
          <p class="font-retro text-xs" style="color:var(--color-magenta);">{error}</p>
        {/if}
      </div>
    </div>
  </div>
</div>
