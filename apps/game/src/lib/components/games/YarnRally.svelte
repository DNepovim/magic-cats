<script lang="ts">
  import { GAME_DURATION_MS, YARN_TARGET, YARN_VOLLEY_MS, type Claim } from '$lib/game/play';

  const {
    catImage,
    onFinish,
  }: {
    catImage: string;
    onFinish: (claim: Claim, elapsed: number) => void;
  } = $props();

  const duration = GAME_DURATION_MS.yarn;

  let field = $state<HTMLDivElement | null>(null);
  let ball = $state({ x: 0.5, y: 0.75, vx: 0, vy: 0 });
  let held = $state<{ x: number; y: number; at: number } | null>(null);
  /** The last few pointer samples — a flick is measured over a window, not
   *  between the final two move events, which are microseconds apart. */
  let trail: { x: number; y: number; at: number }[] = [];
  let elapsed = $state(0);
  let volleys = $state(0);
  let batting = $state(false);

  let lastVolleyAt = 0;

  $effect(() => {
    const startedAt = Date.now();
    let last = startedAt;
    let frame = 0;

    const tick = () => {
      const now = Date.now();
      const delta = Math.min(50, now - last) / 1000;
      last = now;
      elapsed = now - startedAt;

      if (!held) {
        let { x, y, vx, vy } = ball;
        x += vx * delta;
        y += vy * delta;
        vx *= 0.995;
        vy *= 0.995;

        // Walls bounce; the top edge is her side of the field.
        if (x < 0.04 || x > 0.96) vx = -vx;
        if (y > 0.96) vy = -Math.abs(vy);

        if (y < 0.22 && vy < 0 && now - lastVolleyAt > YARN_VOLLEY_MS) {
          // She bats it back down at an angle of her choosing.
          volleys += 1;
          lastVolleyAt = now;
          batting = true;
          setTimeout(() => (batting = false), 250);
          vy = Math.abs(vy) * 0.9 + 0.15;
          vx += (Math.random() - 0.5) * 0.3;
          y = 0.22;
        }

        ball = { x: Math.max(0.02, Math.min(0.98, x)), y: Math.min(0.98, y), vx, vy };
      }

      if (elapsed >= duration) {
        onFinish({ count: volleys }, elapsed);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const timer = setTimeout(() => onFinish({ count: volleys }, Date.now() - startedAt), duration + 80);

    // A hidden tab stops animating, so the round would run down unplayed and
    // unwatched. Hand in what was earned instead of letting it expire.
    const onHidden = () => {
      if (document.visibilityState === 'hidden') onFinish({ count: volleys }, Date.now() - startedAt);
    };
    document.addEventListener('visibilitychange', onHidden);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onHidden);
    };
  });

  const toField = (event: PointerEvent) => {
    const rect = field?.getBoundingClientRect();
    if (!rect) return null;
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };

  const grab = (event: PointerEvent) => {
    const point = toField(event);
    if (!point) return;
    if (Math.hypot(point.x - ball.x, point.y - ball.y) > 0.16) return;
    event.preventDefault();
    held = { ...point, at: Date.now() };
    trail = [{ ...point, at: Date.now() }];
    ball = { ...ball, vx: 0, vy: 0 };
  };

  const drag = (event: PointerEvent) => {
    if (!held) return;
    const point = toField(event);
    if (!point) return;
    ball = { ...ball, x: point.x, y: point.y };
    held = { ...point, at: Date.now() };
    trail = [...trail, { ...point, at: Date.now() }].slice(-8);
  };

  /** Release velocity is the flick: throw it at her and she will send it back. */
  const release = (event: PointerEvent) => {
    if (!held) return;
    const point = toField(event);
    const now = Date.now();

    if (point) {
      // Measure the throw across the last ~140ms of movement rather than the
      // final pair of events, whose delta is near zero however hard you flick.
      const from = trail.find((sample) => now - sample.at <= 140) ?? trail[0] ?? held;
      const seconds = Math.max(0.05, (now - from.at) / 1000);
      ball = {
        ...ball,
        vx: ((point.x - from.x) / seconds) * 0.9,
        vy: ((point.y - from.y) / seconds) * 0.9,
      };
    }

    trail = [];
    held = null;
  };
</script>

<svelte:window onpointermove={drag} onpointerup={release} onpointercancel={release} />

<div bind:this={field} class="absolute inset-0 touch-none" onpointerdown={grab} role="presentation">
  <div class="absolute top-3 left-3 z-10">
    <span
      class="font-retro rounded-md px-3 py-2 text-[0.6rem]"
      style="color: var(--color-gold); background: rgba(8,0,26,0.8); border: 1px solid var(--color-gold);"
    >
      {Math.ceil((duration - elapsed) / 1000)}s · {volleys}/{YARN_TARGET}
    </span>
  </div>

  <img
    src={catImage}
    alt=""
    class="absolute top-6 left-1/2 rounded-full object-cover"
    style="width: 96px; height: 96px; transform: translate(-50%, 0) scale({batting
      ? 1.15
      : 1}); border: 3px solid {batting ? 'var(--color-lime)' : 'var(--color-gold)'}; transition: transform 0.2s;"
  />

  <span
    class="absolute grid place-items-center rounded-full text-3xl"
    style="left: {ball.x * 100}%; top: {ball.y *
      100}%; width: 54px; height: 54px; transform: translate(-50%, -50%); cursor: grab;"
    aria-hidden="true"
  >
    🧶
  </span>
</div>
