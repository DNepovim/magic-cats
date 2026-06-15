<script lang="ts">
  import { goto } from '$app/navigation';
  import { m } from '$lib/paraglide/messages';
  import {
    CAT_COUNT,
    CAT_RESPAWN_MS,
    FOOD_COUNT,
    FOOD_RESPAWN_MS,
    THRESHOLD,
  } from '$lib/game/constants';
  import {
    fetchCatImageUrls,
    intersects,
    isOutOfBounds,
    spawnCat,
    spawnFood,
    tickEntity,
  } from '$lib/game/physics';
  import type { CatEntity, DragState, FoodEntity } from '$lib/game/types';
  import FlyingCat from './FlyingCat.svelte';
  import FlyingFood from './FlyingFood.svelte';
  import NameCatModal from './NameCatModal.svelte';
  import Sparkles from './Sparkles.svelte';

  let fieldEl = $state<HTMLDivElement | null>(null);
  let bounds = $state({ width: 0, height: 0 });

  let availableImages = $state<string[]>([]);
  let cats = $state<CatEntity[]>([]);
  let foods = $state<FoodEntity[]>([]);
  let drag = $state<DragState | null>(null);

  let domesticatedCat = $state<CatEntity | null>(null);
  let submitting = $state(false);
  let submitError = $state<string | null>(null);

  let rafId = 0;
  let lastT = 0;
  let running = $state(false);

  const randomImage = (): string => {
    if (availableImages.length === 0) return '';
    return availableImages[Math.floor(Math.random() * availableImages.length)];
  };

  const respawnCat = () => {
    if (bounds.width === 0) return;
    const img = randomImage();
    if (!img) return;
    cats = [...cats, spawnCat(img, bounds)];
  };

  const respawnFood = () => {
    if (bounds.width === 0) return;
    foods = [...foods, spawnFood(bounds)];
  };

  const loop = (t: number) => {
    if (!running) return;
    const dt = lastT === 0 ? 0 : Math.min(0.05, (t - lastT) / 1000);
    lastT = t;

    cats = cats.map((c) => tickEntity(c, dt, bounds, 'wrap'));
    // remove cats that left the screen, schedule a respawn
    const stillIn = cats.filter((c) => !isOutOfBounds(c, bounds));
    if (stillIn.length !== cats.length) {
      cats = stillIn;
      setTimeout(respawnCat, CAT_RESPAWN_MS);
    }

    foods = foods.map((f) => (drag?.foodId === f.id ? f : tickEntity(f, dt, bounds, 'bounce')));

    rafId = requestAnimationFrame(loop);
  };

  const start = () => {
    if (running) return;
    running = true;
    lastT = 0;
    rafId = requestAnimationFrame(loop);
  };

  const stop = () => {
    running = false;
    cancelAnimationFrame(rafId);
  };

  const measure = () => {
    if (!fieldEl) return;
    const r = fieldEl.getBoundingClientRect();
    bounds = { width: r.width, height: r.height };
  };

  $effect(() => {
    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);

    let cancelled = false;
    (async () => {
      const urls = await fetchCatImageUrls(8);
      if (cancelled) return;
      availableImages = urls;
      measure();
      for (let i = 0; i < CAT_COUNT && i < urls.length; i++) respawnCat();
      for (let i = 0; i < FOOD_COUNT; i++) respawnFood();
      start();
    })();

    return () => {
      cancelled = true;
      stop();
      window.removeEventListener('resize', onResize);
    };
  });

  function handleFoodPointerDown(event: PointerEvent, food: FoodEntity) {
    if (drag) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    drag = {
      foodId: food.id,
      pointerId: event.pointerId,
      offsetX: event.clientX - foodScreenX(food),
      offsetY: event.clientY - foodScreenY(food),
    };
  }

  function foodScreenX(food: FoodEntity) {
    const r = fieldEl?.getBoundingClientRect();
    return (r?.left ?? 0) + food.x;
  }
  function foodScreenY(food: FoodEntity) {
    const r = fieldEl?.getBoundingClientRect();
    return (r?.top ?? 0) + food.y;
  }

  function handlePointerMove(event: PointerEvent) {
    if (!drag || !fieldEl) return;
    if (event.pointerId !== drag.pointerId) return;
    const r = fieldEl.getBoundingClientRect();
    const x = event.clientX - r.left - drag.offsetX;
    const y = event.clientY - r.top - drag.offsetY;
    foods = foods.map((f) => (f.id === drag!.foodId ? { ...f, x, y, vx: 0, vy: 0 } : f));
  }

  function handlePointerUp(event: PointerEvent) {
    if (!drag) return;
    if (event.pointerId !== drag.pointerId) return;
    const droppedFood = foods.find((f) => f.id === drag!.foodId);
    drag = null;
    if (!droppedFood) return;

    // collision test against cats
    const hitCat = cats.find((c) => intersects(droppedFood, c));
    if (hitCat) {
      // award points
      const updatedCat = { ...hitCat, points: hitCat.points + droppedFood.points };
      cats = cats.map((c) => (c.id === hitCat.id ? updatedCat : c));
      foods = foods.filter((f) => f.id !== droppedFood.id);
      setTimeout(respawnFood, FOOD_RESPAWN_MS);

      if (updatedCat.points >= THRESHOLD) {
        stop();
        domesticatedCat = updatedCat;
      }
    } else {
      foods = foods.filter((f) => f.id !== droppedFood.id);
      setTimeout(respawnFood, FOOD_RESPAWN_MS);
    }
  }

  async function submitName(name: string) {
    if (!domesticatedCat) return;
    submitting = true;
    submitError = null;
    try {
      const res = await fetch('/api/cats', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          image_url: domesticatedCat.imageUrl,
          domestication_points: domesticatedCat.points,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        submitError = body.error ?? `Failed (${res.status})`;
        submitting = false;
        return;
      }
      await goto('/');
    } catch (err) {
      submitError = err instanceof Error ? err.message : 'Network error';
      submitting = false;
    }
  }
