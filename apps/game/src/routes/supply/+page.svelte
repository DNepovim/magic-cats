<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { formatCountdown } from '$lib/game/care';
  import { ITEMS, itemById } from '$lib/game/items';
  import { RUN_DURATION_MS, scheduleFor, type SupplyDrop } from '$lib/game/supply';
  import PageNav from '$lib/components/PageNav.svelte';
  import Sparkles from '$lib/components/Sparkles.svelte';
  import { m } from '$lib/paraglide/messages';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  let runId = $state<string | null>(null);
  let schedule = $state<SupplyDrop[]>([]);
  let caught = $state<number[]>([]);
  let elapsed = $state(0);
  let starting = $state(false);
  let error = $state<string | null>(null);
  let haul = $state<{ item_id: string; count: number }[] | null>(null);
  let now = $state(Date.now());
  let endTimer: ReturnType<typeof setTimeout> | null = null;

  const running = $derived(runId !== null && elapsed < RUN_DURATION_MS);
  const readyIn = $derived(data.readyAt ? Math.max(0, Date.parse(data.readyAt) - now) : 0);

  // Everything on screen is a slice of the schedule: a drop is visible from its
  // spawn until it has crossed the field, and its position is pure elapsed time.
  const visible = $derived(
    schedule
      .filter((drop) => !caught.includes(drop.index))
      .map((drop) => ({ drop, progress: (elapsed - drop.spawnAt) / (RUN_DURATION_MS * drop.speed) }))
      .filter(({ progress }) => progress >= 0 && progress <= 1),
  );

  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 1000);

    // Leaving the tab banks the haul rather than dropping it.
    const onHidden = () => {
      if (document.visibilityState === 'hidden' && runId !== null) void finish();
    };
    document.addEventListener('visibilitychange', onHidden);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onHidden);
      if (endTimer !== null) clearTimeout(endTimer);
    };
  });

  async function start() {
    starting = true;
    error = null;
    haul = null;
    try {
      const res = await fetch('/api/supply/start', { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? m.supply_failed());
      }
      const run = (await res.json()) as { run_id: string; seed: number };
      runId = run.run_id;
      schedule = scheduleFor(run.seed);
      caught = [];
      elapsed = 0;

      const startedAt = Date.now();
      const tick = () => {
        elapsed = Date.now() - startedAt;
        if (elapsed >= RUN_DURATION_MS) {
          void finish();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      // requestAnimationFrame stops in a backgrounded tab, so the run would
      // never hand itself in — and everything caught would be lost. A timer
      // and a visibility check both fall back to the same idempotent finish.
      endTimer = setTimeout(() => void finish(), RUN_DURATION_MS + 100);
    } catch (err) {
      error = err instanceof Error ? err.message : m.supply_failed();
    } finally {
      starting = false;
    }
  }

  async function finish() {
    const id = runId;
    if (!id) return;
    runId = null;
    if (endTimer !== null) {
      clearTimeout(endTimer);
      endTimer = null;
    }
    try {
      const res = await fetch('/api/supply/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: id, caught }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? m.supply_failed());
      }
      haul = ((await res.json()) as { granted: { item_id: string; count: number }[] }).granted;
      await invalidateAll();
    } catch (err) {
      error = err instanceof Error ? err.message : m.supply_failed();
    }
  }

  const grab = (index: number) => {
    if (!running || caught.includes(index)) return;
    caught = [...caught, index];
  };
</script>

<section
  class="relative min-h-screen overflow-hidden px-4 py-10"
  style="background: radial-gradient(ellipse at 20% 20%, #2a005a 0%, #08001a 55%), radial-gradient(ellipse at 80% 80%, #001a3a 0%, transparent 60%);"
>
  <Sparkles count={20} />

  <div class="relative z-10 mx-auto flex max-w-4xl flex-col gap-6">
    <PageNav trail={[{ label: m.supply_title() }]} />

    <header>
      <span class="font-retro text-xs" style="color: var(--color-lime);">{m.supply_label()}</span>
      <h1
        class="title-shimmer"
        style="font-family: var(--font-chunky); font-size: clamp(2rem, 5vw, 3rem); line-height: 1.1;"
      >
        {m.supply_title()}
      </h1>
      <p class="font-cursive text-lg" style="color: var(--color-cyan);">{m.supply_subtitle()}</p>
    </header>

    <!-- field -->
    <div
      class="relative h-80 overflow-hidden rounded-2xl select-none"
      style="background: rgba(8,0,26,0.6); border: 2px solid var(--color-magic); touch-action: none;"
    >
      {#if running}
        <div
          class="font-retro absolute top-3 left-3 z-10 rounded-md px-3 py-2 text-[0.6rem]"
          style="color: var(--color-gold); background: rgba(8,0,26,0.8); border: 1px solid var(--color-gold);"
        >
          {Math.ceil((RUN_DURATION_MS - elapsed) / 1000)}s · {caught.length}
        </div>

        {#each visible as { drop, progress } (drop.index)}
          {@const item = itemById(drop.itemId)}
          <button
            type="button"
            onclick={() => grab(drop.index)}
            aria-label={drop.itemId}
            class="absolute grid place-items-center rounded-full"
            style="left: {progress * 100}%; top: {drop.lane *
              100}%; width: {drop.size}px; height: {drop.size}px; transform: translate(-50%, -50%); font-size: {drop.size *
              0.5}px; background: rgba(0,0,0,0.45); border: 2px solid var(--color-cyan); box-shadow: 0 0 10px var(--color-cyan);"
          >
            {item?.emoji ?? '❓'}
          </button>
        {/each}
      {:else}
        <div class="absolute inset-0 grid place-items-center p-6 text-center">
          <div class="flex flex-col items-center gap-3">
            {#if haul}
              <p class="font-retro text-xs" style="color: var(--color-lime);">
                {m.supply_haul({ count: haul.reduce((sum, row) => sum + row.count, 0) })}
              </p>
              <div class="flex flex-wrap justify-center gap-2">
                {#each haul as row (row.item_id)}
                  <span
                    class="font-retro rounded-md px-3 py-2 text-[0.6rem]"
                    style="color: var(--color-silver); background: rgba(255,255,255,0.05); border: 1px solid var(--color-lime);"
                  >
                    {itemById(row.item_id)?.emoji ?? '❓'} ×{row.count}
                  </span>
                {/each}
              </div>
            {/if}

            <button
              type="button"
              onclick={start}
              disabled={starting || readyIn > 0}
              class="btn-magic text-lg disabled:opacity-50"
            >
              {readyIn > 0 ? formatCountdown(readyIn) : m.supply_start()}
            </button>

            {#if error}
              <p class="font-retro text-[0.6rem]" style="color: var(--color-magenta);">{error}</p>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- pantry -->
    <div>
      <h2
        class="mb-3"
        style="font-family: var(--font-display); color: var(--color-gold); font-size: 1.1rem; text-shadow: 0 0 8px var(--color-gold);"
      >
        {m.supply_pantry()}
      </h2>
      <ul class="flex flex-wrap gap-2">
        {#each ITEMS as item (item.id)}
          <li
            class="font-retro rounded-md px-3 py-2 text-[0.6rem]"
            style="color: var(--color-silver); background: rgba(8,0,26,0.6); border: 1px solid {(data
              .stock[item.id] ?? 0) > 0
              ? 'var(--color-lime)'
              : 'var(--color-magic)'}; opacity: {(data.stock[item.id] ?? 0) > 0 ? 1 : 0.45};"
          >
            {item.emoji} ×{data.stock[item.id] ?? 0}
          </li>
        {/each}
      </ul>
    </div>
  </div>
</section>
