<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { MAX_CATS } from '$lib/game/constants';
  import { m } from '$lib/paraglide/messages';
  import { supabase } from '$lib/supabase/client';
  import type { CatRow } from '$lib/supabase/types';
  import CatCard from './CatCard.svelte';
  import Sparkles from './Sparkles.svelte';

  const {
    myCats,
    otherCats,
    userEmail,
  }: {
    myCats: CatRow[];
    otherCats: Pick<
      CatRow,
      'id' | 'name' | 'image_url' | 'domesticated_at' | 'domestication_points'
    >[];
    userEmail: string | null;
  } = $props();

  let signingOut = $state(false);
  // Empty means "no explicit choice yet" — selectedCat falls back to the first.
  let selectedId = $state('');
  let confirmingRelease = $state(false);
  let releasing = $state(false);
  let releaseError = $state<string | null>(null);

  // myCats is replaced wholesale by invalidateAll() after a release, so the
  // selection has to fall back to a cat that still exists.
  const selectedCat = $derived(myCats.find((cat) => cat.id === selectedId) ?? myCats[0]);
  const isFull = $derived(myCats.length >= MAX_CATS);

  async function signOut() {
    signingOut = true;
    await supabase.auth.signOut();
    await invalidateAll();
    await goto('/');
  }

  function select(id: string) {
    selectedId = id;
    confirmingRelease = false;
    releaseError = null;
  }

  async function releaseSelected() {
    if (!selectedCat) return;
    releasing = true;
    releaseError = null;
    try {
      const res = await fetch(`/api/cats/${selectedCat.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? m.dashboard_release_failed());
      }
      confirmingRelease = false;
      selectedId = '';
      await invalidateAll();
    } catch (err) {
      releaseError = err instanceof Error ? err.message : m.dashboard_release_failed();
    } finally {
      releasing = false;
    }
  }
</script>

<section
  class="relative min-h-screen overflow-hidden px-4 py-10"
  style="background: radial-gradient(ellipse at 10% 10%, #1a003a 0%, #08001a 50%), radial-gradient(ellipse at 90% 90%, #001a3a 0%, transparent 60%);"
>
  <Sparkles count={25} />

  <div class="relative z-10 mx-auto flex max-w-6xl flex-col gap-6">
    <!-- top bar -->
    <header class="flex items-center justify-between gap-4">
      <div>
        <span class="font-retro text-xs" style="color: var(--color-lime);">{m.dashboard_label()}</span>
        <h1
          class="title-shimmer"
          style="font-family: var(--font-chunky); font-size: clamp(2rem, 5vw, 3rem); line-height: 1.1;"
        >
          {m.dashboard_title()}
        </h1>
      </div>
      <div class="flex items-center gap-3">
        {#if userEmail}
          <span class="font-retro hidden text-[0.6rem] sm:inline" style="color: var(--color-silver); opacity: 0.7;">
            {userEmail}
          </span>
        {/if}
        <button
          type="button"
          onclick={signOut}
          disabled={signingOut}
          class="font-retro rounded-md px-3 py-2 text-[0.6rem] disabled:opacity-50"
          style="color: var(--color-silver); background: rgba(255,255,255,0.06); border: 1px solid var(--color-magic);"
        >
          {signingOut ? m.dashboard_signing_out() : m.dashboard_signout()}
        </button>
      </div>
    </header>

    <div class="flex flex-col gap-6 lg:flex-row lg:items-start">
      <!-- selected cat -->
      <div class="flex-1">
        {#if selectedCat}
          <CatCard cat={selectedCat} variant="hero" />
        {/if}

        <div class="mt-6 rounded-xl p-4" style="background:rgba(8,0,26,0.5);border:1px dashed var(--color-magic);">
          <p class="font-retro mb-2 text-xs" style="color:var(--color-cyan);">{m.dashboard_coming_soon_label()}</p>
          <p class="font-cursive text-lg" style="color:var(--color-silver);">
            {m.dashboard_coming_soon_text()}
          </p>
        </div>
      </div>

      <!-- my cats: switcher + actions -->
      <aside class="w-full lg:w-96">
        <div class="mb-3 flex items-center justify-between">
          <h2
            style="font-family: var(--font-display); color: var(--color-gold); font-size: 1.4rem; text-shadow: 0 0 10px var(--color-gold);"
          >
            {m.dashboard_my_cats()}
          </h2>
          <span class="font-retro text-xs" style="color: var(--color-cyan);">
            {myCats.length}/{MAX_CATS}
          </span>
        </div>

        <ul class="flex flex-col gap-3">
          {#each myCats as cat (cat.id)}
            {@const isSelected = cat.id === selectedCat?.id}
            <li
              class="rounded-xl transition-opacity"
              style={isSelected
                ? 'outline:2px solid var(--color-gold);outline-offset:2px;'
                : 'opacity:0.65;'}
            >
              <button
                type="button"
                onclick={() => select(cat.id)}
                aria-pressed={isSelected}
                class="w-full cursor-pointer rounded-xl text-left {isSelected
                  ? '[&>article]:rounded-b-none'
                  : ''}"
              >
                <CatCard {cat} />
              </button>

              {#if isSelected}
                <!-- Release lives inside the selected row so it reads as an
                     action on this cat, not on the tribe as a whole. -->
                <div
                  class="flex flex-col gap-2 rounded-b-xl px-3 pt-2 pb-3"
                  style="background: rgba(8,0,26,0.6); border: 2px solid var(--color-magic); border-top: 0;"
                >
                  {#if confirmingRelease}
                    <p class="font-cursive text-center text-base" style="color: var(--color-magenta);">
                      {m.dashboard_release_confirm({ name: cat.name })}
                    </p>
                    <div class="flex gap-2">
                      <button
                        type="button"
                        onclick={releaseSelected}
                        disabled={releasing}
                        class="font-retro flex-1 rounded-md px-3 py-2 text-[0.6rem] disabled:opacity-50"
                        style="color: var(--color-void); background: var(--color-magenta); border: 1px solid var(--color-magenta);"
                      >
                        {releasing ? m.dashboard_releasing() : m.dashboard_release_yes()}
                      </button>
                      <button
                        type="button"
                        onclick={() => (confirmingRelease = false)}
                        disabled={releasing}
                        class="font-retro flex-1 rounded-md px-3 py-2 text-[0.6rem] disabled:opacity-50"
                        style="color: var(--color-silver); background: rgba(255,255,255,0.06); border: 1px solid var(--color-magic);"
                      >
                        {m.dashboard_release_no()}
                      </button>
                    </div>
                  {:else}
                    <button
                      type="button"
                      onclick={() => (confirmingRelease = true)}
                      class="font-retro rounded-md px-3 py-2 text-[0.6rem]"
                      style="color: var(--color-magenta); background: rgba(255,255,255,0.04); border: 1px solid var(--color-magenta);"
                    >
                      {m.dashboard_release({ name: cat.name })}
                    </button>
                  {/if}

                  {#if releaseError}
                    <p class="font-retro text-center text-[0.55rem]" style="color: var(--color-magenta);">
                      {releaseError}
                    </p>
                  {/if}
                </div>
              {/if}
            </li>
          {/each}
        </ul>

        <div class="mt-4 flex flex-col gap-2">
          <a
            href="/tame"
            aria-disabled={isFull}
            tabindex={isFull ? -1 : undefined}
            class="btn-magic text-center text-lg"
            class:pointer-events-none={isFull}
            style={isFull ? 'opacity:0.5;' : ''}
          >
            {m.dashboard_tame_new()}
          </a>

          {#if isFull}
            <p class="font-retro text-center text-[0.55rem]" style="color: var(--color-silver); opacity: 0.7;">
              {m.dashboard_tribe_full({ max: MAX_CATS })}
            </p>
          {/if}

        </div>
      </aside>
    </div>

    <!-- other players' cats -->
    <div class="mt-4">
      <div class="mb-3 flex items-center justify-between">
        <h2
          style="font-family: var(--font-display); color: var(--color-gold); font-size: 1.1rem; text-shadow: 0 0 8px var(--color-gold);"
        >
          {m.dashboard_other_cats()}
        </h2>
        <span class="badge-hot">{m.dashboard_live()}</span>
      </div>

      {#if otherCats.length === 0}
        <p class="font-cursive text-sm" style="color:var(--color-silver); opacity:0.7;">
          {m.dashboard_first_cat()}
        </p>
      {:else}
        <ul class="flex gap-3 overflow-x-auto pb-2">
          {#each otherCats as cat (cat.id)}
            <li>
              <CatCard {cat} variant="tile" />
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</section>
