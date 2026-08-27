<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { formatCountdown, gameCooldownLeft, isNight, simulate } from '$lib/game/care';
  import { MAX_CATS } from '$lib/game/constants';
  import { m } from '$lib/paraglide/messages';
  import { supabase } from '$lib/supabase/client';
  import type {
    CatBreeding,
    CatRow,
    DashboardAlert,
    DashboardBreeding,
    GameFeedItem,
  } from '$lib/supabase/types';
  import CatCard from './CatCard.svelte';
  import CatHero from './CatHero.svelte';
  import PantrySidebar from './PantrySidebar.svelte';
  import MatingModal from './MatingModal.svelte';
  import ShelfExchange from './ShelfExchange.svelte';
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
    alerts,
    deaths,
    parents,
    username,
    playerNames,
    memberBreedings,
    shelves,
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
      | 'owner_user_id'
      | 'satiety'
      | 'happiness'
      | 'state_at'
      | 'illness'
      | 'gender'
      | 'pregnant_since'
      | 'due_at'
      | 'last_mated_at'
    >[];
    breedings: DashboardBreeding[];
    breedingByCat: Record<string, CatBreeding>;
    games: GameFeedItem[];
    stock: Record<string, number>;
    notes: Record<string, string>;
    supplyReadyAt: string | null;
    alerts: DashboardAlert[];
    deaths: { name: string; age_days: number }[];
    username: string | null;
    playerNames: Record<string, string>;
    parents: Record<string, { mother: string | null; father: string | null }>;
    memberBreedings: { id: string; name: string }[];
    shelves: Record<string, Record<string, number>>;
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
  let exchangeFor = $state<string | null>(null);
  let matingWith = $state('');
  /** The meeting, while it plays and once it has a result. */
  let meeting = $state<{
    left: { name: string; image_url: string };
    right: { name: string; image_url: string };
    outcome: { mated: boolean; chance: number; motherName: string | null } | null;
  } | null>(null);
  let kittenNames = $state<Record<string, string>>({});
  let usernameDraft = $state('');
  let cuddling = $state(false);
  let givingTo = $state('');

  async function saveUsername() {
    const chosen = usernameDraft.trim();
    if (chosen.length < 3) return;
    caring = true;
    careError = null;
    try {
      await post('/api/profile', { username: chosen }, m.username_failed());
      await invalidateAll();
    } catch (err) {
      careError = err instanceof Error ? err.message : m.username_failed();
    } finally {
      caring = false;
    }
  }

  const unnamed = $derived(myCats.filter((cat) => cat.named === false));

  async function nameKitten(catId: string) {
    const chosen = (kittenNames[catId] ?? '').trim();
    if (chosen.length < 1) return;
    caring = true;
    careError = null;
    try {
      await post(`/api/cats/${catId}/name`, { name: chosen }, m.kitten_name_failed());
      kittenNames = { ...kittenNames, [catId]: '' };
      await invalidateAll();
    } catch (err) {
      careError = err instanceof Error ? err.message : m.kitten_name_failed();
    } finally {
      caring = false;
    }
  }

  /** Partners the selected cat could try with: opposite gender, anyone's. */
  const mates = $derived(
    selectedCat
      ? [...myCats, ...otherCats].filter(
          (cat) => cat.id !== selectedCat.id && cat.gender && cat.gender !== selectedCat.gender,
        )
      : [],
  );

  async function cuddle() {
    if (!selectedCat) return;
    // The animation runs its course regardless of how fast the request returns.
    cuddling = true;
    setTimeout(() => (cuddling = false), 1400);
    caring = true;
    careError = null;
    try {
      await post(`/api/cats/${selectedCat.id}/cuddle`, {}, m.care_failed());
      await invalidateAll();
    } catch (err) {
      careError = err instanceof Error ? err.message : m.care_failed();
    } finally {
      caring = false;
    }
  }

  /** Breeding-mates who could take the selected cat off your hands. */
  const catRecipients = $derived(
    selectedCat && breedingByCat[selectedCat.id]
      ? otherCats.filter((cat) => breedingByCat[cat.id]?.id === breedingByCat[selectedCat.id]?.id)
      : [],
  );

  async function giveCat(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedCat || !givingTo) return;
    caring = true;
    careError = null;
    try {
      await post(`/api/cats/${selectedCat.id}/give-cat`, { to_cat_id: givingTo }, m.give_cat_failed());
      givingTo = '';
      await invalidateAll();
    } catch (err) {
      careError = err instanceof Error ? err.message : m.give_cat_failed();
    } finally {
      caring = false;
    }
  }

  async function mate(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedCat || !matingWith) return;

    const partner = mates.find((cat) => cat.id === matingWith);
    if (!partner) return;

    // The modal opens first and plays the meeting while the request is away.
    meeting = {
      left: { name: selectedCat.name, image_url: selectedCat.image_url },
      right: { name: partner.name, image_url: partner.image_url },
      outcome: null,
    };
    caring = true;
    careError = null;

    try {
      const result = (await post(
        `/api/cats/${selectedCat.id}/mate`,
        { partner_cat_id: matingWith },
        m.mating_failed(),
      )) as unknown as { mated: boolean; chance: number; mother?: { name: string } };

      meeting = meeting && {
        ...meeting,
        outcome: {
          mated: result.mated,
          chance: result.chance,
          motherName: result.mother?.name ?? null,
        },
      };
      matingWith = '';
      await invalidateAll();
    } catch (err) {
      meeting = null;
      careError = err instanceof Error ? err.message : m.mating_failed();
    } finally {
      caring = false;
    }
  }

  /** Other players, each addressed by one of their cats. */
  const giftablePlayers = $derived(
    [...new Map(otherCats.map((cat) => [cat.owner_user_id, cat])).values()].map((cat) => ({
      catId: cat.id,
      catName: playerNames[cat.owner_user_id] ?? cat.name,
      named: Boolean(playerNames[cat.owner_user_id]),
    })),
  );

  async function giftItem(toCatId: string, itemId: string) {
    caring = true;
    careError = null;
    try {
      await post('/api/gifts', { to_cat_id: toCatId, item_id: itemId }, m.shelf_failed());
      await invalidateAll();
    } catch (err) {
      careError = err instanceof Error ? err.message : m.shelf_failed();
    } finally {
      caring = false;
    }
  }

  /** One move between your pantry and a breeding's shelf. */
  async function moveItem(breedingId: string, itemId: string, action: 'donate' | 'take') {
    caring = true;
    careError = null;
    try {
      await post(`/api/breedings/${breedingId}/items`, { item_id: itemId, action }, m.shelf_failed());
      await invalidateAll();
    } catch (err) {
      careError = err instanceof Error ? err.message : m.shelf_failed();
    } finally {
      caring = false;
    }
  }

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

