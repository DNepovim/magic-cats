<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { m } from '$lib/paraglide/messages';
  import { supabase } from '$lib/supabase/client';
  import type { CatRow } from '$lib/supabase/types';
  import CatCard from './CatCard.svelte';
  import Sparkles from './Sparkles.svelte';

  const {
    myCat,
    otherCats,
    userEmail,
  }: {
    myCat: CatRow;
    otherCats: Pick<
      CatRow,
      'id' | 'name' | 'image_url' | 'domesticated_at' | 'domestication_points'
    >[];
    userEmail: string | null;
  } = $props();

  let signingOut = $state(false);

  async function signOut() {
    signingOut = true;
    await supabase.auth.signOut();
    await invalidateAll();
    await goto('/');
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
      <!-- user's cat -->
      <div class="flex-1">
        <CatCard cat={myCat} variant="hero" />

        <div class="mt-6 rounded-xl p-4" style="background:rgba(8,0,26,0.5);border:1px dashed var(--color-magic);">
          <p class="font-retro mb-2 text-xs" style="color:var(--color-cyan);">{m.dashboard_coming_soon_label()}</p>
          <p class="font-cursive text-lg" style="color:var(--color-silver);">
            {m.dashboard_coming_soon_text()}
          </p>
        </div>
      </div>

      <!-- other users' cats -->
      <aside class="w-full lg:w-96">
        <div class="mb-3 flex items-center justify-between">
          <h2
            style="font-family: var(--font-display); color: var(--color-gold); font-size: 1.4rem; text-shadow: 0 0 10px var(--color-gold);"
          >
            {m.dashboard_other_tribes()}
          </h2>
          <span class="badge-hot">{m.dashboard_live()}</span>
        </div>

        {#if otherCats.length === 0}
          <p class="font-cursive text-sm" style="color:var(--color-silver); opacity:0.7;">
            {m.dashboard_first_cat()}
          </p>
        {:else}
          <ul class="flex flex-col gap-3">
            {#each otherCats as cat (cat.id)}
              <li>
                <CatCard {cat} />
              </li>
            {/each}
          </ul>
        {/if}
      </aside>
    </div>
  </div>
</section>
