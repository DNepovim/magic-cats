<script lang="ts">
  import { THRESHOLD } from '$lib/game/constants';
  import type { CatEntity } from '$lib/game/types';

  const { cat }: { cat: CatEntity } = $props();
  const progress = $derived(Math.min(1, cat.points / THRESHOLD));
</script>

<!-- numeric progress label keeps the original `N/THRESHOLD` form regardless of locale -->


<div
  class="pointer-events-none absolute flex flex-col items-center gap-1 select-none"
  style="left:0;top:0;transform:translate({cat.x}px,{cat.y}px);width:{cat.size}px;"
>
  <!-- progress bar -->
  <div
    class="h-2 w-full overflow-hidden rounded-full"
    style="background: rgba(0,0,0,0.4); border:1px solid var(--color-magic); box-shadow: 0 0 6px var(--color-magic);"
  >
    <div
      class="h-full rounded-full"
      style="width: {progress * 100}%; background: linear-gradient(90deg, var(--color-cyan), var(--color-gold)); box-shadow: 0 0 8px var(--color-gold);"
    ></div>
  </div>

  <!-- the cat -->
  <img
    src={cat.imageUrl}
    alt=""
    width={cat.size}
    height={cat.size}
    draggable="false"
    class="rounded-xl object-cover"
    style="width:{cat.size}px;height:{cat.size}px;border:2px solid var(--color-gold);box-shadow:0 0 12px var(--color-magic),0 0 24px var(--color-magenta);"
  />

  <span
    class="font-retro"
    style="font-size:0.55rem;color:var(--color-gold);text-shadow:0 0 4px var(--color-gold);"
  >
    {cat.points}/{THRESHOLD}
  </span>
</div>
