<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { formatCountdown, gameCooldownLeft, isNight, simulate } from '$lib/game/care';
  import { MAX_CATS } from '$lib/game/constants';
  import { m } from '$lib/paraglide/messages';
  import { supabase } from '$lib/supabase/client';
  import type { CatBreeding, CatRow, DashboardBreeding, GameFeedItem } from '$lib/supabase/types';
  import CatCard from './CatCard.svelte';
  import CatHero from './CatHero.svelte';
  import PantrySidebar from './PantrySidebar.svelte';
  import Sparkles from './Sparkles.svelte';

  const {
    myCats,
    otherCats,
    breedings,
    breedingByCat,
    games,
    stock,
    notes,
    supplyReadyAt,
    userEmail,
  }: {
    myCats: CatRow[];
    otherCats: Pick<
      CatRow,
      | 'id'
      | 'name'
      | 'image_url'
      | 'domesticated_at'
      | 'domestication_points'
      | 'satiety'
      | 'happiness'
      | 'state_at'
      | 'illness'
    >[];
    breedings: DashboardBreeding[];
    breedingByCat: Record<string, CatBreeding>;
    games: GameFeedItem[];
    stock: Record<string, number>;
    notes: Record<string, string>;
    supplyReadyAt: string | null;
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
  // Ticks so the play button re-enables itself when the nap is over.
  let now = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(id);
  });
  const playLeft = $derived(selectedCat ? gameCooldownLeft(selectedCat, now) : 0);
  const selectedIsIll = $derived(selectedCat ? simulate(selectedCat, now).illness !== null : false);
  const catsAsleep = $derived(isNight(now));

  const gameKindLabel = (kind: GameFeedItem['kind']) =>
    ({ chase: m.play_kind_chase(), wrestle: m.play_kind_wrestle(), yarn: m.play_kind_yarn() })[kind];

  async function signOut() {
    signingOut = true;
    await supabase.auth.signOut();
    await invalidateAll();
    await goto('/');
  }

  // The release confirmation is inline rather than an overlay, but Escape
  // should back out of it like it does out of the real modals.
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && confirmingRelease && !releasing) confirmingRelease = false;
  };

  function select(id: string) {
    selectedId = id;
    confirmingRelease = false;
    releaseError = null;
  }

  let caring = $state(false);
  let careError = $state<string | null>(null);
  let lastGame = $state<string | null>(null);

  const post = async (url: string, payload: unknown, fallback: string) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? fallback);
    }
    return res.json() as Promise<{ opponent_name?: string; game?: { winner_cat_id: string } }>;
  };

  async function give(itemId: string) {
    if (!selectedCat) return;
    caring = true;
    careError = null;
    lastGame = null;
    try {
      await post(`/api/cats/${selectedCat.id}/give`, { item_id: itemId }, m.care_failed());
      await invalidateAll();
    } catch (err) {
      careError = err instanceof Error ? err.message : m.care_failed();
    } finally {
      caring = false;
    }
  }

  let savingNote = $state(false);

  async function saveNote(body: string) {
    if (!selectedCat) return;
    savingNote = true;
    careError = null;
    try {
      await post(`/api/cats/${selectedCat.id}/note`, { body }, m.note_failed());
      await invalidateAll();
    } catch (err) {
      careError = err instanceof Error ? err.message : m.note_failed();
    } finally {
      savingNote = false;
    }
  }

  /** A game between your selected cat and someone else's — see /api/games. */
  async function play(opponentId: string, opponentName: string) {
    if (!selectedCat) return;
    caring = true;
    careError = null;
    lastGame = null;
    try {
      const result = await post(
        '/api/games',
        { challenger_cat_id: selectedCat.id, opponent_cat_id: opponentId },
        m.play_failed(),
      );
      const won = result.game?.winner_cat_id === selectedCat.id;
      lastGame = won
        ? m.play_won({ cat: selectedCat.name, opponent: opponentName })
        : m.play_lost({ cat: selectedCat.name, opponent: opponentName });
      await invalidateAll();
    } catch (err) {
      careError = err instanceof Error ? err.message : m.play_failed();
    } finally {
      caring = false;
    }
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

<svelte:window onkeydown={handleKeydown} />

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
          <CatHero
            cat={selectedCat}
            breeding={breedingByCat[selectedCat.id]}
            busy={caring}
            note={notes[selectedCat.id] ?? ''}
            {savingNote}
            onDropItem={give}
            onSaveNote={saveNote}
          />

          <div class="mt-2 flex flex-col items-center gap-2">
            {#if confirmingRelease}
              <p class="font-cursive text-base" style="color: var(--color-magenta);">
                {m.dashboard_release_confirm({ name: selectedCat.name })}
              </p>
              <div class="flex gap-3">
                <button
                  type="button"
                  onclick={releaseSelected}
                  disabled={releasing}
                  class="font-retro rounded-md px-3 py-2 text-[0.55rem] disabled:opacity-50"
                  style="color: var(--color-void); background: var(--color-magenta); border: 1px solid var(--color-magenta);"
                >
                  {releasing ? m.dashboard_releasing() : m.dashboard_release_yes()}
                </button>
                <button
                  type="button"
                  onclick={() => (confirmingRelease = false)}
                  disabled={releasing}
                  class="font-retro text-[0.55rem] underline disabled:opacity-50"
                  style="color: var(--color-silver); opacity: 0.7;"
                >
                  {m.dashboard_release_no()}
                </button>
              </div>
            {:else}
              <button
                type="button"
                onclick={() => (confirmingRelease = true)}
                class="font-retro text-[0.55rem] underline"
                style="color: var(--color-silver); opacity: 0.55;"
              >
                {m.dashboard_release({ name: selectedCat.name })}
              </button>
            {/if}

            {#if releaseError}
              <p class="font-retro text-[0.55rem]" style="color: var(--color-magenta);">
                {releaseError}
              </p>
            {/if}
          </div>

          {#if lastGame}
            <p class="font-cursive mt-3 text-lg" style="color: var(--color-lime);">{lastGame}</p>
          {/if}
          {#if careError}
            <p class="font-retro mt-3 text-[0.6rem]" style="color: var(--color-magenta);">
              {careError}
            </p>
          {/if}
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
                <CatCard {cat} breeding={breedingByCat[cat.id]} />
              </button>

            </li>
          {/each}
        </ul>

        <div class="mt-4">
          <PantrySidebar
            {stock}
            cat={selectedCat ?? null}
            busy={caring}
            {supplyReadyAt}
            onUse={give}
          />
        </div>

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

      {#if catsAsleep}
        <p class="font-retro mb-2 text-[0.55rem]" style="color: var(--color-cyan);">
          😴 {m.sleep_no_games()}
        </p>
      {:else if selectedCat && selectedIsIll}
        <p class="font-retro mb-2 text-[0.55rem]" style="color: var(--color-magenta);">
          {m.play_too_ill({ cat: selectedCat.name })}
        </p>
      {:else if selectedCat && playLeft > 0}
        <p class="font-retro mb-2 text-[0.55rem]" style="color: var(--color-silver); opacity: 0.7;">
          {m.play_cooldown({ cat: selectedCat.name, time: formatCountdown(playLeft) })}
        </p>
      {/if}

      {#if otherCats.length === 0}
        <p class="font-cursive text-sm" style="color:var(--color-silver); opacity:0.7;">
          {m.dashboard_first_cat()}
        </p>
      {:else}
        <ul class="flex gap-3 overflow-x-auto pb-2">
          {#each otherCats as cat (cat.id)}
            <li class="flex flex-col gap-1">
              <CatCard {cat} variant="tile" breeding={breedingByCat[cat.id]} />
              <button
                type="button"
                onclick={() => play(cat.id, cat.name)}
                disabled={caring || !selectedCat || playLeft > 0 || selectedIsIll || catsAsleep}
                class="font-retro w-28 rounded-md px-2 py-2 text-[0.5rem] disabled:opacity-40"
                style="color: var(--color-cyan); background: rgba(255,255,255,0.04); border: 1px solid var(--color-cyan);"
              >
                {m.play_cta()}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <!-- breedings -->
    <div class="mt-4">
      <div class="mb-3 flex items-center justify-between">
        <h2
          style="font-family: var(--font-display); color: var(--color-gold); font-size: 1.1rem; text-shadow: 0 0 8px var(--color-gold);"
        >
          {m.dashboard_breedings()}
        </h2>
        <a
          href="/breedings"
          class="font-retro rounded-md px-3 py-2 text-[0.6rem]"
          style="color: var(--color-cyan); background: rgba(255,255,255,0.04); border: 1px solid var(--color-cyan);"
        >
          {m.dashboard_breedings_link()}
        </a>
      </div>

      {#if breedings.length === 0}
        <p class="font-cursive text-sm" style="color:var(--color-silver); opacity:0.7;">
          {m.breeding_empty()}
        </p>
      {:else}
        <ul class="flex gap-3 overflow-x-auto pb-2">
          {#each breedings as breeding (breeding.id)}
            <li>
              <a
                href="/breedings/{breeding.id}"
                class="flex w-32 shrink-0 flex-col items-center gap-2 rounded-xl p-3 transition-opacity hover:opacity-90"
                style={breeding.is_member
                  ? 'background: rgba(26,10,0,0.6); border: 1px solid var(--color-gold);'
                  : 'background: rgba(8,0,26,0.6); border: 1px solid var(--color-magic);'}
              >
                <span class="text-2xl">🏰</span>
                <p
                  class="w-full truncate text-center font-bold"
                  style="font-family: var(--font-display); color: var(--color-gold); font-size: 0.8rem;"
                >
                  {breeding.name}
                </p>
                <p class="font-retro text-[0.5rem]" style="color: var(--color-silver); opacity: 0.7;">
                  {m.breeding_cat_count({ count: breeding.cat_count })}
                </p>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <!-- game results -->
    {#if games.length > 0}
      <div class="mt-4">
        <h2
          class="mb-3"
          style="font-family: var(--font-display); color: var(--color-gold); font-size: 1.1rem; text-shadow: 0 0 8px var(--color-gold);"
        >
          {m.play_results()}
        </h2>
        <ul class="flex flex-col gap-2">
          {#each games as game (game.id)}
            <li
              class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl px-3 py-2"
              style="background: rgba(8,0,26,0.6); border: 1px solid var(--color-magic);"
            >
              <span class="font-retro text-[0.55rem]" style="color: var(--color-gold);">
                {gameKindLabel(game.kind)}
              </span>
              <span class="font-cursive text-base" style="color: var(--color-silver);">
                🏆 {(game.winner_cat_id === game.challenger?.id
                  ? game.challenger?.name
                  : game.opponent?.name) ?? m.breeding_unknown_cat()}
              </span>
              <span class="font-retro text-[0.55rem]" style="color: var(--color-cyan);">
                {game.challenger_score} : {game.opponent_score}
              </span>
              <span
                class="font-retro text-[0.5rem]"
                style="color: var(--color-silver); opacity: 0.6;"
              >
                {game.challenger?.name ?? '?'} vs {game.opponent?.name ?? '?'}
              </span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
</section>
