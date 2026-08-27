<script lang="ts">
  import { ITEMS, type Item } from '$lib/game/items';
  import { m } from '$lib/paraglide/messages';

  type Shelf = Record<string, number>;

  const {
    breedings,
    breedingId,
    players = [],
    myStock,
    shelves,
    busy = false,
    onMove,
    onGift,
    onClose,
  }: {
    /** Breedings whose shelf you may use. One on a breeding page, possibly
     *  several when opened from the dashboard. */
    breedings: { id: string; name: string }[];
    breedingId: string;
    /** Other players you can give to, each addressed by one of their cats. */
    players?: { catId: string; catName: string }[];
    myStock: Shelf;
    /** breeding id → what is on that shelf. */
    shelves: Record<string, Shelf>;
    busy?: boolean;
    onMove: (breedingId: string, itemId: string, action: 'donate' | 'take') => void;
    onGift?: (toCatId: string, itemId: string) => void;
    onClose: () => void;
  } = $props();

  // The destination: a breeding's shelf, or `player:<catId>` for a gift.
  // Follows the prop when the modal is opened for a different breeding.
  let chosen = $state<string | null>(null);
  const active = $derived(chosen ?? breedingId);
  const givingToPlayer = $derived(active.startsWith('player:'));
  const recipientCatId = $derived(active.replace('player:', ''));
  const recipientName = $derived(
    players.find((player) => player.catId === recipientCatId)?.catName ?? '',
  );
  let overSide = $state<'mine' | 'shared' | null>(null);

  const shelf = $derived(givingToPlayer ? {} : (shelves[active] ?? {}));
  const mine = $derived(ITEMS.filter((item) => (myStock[item.id] ?? 0) > 0));
  const shared = $derived(ITEMS.filter((item) => (shelf[item.id] ?? 0) > 0));

  /** Past this many the pile just reads as "a lot". */
  const MAX_LAYERS = 5;
  const LAYER_OFFSET = 7;
  const layers = (count: number) => Math.min(count, MAX_LAYERS);

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
  };

  const startDrag = (event: DragEvent, itemId: string, from: 'mine' | 'shared') => {
    event.dataTransfer?.setData('text/plain', `${from}:${itemId}`);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  };

  /** Dropping on the far side is the move; dropping back where it came from is
   *  a change of mind, not a transaction. */
  const handleDrop = (event: DragEvent, side: 'mine' | 'shared') => {
    event.preventDefault();
    overSide = null;
    const payload = event.dataTransfer?.getData('text/plain') ?? '';
    const [from, itemId] = payload.split(':');
    if (!itemId || from === side) return;

    // A player's pantry is not yours to reach into — only to add to.
    if (givingToPlayer) {
      if (side === 'shared') onGift?.(recipientCatId, itemId);
      return;
    }

    onMove(active, itemId, side === 'shared' ? 'donate' : 'take');
  };

  const borderFor = (item: Item) =>
    item.kind === 'medicine'
      ? 'var(--color-cyan)'
      : item.kind === 'dainty'
        ? 'var(--color-gold)'
        : 'var(--color-lime)';
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet pile(item: Item, count: number, side: 'mine' | 'shared')}
  <li class="relative w-11" style="height: {40 + (layers(count) - 1) * LAYER_OFFSET}px;">
    {#each Array(layers(count) - 1) as _, depth (depth)}
      <span
        class="absolute grid h-10 w-11 place-items-center rounded-md text-lg"
        style="bottom: {depth * LAYER_OFFSET}px; left: {depth % 2 === 0
          ? 0
          : 2}px; background: rgba(255,255,255,0.05); border: 1px solid {borderFor(
          item,
        )}; opacity: {0.35 + depth * 0.06};"
        aria-hidden="true"
      >
        {item.emoji}
      </span>
    {/each}

    <!-- Dragging is the gesture; clicking sends it across for touch and keyboard. -->
    <button
      type="button"
      draggable="true"
      ondragstart={(event) => startDrag(event, item.id, side)}
      onclick={() =>
        givingToPlayer
          ? side === 'mine' && onGift?.(recipientCatId, item.id)
          : onMove(active, item.id, side === 'mine' ? 'donate' : 'take')}
      disabled={busy}
      title={side === 'mine' ? m.shelf_give() : m.shelf_take()}
      class="absolute grid h-10 w-11 cursor-grab place-items-center rounded-md text-lg active:cursor-grabbing disabled:opacity-40"
      style="bottom: {(layers(count) - 1) * LAYER_OFFSET}px; background: rgba(8,0,26,0.9); border: 1px solid {borderFor(
        item,
      )};"
    >
      {item.emoji}
      {#if count > 1}
        <span
          class="font-retro absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.5rem]"
          style="background: var(--color-void); border: 1px solid var(--color-silver); color: var(--color-silver);"
          aria-hidden="true"
        >
          {count}
        </span>
      {/if}
    </button>
  </li>
{/snippet}

{#snippet column(
  title: string,
  side: 'mine' | 'shared',
  items: Item[],
  counts: Shelf,
  empty: string,
)}
  <div
    class="flex min-h-56 flex-1 flex-col gap-3 rounded-xl p-4 transition-transform"
    class:scale-[1.02]={overSide === side}
    style="background: rgba(8,0,26,0.6); border: 2px dashed {overSide === side
      ? 'var(--color-lime)'
      : 'var(--color-magic)'};"
    role="region"
    aria-label={title}
    ondragover={(event) => {
      event.preventDefault();
      overSide = side;
    }}
    ondragleave={() => (overSide = null)}
    ondrop={(event) => handleDrop(event, side)}
  >
    <p class="font-retro text-xs" style="color: var(--color-cyan);">{title}</p>

    {#if items.length === 0}
      <p class="font-cursive text-base" style="color: var(--color-silver); opacity: 0.6;">
        {empty}
      </p>
    {:else}
      <ul class="flex flex-wrap items-end gap-3">
        {#each items as item (item.id)}
          {@render pile(item, counts[item.id] ?? 0, side)}
        {/each}
      </ul>
    {/if}
  </div>
{/snippet}

<div
  class="fixed inset-0 z-50 flex items-center justify-center p-4"
  style="background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);"
  role="dialog"
  aria-modal="true"
  aria-labelledby="shelf-exchange-title"
>
  <!-- The backdrop is a button so clicking outside closes without tripping
       the a11y rules that a click-handling <div> would. -->
  <button
    type="button"
    class="absolute inset-0 cursor-default"
    aria-label={m.modal_close()}
    onclick={onClose}
  ></button>

  <div
    class="relative z-10 flex w-full max-w-3xl flex-col gap-4 rounded-2xl p-6"
    style="background: linear-gradient(145deg,#0a001f,#1a003a,#00101a); border: 2px solid var(--color-magic); box-shadow: 0 0 24px rgba(155,0,255,0.5);"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2
        id="shelf-exchange-title"
        style="font-family: var(--font-display); color: var(--color-gold); font-size: 1.4rem; text-shadow: 0 0 10px var(--color-gold);"
      >
        {m.shelf_exchange_title()}
      </h2>

      <div class="flex items-center gap-2">
        {#if breedings.length + players.length > 1}
          <select
            value={active}
            onchange={(event) => (chosen = event.currentTarget.value)}
            class="rounded-lg px-3 py-2 outline-none"
            style="background: rgba(0,0,0,0.5); color: var(--color-silver); font-family: var(--font-pixel); font-size: 0.8rem; border: 2px solid var(--color-magic);"
          >
            {#if breedings.length > 0}
              <optgroup label={m.shelf_group_breedings()}>
                {#each breedings as option (option.id)}
                  <option value={option.id}>{option.name}</option>
                {/each}
              </optgroup>
            {/if}
            {#if players.length > 0}
              <optgroup label={m.shelf_group_players()}>
                {#each players as player (player.catId)}
                  <option value={`player:${player.catId}`}>
                    {m.shelf_player_option({ cat: player.catName })}
                  </option>
                {/each}
              </optgroup>
            {/if}
          </select>
        {/if}

        <button
          type="button"
          onclick={onClose}
          aria-label={m.modal_close()}
          class="font-retro rounded-md px-3 py-2 text-[0.7rem]"
          style="color: var(--color-silver); background: rgba(255,255,255,0.06); border: 1px solid var(--color-magic);"
        >
          ✕
        </button>
      </div>
    </div>

    <p class="font-retro text-[0.55rem]" style="color: var(--color-silver); opacity: 0.7;">
      {givingToPlayer ? m.shelf_gift_hint() : m.shelf_exchange_hint()}
    </p>

    <div class="flex flex-col gap-3 sm:flex-row">
      {@render column(m.shelf_mine(), 'mine', mine, myStock, m.shelf_mine_empty())}
      {#if givingToPlayer}
        {@render column(
          m.shelf_player_side({ cat: recipientName }),
          'shared',
          [],
          {},
          m.shelf_player_empty({ cat: recipientName }),
        )}
      {:else}
        {@render column(m.shelf_shared(), 'shared', shared, shelf, m.shelf_empty())}
      {/if}
    </div>
  </div>
</div>
