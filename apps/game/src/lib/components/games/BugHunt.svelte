<script lang="ts">
  import { bugsFor, GAME_DURATION_MS, type Claim } from '$lib/game/play';

  const {
    seed,
    onFinish,
  }: {
    seed: number;
    onFinish: (claim: Claim, elapsed: number) => void;
  } = $props();

  const bugs = $derived(bugsFor(seed));
  const duration = GAME_DURATION_MS.bugs;

  let elapsed = $state(0);
  let caught = $state<number[]>([]);

  $effect(() => {
    const startedAt = Date.now();
    let frame = 0;
    const tick = () => {
      elapsed = Date.now() - startedAt;
      if (elapsed >= duration) {
        onFinish({ indices: caught }, elapsed);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    // A backgrounded tab stops animating but the round still has to end.
    const timer = setTimeout(() => onFinish({ indices: caught }, Date.now() - startedAt), duration + 80);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  });

  const visible = $derived(
    bugs
      .filter((bug) => !caught.includes(bug.index))
      .map((bug) => ({ bug, progress: (elapsed - bug.spawnAt) / bug.travelMs }))
      .filter(({ progress }) => progress >= 0 && progress <= 1),
  );

  const pounce = (index: number) => {
    if (!caught.includes(index)) caught = [...caught, index];
  };
</script>

<div class="absolute top-3 left-3 z-10">
  <span
    class="font-retro rounded-md px-3 py-2 text-[0.6rem]"
    style="color: var(--color-gold); background: rgba(8,0,26,0.8); border: 1px solid var(--color-gold);"
  >
    {Math.ceil((duration - elapsed) / 1000)}s · {caught.length}/{bugs.length}
  </span>
</div>

{#each visible as { bug, progress } (bug.index)}
  <button
    type="button"
    onclick={() => pounce(bug.index)}
    aria-label={bug.emoji}
    class="absolute grid place-items-center rounded-full"
    style="left: {(bug.fromX + (bug.toX - bug.fromX) * progress) * 100}%; top: {(bug.fromY +
      (bug.toY - bug.fromY) * progress) *
      100}%; width: {bug.size}px; height: {bug.size}px; transform: translate(-50%, -50%); font-size: {bug.size *
      0.55}px; background: rgba(0,0,0,0.4); border: 2px solid var(--color-lime); box-shadow: 0 0 10px var(--color-lime);"
  >
    {bug.emoji}
  </button>
{/each}
