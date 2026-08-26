<script lang="ts">
  import { BOX_SWAP_MS, boxShuffleFor, type Claim } from '$lib/game/play';
  import { m } from '$lib/paraglide/messages';

  const {
    seed,
    catImage,
    onFinish,
  }: {
    seed: number;
    catImage: string;
    onFinish: (claim: Claim, elapsed: number) => void;
  } = $props();

  const shuffle = $derived(boxShuffleFor(seed));

  // positions[slot] = which box is standing in that slot right now.
  let positions = $state([0, 1, 2]);
  let phase = $state<'peek' | 'shuffling' | 'pick'>('peek');
  let startedAt = $state(Date.now());

  $effect(() => {
    startedAt = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(
      setTimeout(() => {
        phase = 'shuffling';

        shuffle.swaps.forEach(([a, b], step) => {
          timers.push(
            setTimeout(
              () => {
                positions = positions.map((box) => (box === a ? b : box === b ? a : box));
                if (step === shuffle.swaps.length - 1) phase = 'pick';
              },
              (step + 1) * BOX_SWAP_MS,
            ),
          );
        });
      }, 1400),
    );

    return () => timers.forEach(clearTimeout);
  });

  const pick = (slot: number) => {
    if (phase !== 'pick') return;
    onFinish({ pick: positions[slot] }, Date.now() - startedAt);
  };
</script>

<div class="absolute inset-0 flex flex-col items-center justify-center gap-6">
  <p class="font-cursive text-xl" style="color: var(--color-cyan);">
    {phase === 'peek' ? m.play_boxes_watch() : phase === 'shuffling' ? m.play_boxes_shuffling() : m.play_boxes_pick()}
  </p>

  <div class="flex items-end gap-6">
    {#each positions as box, slot (slot)}
      <button
        type="button"
        onclick={() => pick(slot)}
        disabled={phase !== 'pick'}
        aria-label={`${slot + 1}`}
        class="relative grid h-28 w-28 place-items-center rounded-xl text-5xl transition-transform"
        class:hover:scale-105={phase === 'pick'}
        style="background: rgba(8,0,26,0.8); border: 2px solid {phase === 'pick'
          ? 'var(--color-gold)'
          : 'var(--color-magic)'};"
      >
        📦
        {#if phase === 'peek' && box === shuffle.hiding}
          <img
            src={catImage}
            alt=""
            class="absolute -top-8 h-16 w-16 rounded-full object-cover"
            style="border: 2px solid var(--color-gold);"
          />
        {/if}
      </button>
    {/each}
  </div>
</div>
