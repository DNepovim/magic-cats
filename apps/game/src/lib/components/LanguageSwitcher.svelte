<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { cookieName, type Locale, locales } from '$lib/paraglide/runtime';

  const { current }: { current: Locale } = $props();

  const labels: Record<Locale, string> = {
    hu: 'HU',
    en: 'EN',
    cs: 'CS',
    sk: 'SK',
  };

  function setLocaleCookie(next: Locale) {
    if (next === current) return;
    document.cookie = `${cookieName}=${next}; path=/; max-age=34560000; SameSite=Lax`;
    // Reload data so server rerenders with new locale
    void invalidateAll();
    // Cleanest: full reload to refresh statically rendered text too
    location.reload();
  }
</script>

<div
  class="font-retro inline-flex items-center gap-1 rounded-full p-1 text-[0.55rem]"
  style="background:rgba(8,0,26,0.7);border:1px solid var(--color-magic);box-shadow:0 0 6px rgba(155,0,255,0.4);"
>
  {#each locales as locale (locale)}
    <button
      type="button"
      onclick={() => setLocaleCookie(locale)}
      aria-pressed={locale === current}
      class="rounded-full px-2 py-1 transition-colors"
      style={locale === current
        ? 'background:var(--color-magic);color:white;box-shadow:0 0 8px var(--color-magic);'
        : 'color:var(--color-silver);background:transparent;'}
    >
      {labels[locale]}
    </button>
  {/each}
</div>