{#if meeting}
  <MatingModal
    left={meeting.left}
    right={meeting.right}
    outcome={meeting.outcome}
    onClose={() => (meeting = null)}
  />
{/if}

{#if exchangeFor}
  <ShelfExchange
    breedings={memberBreedings}
    breedingId={exchangeFor}
    players={giftablePlayers}
    myStock={stock}
    {shelves}
    busy={caring}
    onMove={moveItem}
    onGift={giftItem}
    onClose={() => (exchangeFor = null)}
  />
{/if}

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
          {username ? m.dashboard_title_named({ name: username }) : m.dashboard_title()}
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

    {#if username === null}
      <form
        onsubmit={(event) => {
          event.preventDefault();
          saveUsername();
        }}
        class="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3"
        style="background: rgba(8,0,26,0.7); border: 2px solid var(--color-cyan);"
      >
        <span class="font-retro text-[0.6rem]" style="color: var(--color-cyan);">
          {m.username_prompt()}
        </span>
        <input
          type="text"
          bind:value={usernameDraft}
          maxlength="20"
          required
          placeholder={m.username_placeholder()}
          class="min-w-48 flex-1 rounded-lg px-3 py-2 outline-none"
          style="background: rgba(0,0,0,0.5); color: var(--color-silver); font-family: var(--font-pixel); border: 2px solid var(--color-cyan);"
        />
        <button
          type="submit"
          disabled={caring || usernameDraft.trim().length < 3}
          class="font-retro rounded-md px-3 py-2 text-[0.6rem] disabled:opacity-50"
          style="color: var(--color-void); background: var(--color-cyan); border: 1px solid var(--color-cyan);"
        >
          {m.username_save()}
        </button>
      </form>
    {/if}

    {#each deaths as death (death.name + death.age_days)}
      <p
        class="font-cursive rounded-xl px-4 py-3 text-lg"
        style="background: rgba(20,20,30,0.7); border: 1px solid var(--color-silver); color: var(--color-silver);"
      >
        🕯️ {m.cat_died({ name: death.name, days: death.age_days })}
      </p>
    {/each}

    {#each unnamed as kitten (kitten.id)}
      <form
        onsubmit={(event) => {
          event.preventDefault();
          nameKitten(kitten.id);
        }}
        class="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3"
        style="background: rgba(26,10,0,0.6); border: 2px solid var(--color-gold); box-shadow: 0 0 12px rgba(255,196,0,0.35);"
      >
        <img
          src={kitten.image_url}
          alt=""
          class="h-12 w-12 rounded-full object-cover"
          style="border: 2px solid var(--color-gold);"
        />
        <span class="font-retro text-[0.6rem]" style="color: var(--color-gold);">
          🐣 {m.kitten_born()}
        </span>
        <input
          type="text"
          value={kittenNames[kitten.id] ?? ''}
          oninput={(event) =>
            (kittenNames = { ...kittenNames, [kitten.id]: event.currentTarget.value })}
          maxlength="32"
          required
          placeholder={m.kitten_name_placeholder({ suggestion: kitten.name })}
          class="min-w-48 flex-1 rounded-lg px-3 py-2 outline-none"
          style="background: rgba(0,0,0,0.5); color: var(--color-silver); font-family: var(--font-pixel); border: 2px solid var(--color-gold);"
        />
        <button
          type="submit"
          disabled={caring}
          class="font-retro rounded-md px-3 py-2 text-[0.6rem] disabled:opacity-50"
          style="color: var(--color-void); background: var(--color-gold); border: 1px solid var(--color-gold);"
        >
          {m.kitten_name_cta()}
        </button>
      </form>
    {/each}

    {#if alerts.length > 0}
      <!-- Someone is waiting on an answer: say so before anything else. -->
      <ul class="flex flex-col gap-2">
        {#each alerts as alert (alert.kind + alert.breeding_id + alert.cat_name)}
          <li>
            <a
              href="/breedings/{alert.breeding_id}"
              class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-3 transition-opacity hover:opacity-90"
              style="background: rgba(26,10,0,0.6); border: 2px solid var(--color-gold); box-shadow: 0 0 12px rgba(255,196,0,0.35);"
            >
              <span class="font-retro text-[0.6rem]" style="color: var(--color-gold);">
                {alert.kind === 'request' ? '📨' : '✉️'}
                {alert.kind === 'request'
                  ? m.alert_request({ cat: alert.cat_name, breeding: alert.breeding_name })
                  : m.alert_invite({ cat: alert.cat_name, breeding: alert.breeding_name })}
              </span>
              <span class="font-retro text-[0.55rem]" style="color: var(--color-cyan);">
                {m.alert_open()} →
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}

    <div class="flex flex-col gap-6 lg:flex-row lg:items-start">
      <!-- selected cat -->
      <div class="flex-1">
        {#if selectedCat}
          <CatHero
            cat={selectedCat}
            breeding={breedingByCat[selectedCat.id]}
            parents={parents[selectedCat.id] ?? null}
            busy={caring}
            note={notes[selectedCat.id] ?? ''}
            {savingNote}
            onDropItem={give}
            {cuddling}
            onCuddle={cuddle}
            onSaveNote={saveNote}
          />

          {#if catRecipients.length > 0}
            <form
              onsubmit={giveCat}
              class="mt-3 flex flex-col gap-2 rounded-xl p-4"
              style="background: rgba(8,0,26,0.55); border: 1px dashed var(--color-cyan);"
            >
              <p class="font-retro text-xs" style="color: var(--color-cyan);">
                {m.give_cat_title({ name: selectedCat.name })}
              </p>
              <select
                bind:value={givingTo}
                required
                class="rounded-lg px-3 py-2 outline-none"
                style="background: rgba(0,0,0,0.5); color: var(--color-silver); font-family: var(--font-pixel); border: 2px solid var(--color-cyan);"
              >
                <option value="" disabled>{m.give_cat_choose()}</option>
                {#each catRecipients as recipient (recipient.id)}
                  <option value={recipient.id}>
                    {playerNames[recipient.owner_user_id] ??
                      m.shelf_player_option({ cat: recipient.name })}
                  </option>
                {/each}
              </select>
              <button
                type="submit"
                disabled={caring || !givingTo}
                class="font-retro rounded-md px-3 py-3 text-[0.6rem] disabled:opacity-50"
                style="color: var(--color-void); background: var(--color-cyan); border: 1px solid var(--color-cyan);"
              >
                {m.give_cat_cta()}
              </button>
            </form>
          {/if}

          {#if mates.length > 0}
            <form
              onsubmit={mate}
              class="mt-3 flex flex-col gap-2 rounded-xl p-4"
              style="background: rgba(8,0,26,0.55); border: 1px dashed var(--color-magenta);"
            >
              <p class="font-retro text-xs" style="color: var(--color-magenta);">
                {m.mating_title()}
              </p>
              <select
                bind:value={matingWith}
                required
                class="rounded-lg px-3 py-2 outline-none"
                style="background: rgba(0,0,0,0.5); color: var(--color-silver); font-family: var(--font-pixel); border: 2px solid var(--color-magenta);"
              >
                <option value="" disabled>{m.mating_choose()}</option>
                {#each mates as partner (partner.id)}
                  <option value={partner.id}>{partner.name}</option>
                {/each}
              </select>
              <button
                type="submit"
                disabled={caring || !matingWith}
                class="font-retro rounded-md px-3 py-3 text-[0.6rem] disabled:opacity-50"
                style="color: var(--color-void); background: var(--color-magenta); border: 1px solid var(--color-magenta);"
              >
                {m.mating_cta()}
              </button>
              <p class="font-retro text-[0.5rem]" style="color: var(--color-silver); opacity: 0.6;">
                {m.mating_hint()}
              </p>
            </form>
          {/if}

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
            shelfBreedings={memberBreedings}
            canShare={memberBreedings.length + giftablePlayers.length > 0}
            onUse={give}
            onOpenExchange={() =>
              (exchangeFor = memberBreedings[0]?.id ?? `player:${giftablePlayers[0]?.catId ?? ''}`)}
          />
        </div>

        <div class="mt-4 flex flex-col gap-2">
          <a
            href="/tame"
            aria-disabled={isFull}
            tabindex={isFull ? -1 : undefined}
            class="btn-magic text-center text-lg"
            class:pointer-events-none={isFull}
            style={isFull ? 'opacity:0.5; animation:none; box-shadow:none;' : ''}
          >
            {m.dashboard_tame_new()}
          </a>

          <p
            class="font-retro text-center text-[0.55rem]"
            style="color: var(--color-silver); opacity: 0.7;"
          >
            {m.dashboard_tame_rule({ max: MAX_CATS })}
          </p>
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
