<script lang="ts">
  import { m } from '$lib/paraglide/messages';

  const {
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
  }: {
    title: string;
    message?: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onCancel();
  };
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="fixed inset-0 z-50 flex items-center justify-center p-4"
  style="background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);"
  role="dialog"
  aria-modal="true"
  aria-labelledby="confirm-modal-title"
>
  <!-- The backdrop is a button so clicking outside closes without tripping
       the a11y rules that a click-handling <div> would. -->
  <button
    type="button"
    class="absolute inset-0 cursor-default"
    aria-label={m.modal_close()}
    onclick={onCancel}
  ></button>

  <div
    class="relative z-10 w-full max-w-sm rounded-2xl p-6"
    style="background:linear-gradient(145deg,#0a001f,#1a003a,#00101a);border:2px solid var(--color-magic);box-shadow:0 0 24px rgba(155,0,255,0.5);"
  >
    <button
      type="button"
      onclick={onCancel}
      aria-label={m.modal_close()}
      class="font-retro absolute top-3 right-3 rounded-md px-3 py-2 text-[0.7rem]"
      style="color:var(--color-silver);background:rgba(255,255,255,0.06);border:1px solid var(--color-magic);"
    >
      ✕
    </button>

    <h2
      id="confirm-modal-title"
      class="mb-2 pr-10"
      style="font-family:var(--font-display);color:var(--color-gold);font-size:1.4rem;text-shadow:0 0 10px var(--color-gold);"
    >
      {title}
    </h2>

    {#if message}
      <p class="font-cursive mb-4 text-lg" style="color:var(--color-silver);">{message}</p>
    {/if}

    <div class="flex flex-col gap-2 sm:flex-row">
      <button
        type="button"
        onclick={onConfirm}
        class="font-retro flex-1 rounded-md px-3 py-3 text-[0.6rem]"
        style="color:var(--color-magenta);background:rgba(255,255,255,0.04);border:1px solid var(--color-magenta);"
      >
        {confirmLabel}
      </button>
      <button type="button" onclick={onCancel} class="btn-magic flex-1 text-base">
        {cancelLabel}
      </button>
    </div>
  </div>
</div>
