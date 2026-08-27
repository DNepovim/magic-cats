<script lang="ts">
  import { GAME_DURATION_MS, TANGLE_WORK_MS, tanglesFor, type Claim } from '$lib/game/play';

  const {
    seed,
    catImage,
    onFinish,
  }: {
    seed: number;
    catImage: string;
    onFinish: (claim: Claim, elapsed: number) => void;
  } = $props();

  const tangles = $derived(tanglesFor(seed));
  const duration = GAME_DURATION_MS.brush;

  let elapsed = $state(0);
  let cleared = $state<number[]>([]);
  let brush = $state<{ x: number; y: number } | null>(null);
  let field = $state<HTMLDivElement | null>(null);
  /** tangle index → milliseconds of brushing done so far. */
  let worked = $state<Record<number, number>>({});

  $effect(() => {
    const startedAt = Date.now();
    let last = startedAt;
    let frame = 0;

    const tick = () => {
      const now = Date.now();
      const delta = now - last;
      last = now;
      elapsed = now - startedAt;

      // Only the tangle under the brush makes progress, and only while moving.
      if (brush) {
        for (const tangle of tangles) {
          if (cleared.includes(tangle.index)) continue;
          const dx = (brush.x - tangle.x) * 100;
          const dy = (brush.y - tangle.y) * 100;
          if (Math.hypot(dx, dy) > 9) continue;

          const done = (worked[tangle.index] ?? 0) + delta;
          worked = { ...worked, [tangle.index]: done };
          if (done >= TANGLE_WORK_MS) cleared = [...cleared, tangle.index];
        }
      }

      if (elapsed >= duration || cleared.length === tangles.length) {
        onFinish({ indices: cleared }, elapsed);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const timer = setTimeout(() => onFinish({ indices: cleared }, Date.now() - startedAt), duration + 80);

    // A hidden tab stops animating, so the round would run down unplayed and
    // unwatched. Hand in what was earned instead of letting it expire.
    const onHidden = () => {
      if (document.visibilityState === 'hidden') onFinish({ indices: cleared }, Date.now() - startedAt);
    };
    document.addEventListener('visibilitychange', onHidden);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onHidden);
    };
  });

  const track = (event: PointerEvent) => {
    const rect = field?.getBoundingClientRect();
    if (!rect) return;
    brush = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };
</script>

<svelte:window onpointermove={track} onpointerleave={() => (brush = null)} />

<div bind:this={field} class="absolute inset-0">
  <div class="absolute top-3 left-3 z-10">
    <span
      class="font-retro rounded-md px-3 py-2 text-[0.6rem]"
      style="color: var(--color-gold); background: rgba(8,0,26,0.8); border: 1px solid var(--color-gold);"
    >
      {Math.ceil((duration - elapsed) / 1000)}s · {cleared.length}/{tangles.length}
    </span>
  </div>

  <img
    src={catImage}
    alt=""
    class="absolute top-1/2 left-1/2 rounded-full object-cover opacity-70"
    style="width: 260px; height: 260px; transform: translate(-50%, -50%); border: 3px solid var(--color-gold);"
  />

  {#each tangles as tangle (tangle.index)}
    {#if !cleared.includes(tangle.index)}
      {@const progress = Math.min(1, (worked[tangle.index] ?? 0) / TANGLE_WORK_MS)}
      <span
        class="absolute grid place-items-center rounded-full"
        style="left: {tangle.x * 100}%; top: {tangle.y *
          100}%; width: {tangle.size}px; height: {tangle.size}px; transform: translate(-50%, -50%); font-size: {tangle.size *
          0.5}px; background: rgba(0,0,0,0.45); border: 2px solid var(--color-orange); opacity: {1 -
          progress * 0.6};"
      >
        🌀
      </span>
    {/if}
  {/each}

  {#if brush}
    <span
      class="pointer-events-none absolute text-3xl"
      style="left: {brush.x * 100}%; top: {brush.y * 100}%; transform: translate(-50%, -50%);"
      aria-hidden="true"
    >
      🪮
    </span>
  {/if}
</div>
