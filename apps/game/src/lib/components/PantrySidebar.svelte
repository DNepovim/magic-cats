<script lang="ts">
  import { CURE_SATIETY, formatCountdown, isNight, simulate } from '$lib/game/care';
  import { ITEMS, type Item } from '$lib/game/items';
  import { m } from '$lib/paraglide/messages';
  import type { CatRow } from '$lib/supabase/types';

  const {
    stock,
    cat,
    busy = false,
    supplyReadyAt = null,
    onUse,
  }: {
    /** item id → how many you have. */
    stock: Record<string, number>;
    /** The cat the medicine hints are about. */
    cat: CatRow | null;
    busy?: boolean;
    /** When the next supply run may start, or null if one may start now. */
    supplyReadyAt?: string | null;
    onUse: (itemId: string) => void;
  } = $props();

  // A countdown has to tick, so the clock is state rather than a render-time read.
  let now = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(id);
  });

  const runReadyIn = $derived(supplyReadyAt ? Math.max(0, Date.parse(supplyReadyAt) - now) : 0);
  const asleep = $derived(isNight(now));

  const condition = $derived(cat ? simulate(cat) : null);

  const owned = $derived(ITEMS.filter((item) => (stock[item.id] ?? 0) > 0));
  const meals = $derived(owned.filter((item) => item.kind === 'meal'));
  const dainties = $derived(owned.filter((item) => item.kind === 'dainty'));
  const medicines = $derived(owned.filter((item) => item.kind === 'medicine'));

  /** How the pile looks: past this many the stack just reads as "a lot". */
  const MAX_LAYERS = 8;
  const LAYER_OFFSET = 7;

  const layers = (itemId: string) => Math.min(stock[itemId] ?? 0, MAX_LAYERS);

  /** Medicine is wasted unless she has this illness and enough in her stomach. */
  const medicineReady = (item: Item) =>
    condition !== null &&
    condition.illness !== null &&
    item.cures === condition.illness &&
    condition.satiety >= CURE_SATIETY;

  const borderFor = (item: Item) =>
    item.kind === 'medicine'
      ? medicineReady(item)
        ? 'var(--color-cyan)'
        : 'var(--color-magic)'
      : item.kind === 'dainty'
        ? 'var(--color-gold)'
        : 'var(--color-lime)';

  const itemName = (item: Item) =>
    ({
      kibble: m.item_kibble(),
      pate: m.item_pate(),
      sardine: m.item_sardine(),
      roast: m.item_roast(),
      cream: m.item_cream(),
      catnip_cookie: m.item_catnip_cookie(),
      nose_syrup: m.item_nose_syrup(),
      ear_drops: m.item_ear_drops(),
      fur_paste: m.item_fur_paste(),
    })[item.id] ?? item.id;

  const startDrag = (event: DragEvent, itemId: string) => {
    event.dataTransfer?.setData('text/plain', itemId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  };
</script>

{#snippet shelf(title: string, items: Item[])}
  {#if items.length > 0}
    <div class="flex flex-col gap-2">
      <p class="font-retro text-[0.55rem]" style="color: var(--color-silver); opacity: 0.7;">
        {title}
      </p>
      <ul class="flex flex-wrap items-end gap-3">
        {#each items as item (item.id)}
          <li
            class="relative w-11"
            style="height: {40 + (layers(item.id) - 1) * LAYER_OFFSET}px;"
          >
            <!-- The pile underneath is scenery; only the top one is real. -->
            {#each Array(layers(item.id) - 1) as _, depth (depth)}
              <span
                class="absolute grid h-10 w-11 place-items-center rounded-md text-lg"
                style="bottom: {depth * LAYER_OFFSET}px; left: {depth % 2 === 0
                  ? 0
                  : 2}px; background: rgba(255,255,255,0.05); border: 1px solid {borderFor(
                  item,
                )}; opacity: {0.35 + depth * 0.05};"
                aria-hidden="true"
              >
                {item.emoji}
              </span>
            {/each}

            <button
              type="button"
              draggable="true"
              ondragstart={(event) => startDrag(event, item.id)}
              onclick={() => onUse(item.id)}
              disabled={busy || (asleep && item.kind !== 'medicine')}
              title={itemName(item)}
              aria-label={itemName(item)}
              class="absolute grid h-10 w-11 cursor-grab place-items-center rounded-md text-lg active:cursor-grabbing disabled:opacity-40"
              style="bottom: {(layers(item.id) - 1) * LAYER_OFFSET}px; background: rgba(8,0,26,0.9); border: 1px solid {borderFor(
                item,
              )};"
            >
              {item.emoji}
              {#if medicineReady(item)}
                <span
                  class="absolute -top-1 -right-1 text-[0.6rem]"
                  style="color: var(--color-cyan);">✓</span
                >
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
{/snippet}

<div
  class="flex flex-col gap-3 rounded-xl p-4"
  style="background: rgba(8,0,26,0.55); border: 1px dashed var(--color-magic);"
>
  <div class="flex items-center justify-between gap-2">
    <p class="font-retro text-xs" style="color: var(--color-cyan);">{m.supply_pantry()}</p>
    {#if runReadyIn > 0}
      <!-- Still restocking: say when, and do not offer a trip that the start
           endpoint would only refuse. -->
      <span
        class="font-retro rounded-md px-3 py-2 text-[0.55rem] opacity-50"
        style="color: var(--color-silver); border: 1px solid var(--color-magic);"
        title={m.supply_restocking()}
      >
        🧺 {formatCountdown(runReadyIn)}
      </span>
    {:else}
      <a
        href="/supply"
        class="font-retro rounded-md px-3 py-2 text-[0.55rem]"
        style="color: var(--color-cyan); background: rgba(255,255,255,0.04); border: 1px solid var(--color-cyan);"
      >
        {m.supply_link()}
      </a>
    {/if}
  </div>

  {#if asleep}
    <p class="font-cursive text-base" style="color: var(--color-cyan);">😴 {m.sleep_no_food()}</p>
  {/if}

  {#if owned.length === 0}
    <p class="font-cursive text-base" style="color: var(--color-silver); opacity: 0.7;">
      {m.care_no_food()}
    </p>
  {:else}
    {@render shelf(m.pantry_meals(), meals)}
    {@render shelf(m.pantry_dainties(), dainties)}
    {@render shelf(m.pantry_medicines(), medicines)}
  {/if}
</div>