</script>

<svelte:window onpointermove={handlePointerMove} onpointerup={handlePointerUp} onpointercancel={handlePointerUp} />

<div
  bind:this={fieldEl}
  class="relative h-screen w-screen overflow-hidden select-none"
  style="background: radial-gradient(ellipse at 20% 30%, #2a005a 0%, #08001a 50%), radial-gradient(ellipse at 80% 70%, #001a3a 0%, transparent 60%); touch-action: none;"
>
  <Sparkles count={30} />

  <!-- HUD -->
  <div class="pointer-events-none absolute top-0 right-0 left-0 z-20 flex items-start justify-between p-4">
    <div class="flex flex-col gap-1">
      <span class="font-retro text-xs" style="color:var(--color-lime)">{m.game_status()}</span>
      <span class="font-cursive text-2xl" style="color:var(--color-cyan);text-shadow:0 0 8px var(--color-cyan)">
        {m.game_instruction()}
      </span>
    </div>
    <div
      class="rounded-lg px-3 py-2"
      style="background:rgba(8,0,26,0.7);border:2px solid var(--color-gold);box-shadow:0 0 10px var(--color-gold)"
    >
      <p class="font-retro text-xs" style="color:var(--color-gold)">{m.game_goal_label()}</p>
      <p class="font-chunky text-2xl" style="color:var(--color-gold)">{THRESHOLD} {m.game_pts_unit()}</p>
    </div>
  </div>

  {#each cats as cat (cat.id)}
    <FlyingCat {cat} />
  {/each}

  {#each foods as food (food.id)}
    <FlyingFood {food} isDragging={drag?.foodId === food.id} onPointerDown={handleFoodPointerDown} />
  {/each}

  {#if availableImages.length === 0}
    <div class="absolute inset-0 flex items-center justify-center">
      <p class="font-retro animate-pulse text-sm" style="color:var(--color-cyan)">
        {m.game_summoning()}
      </p>
    </div>
  {/if}
</div>

{#if domesticatedCat}
  <NameCatModal cat={domesticatedCat} {submitting} error={submitError} onSubmit={submitName} />
{/if}
