<script lang="ts">
  import { LATEST_RELEASE, SEEN_RELEASE_KEY } from '$lib/game/changelog';
  import { m } from '$lib/paraglide/messages';

  let show = $state(false);

  // Read after mount: localStorage does not exist during SSR, and a release
  // note is not worth blocking the page for.
  $effect(() => {
    try {
      show = localStorage.getItem(SEEN_RELEASE_KEY) !== LATEST_RELEASE.version;
    } catch {
      // private mode, storage disabled: simply never announce
      show = false;
    }
  });

  const dismiss = () => {
    show = false;
    try {
      localStorage.setItem(SEEN_RELEASE_KEY, LATEST_RELEASE.version);
    } catch {
      // nothing to do — it will offer itself again next time
    }
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && show) dismiss();
  };

  /** The notes are message keys so they translate with everything else. */
  const noteText = (key: string) =>
    ({
      news_2026_08_27_age: m.news_2026_08_27_age(),
      news_2026_08_27_mating: m.news_2026_08_27_mating(),
      news_2026_08_27_cuddle: m.news_2026_08_27_cuddle(),
      news_2026_08_27_sharing: m.news_2026_08_27_sharing(),
    })[key] ?? key;

  const headline = (key: string) =>
    ({ news_2026_08_27_headline: m.news_2026_08_27_headline() })[key] ?? key;
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    style="background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);"
    role="dialog"
    aria-modal="true"
    aria-labelledby="whats-new-title"
  >
    <!-- The backdrop is a button so clicking outside closes without tripping
         the a11y rules that a click-handling <div> would. -->
    <button
      type="button"
      class="absolute inset-0 cursor-default"
      aria-label={m.modal_close()}
      onclick={dismiss}
    ></button>

    <div
      class="relative z-10 w-full max-w-md rounded-2xl p-6"
      style="background: linear-gradient(145deg,#0a001f,#1a003a,#00101a); border: 2px solid var(--color-gold); box-shadow: 0 0 24px rgba(255,196,0,0.4);"
    >
      <p class="font-retro mb-1 text-[0.55rem]" style="color: var(--color-lime);">
        {m.news_label()} · {LATEST_RELEASE.date}
      </p>
      <h2
        id="whats-new-title"
        class="mb-4"
        style="font-family: var(--font-display); color: var(--color-gold); font-size: 1.5rem; text-shadow: 0 0 10px var(--color-gold);"
      >
        {headline(LATEST_RELEASE.headline)}
      </h2>

      <ul class="mb-5 flex flex-col gap-2">
        {#each LATEST_RELEASE.notes as note (note)}
          <li class="font-cursive text-lg" style="color: var(--color-silver);">
            ✨ {noteText(note)}
          </li>
        {/each}
      </ul>

      <button type="button" onclick={dismiss} class="btn-magic w-full text-lg">
        {m.news_dismiss()}
      </button>
    </div>
  </div>
{/if}
