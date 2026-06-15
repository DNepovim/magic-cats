<script lang="ts">
  import type { FoodEntity } from '$lib/game/types';

  const {
    food,
    isDragging,
    onPointerDown,
  }: {
    food: FoodEntity;
    isDragging: boolean;
    onPointerDown: (event: PointerEvent, food: FoodEntity) => void;
  } = $props();

  function handlePointerDown(event: PointerEvent) {
    onPointerDown(event, food);
  }
</script>

<button
  type="button"
  class="absolute flex cursor-grab items-center justify-center rounded-full active:cursor-grabbing"
  style="left:0;top:0;transform:translate({food.x}px,{food.y}px);width:{food.size}px;height:{food.size}px;background:rgba(8,0,26,0.6);border:2px solid {food.color};box-shadow:0 0 10px {food.color},0 0 20px {food.color};font-size:{Math.floor(
    food.size * 0.55,
  )}px;touch-action:none;z-index:{isDragging ? 30 : 10};"
  onpointerdown={handlePointerDown}
  aria-label="Food item worth {food.points} points"
>
  <span class="pointer-events-none select-none" style="line-height:1">{food.label}</span>
</button>
