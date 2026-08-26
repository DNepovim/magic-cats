<script lang="ts">
  import { GAME_DURATION_MS, LASER_POUNCE_MS, LASER_TARGET, type Claim } from '$lib/game/play';

  const {
    catImage,
    onFinish,
  }: {
    catImage: string;
    onFinish: (claim: Claim, elapsed: number) => void;
  } = $props();

  const duration = GAME_DURATION_MS.laser;

  let field = $state<HTMLDivElement | null>(null);
  let dot = $state({ x: 0.5, y: 0.5 });
  let cat = $state({ x: 0.2, y: 0.8 });
  let elapsed = $state(0);
  let pounces = $state(0);
  let flash = $state(false);

  // She only pounces on a dot that has gone still — the same reason a real cat
  // ignores a laser you swing in circles.
  let stillFor = 0;
  let lastPounceAt = 0;

  $effect(() => {
    const startedAt = Date.now();
    let last = startedAt;
    let frame = 0;

    const tick = () => {
      const now = Date.now();
      const delta = Math.min(50, now - last);
      last = now;
      elapsed = now - startedAt;

      // She accelerates toward the dot but overshoots, so she has to circle back.
      const dx = dot.x - cat.x;
      const dy = dot.y - cat.y;
      const distance = Math.hypot(dx, dy);
      const speed = 0.0016 * delta;
      cat = { x: cat.x + dx * speed * 3, y: cat.y + dy * speed * 3 };

      stillFor = moved ? 0 : stillFor + delta;
      moved = false;

      if (distance < 0.08 && stillFor > 350 && now - lastPounceAt > LASER_POUNCE_MS) {
        pounces += 1;
        lastPounceAt = now;
        flash = true;
        setTimeout(() => (flash = false), 260);
      }

      if (elapsed >= duration) {
        onFinish({ count: pounces }, elapsed);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const timer = setTimeout(() => onFinish({ count: pounces }, Date.now() - startedAt), duration + 80);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  });

  let moved = $state(false);

  const aim = (event: PointerEvent) => {
    const rect = field?.getBoundingClientRect();
    if (!rect) return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    if (Math.hypot(x - dot.x, y - dot.y) > 0.01) moved = true;
    dot = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  };
</script>

<svelte:window onpointermove={aim} />

<div bind:this={field} class="absolute inset-0 cursor-none">
  <div class="absolute top-3 left-3 z-10">
    <span
      class="font-retro rounded-md px-3 py-2 text-[0.6rem]"
      style="color: var(--color-gold); background: rgba(8,0,26,0.8); border: 1px solid var(--color-gold);"
    >
      {Math.ceil((duration - elapsed) / 1000)}s · {pounces}/{LASER_TARGET}
    </span>
  </div>

  <img
    src={catImage}
    alt=""
    class="absolute rounded-full object-cover"
    style="left: {cat.x * 100}%; top: {cat.y *
      100}%; width: 90px; height: 90px; transform: translate(-50%, -50%) scale({flash
      ? 1.25
      : 1}); border: 3px solid {flash ? 'var(--color-lime)' : 'var(--color-gold)'}; transition: transform 0.2s;"
  />

  <span
    class="pointer-events-none absolute rounded-full"
    style="left: {dot.x * 100}%; top: {dot.y *
      100}%; width: 16px; height: 16px; transform: translate(-50%, -50%); background: var(--color-magenta); box-shadow: 0 0 14px 6px rgba(255,0,128,0.7);"
    aria-hidden="true"
  ></span>
</div>
