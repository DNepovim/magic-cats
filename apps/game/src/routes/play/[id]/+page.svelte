<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import PageNav from '$lib/components/PageNav.svelte';
  import Sparkles from '$lib/components/Sparkles.svelte';
  import BoxShuffle from '$lib/components/games/BoxShuffle.svelte';
  import Brushing from '$lib/components/games/Brushing.svelte';
  import BugHunt from '$lib/components/games/BugHunt.svelte';
  import LaserChase from '$lib/components/games/LaserChase.svelte';
  import YarnRally from '$lib/components/games/YarnRally.svelte';
  import { formatCountdown } from '$lib/game/care';
  import { GAME_EMOJI, GAME_IDS, type Claim, type GameId } from '$lib/game/play';
  import { m } from '$lib/paraglide/messages';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  let round = $state<{ id: string; seed: number; game: GameId } | null>(null);
  let starting = $state(false);
  let error = $state<string | null>(null);
  let result = $state<{ score: number; gain: number } | null>(null);

  const name = (game: GameId) =>
    ({
      laser: m.play_game_laser(),
      bugs: m.play_game_bugs(),
      yarn: m.play_game_yarn(),
      brush: m.play_game_brush(),
      boxes: m.play_game_boxes(),
    })[game];

  const hint = (game: GameId) =>
    ({
      laser: m.play_game_laser_hint(),
      bugs: m.play_game_bugs_hint(),
      yarn: m.play_game_yarn_hint(),
      brush: m.play_game_brush_hint(),
      boxes: m.play_game_boxes_hint(),
    })[game];

  async function start(game: GameId) {
    starting = true;
    error = null;
    result = null;
    try {
      const res = await fetch('/api/play/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cat_id: data.cat.id, game }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? m.play_failed());
      }
      const started = (await res.json()) as { round_id: string; seed: number };
      round = { id: started.round_id, seed: started.seed, game };
    } catch (err) {
      error = err instanceof Error ? err.message : m.play_failed();
    } finally {
      starting = false;
    }
  }

  /** Every game hands back the same shape; the server decides what it is worth. */
  async function finish(claim: Claim) {
    const current = round;
    if (!current) return;
    round = null;
    try {
      const res = await fetch('/api/play/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: current.id, claim }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? m.play_failed());
      }
      const banked = (await res.json()) as { score: number; happiness_gain: number };
      result = { score: banked.score, gain: banked.happiness_gain };
      await invalidateAll();
    } catch (err) {
      error = err instanceof Error ? err.message : m.play_failed();
    }
  }
</script>

<section
  class="relative min-h-screen overflow-hidden px-4 py-10"
  style="background: radial-gradient(ellipse at 20% 20%, #2a005a 0%, #08001a 55%), radial-gradient(ellipse at 80% 80%, #001a3a 0%, transparent 60%);"
>
  <Sparkles count={18} />

  <div class="relative z-10 mx-auto flex max-w-4xl flex-col gap-6">
    <PageNav trail={[{ label: m.play_with({ name: data.cat.name }) }]} />

    <header>
      <span class="font-retro text-xs" style="color: var(--color-lime);">{m.play_label()}</span>
      <h1
        class="title-shimmer"
        style="font-family: var(--font-chunky); font-size: clamp(2rem, 5vw, 3rem); line-height: 1.1;"
      >
        {m.play_with({ name: data.cat.name })}
      </h1>
    </header>

    <!-- field -->
    <div
      class="relative h-96 overflow-hidden rounded-2xl select-none"
      style="background: rgba(8,0,26,0.6); border: 2px solid var(--color-magic);"
    >
      {#if round}
        {#key round.id}
          {#if round.game === 'laser'}
            <LaserChase catImage={data.cat.image_url} onFinish={(claim) => finish(claim)} />
          {:else if round.game === 'bugs'}
            <BugHunt seed={round.seed} onFinish={(claim) => finish(claim)} />
          {:else if round.game === 'yarn'}
            <YarnRally catImage={data.cat.image_url} onFinish={(claim) => finish(claim)} />
          {:else if round.game === 'brush'}
            <Brushing
              seed={round.seed}
              catImage={data.cat.image_url}
              onFinish={(claim) => finish(claim)}
            />
          {:else}
            <BoxShuffle
              seed={round.seed}
              catImage={data.cat.image_url}
              onFinish={(claim) => finish(claim)}
            />
          {/if}
        {/key}
      {:else}
        <div class="absolute inset-0 grid place-items-center p-6">
          <div class="flex flex-col items-center gap-4 text-center">
            {#if result}
              <p class="font-cursive text-2xl" style="color: var(--color-lime);">
                {m.play_result({ score: result.score, gain: result.gain })}
              </p>
              <a href="/" class="btn-magic text-lg">{m.play_back()}</a>
            {:else if data.refusal === 'ill'}
              <p class="font-cursive text-xl" style="color: var(--color-magenta);">
                {m.play_too_ill({ cat: data.cat.name })}
              </p>
              <a href="/" class="btn-magic text-lg">{m.play_back()}</a>
            {:else if data.refusal === 'resting'}
              <p class="font-cursive text-xl" style="color: var(--color-silver);">
                {m.play_cooldown({
                  cat: data.cat.name,
                  time: formatCountdown(data.restingFor),
                })}
              </p>
              <a href="/" class="btn-magic text-lg">{m.play_back()}</a>
            {:else}
              <p class="font-cursive text-xl" style="color: var(--color-cyan);">
                {m.play_choose()}
              </p>
            {/if}

            {#if error}
              <p class="font-retro text-[0.6rem]" style="color: var(--color-magenta);">{error}</p>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- picker -->
    {#if !round && data.refusal === null}
      <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each GAME_IDS as game (game)}
          <li>
            <button
              type="button"
              onclick={() => start(game)}
              disabled={starting}
              class="flex w-full flex-col items-start gap-1 rounded-xl p-4 text-left transition-opacity hover:opacity-90 disabled:opacity-50"
              style="background: rgba(8,0,26,0.6); border: 2px solid var(--color-magic);"
            >
              <span class="text-2xl" aria-hidden="true">{GAME_EMOJI[game]}</span>
              <span
                class="font-bold"
                style="font-family: var(--font-display); color: var(--color-gold); font-size: 1.1rem;"
              >
                {name(game)}
              </span>
              <span class="font-cursive text-sm" style="color: var(--color-silver); opacity: 0.8;">
                {hint(game)}
              </span>
            </button>
          </li>
        {/each}
      </ul>

      <p class="font-retro text-[0.55rem]" style="color: var(--color-silver); opacity: 0.6;">
        {m.play_preference_hint()}
      </p>
    {/if}
  </div>
</section>
