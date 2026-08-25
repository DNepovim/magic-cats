<script lang="ts">
  import { m } from '$lib/paraglide/messages';

  /** A crumb without an href is the current page. */
  type Crumb = { label: string; href?: string };

  const { trail = [] }: { trail?: Crumb[] } = $props();

  const linkStyle =
    'color: var(--color-silver); background: rgba(255,255,255,0.06); border: 1px solid var(--color-magic);';
</script>

<nav aria-label={m.nav_aria()} class="flex flex-wrap items-center gap-2">
  <a href="/" class="font-retro rounded-md px-3 py-2 text-[0.6rem]" style={linkStyle}>
    {m.nav_dashboard()}
  </a>

  {#each trail as crumb (crumb.label)}
    <span class="font-retro text-[0.6rem]" style="color: var(--color-magic);" aria-hidden="true">
      ›
    </span>
    {#if crumb.href}
      <a href={crumb.href} class="font-retro rounded-md px-3 py-2 text-[0.6rem]" style={linkStyle}>
        {crumb.label}
      </a>
    {:else}
      <span
        class="font-retro max-w-[14rem] truncate rounded-md px-3 py-2 text-[0.6rem]"
        style="color: var(--color-gold); background: rgba(255,255,255,0.03); border: 1px solid var(--color-gold);"
        aria-current="page"
      >
        {crumb.label}
      </span>
    {/if}
  {/each}
</nav>
