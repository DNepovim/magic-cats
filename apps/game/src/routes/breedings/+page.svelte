<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { m } from '$lib/paraglide/messages';
  import PageNav from '$lib/components/PageNav.svelte';
  import Sparkles from '$lib/components/Sparkles.svelte';
  import type { BreedingListItem } from './+page.server';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  // Four buckets, in the order you care about them. A breeding you are in and
  // have another request pending on lands in "yours" — the strongest tie wins.
  const invited = $derived(data.breedings.filter((b) => b.invited_cats.length > 0));
  const yours = $derived(data.breedings.filter((b) => b.is_admin));
  const joined = $derived(
    data.breedings.filter((b) => !b.is_admin && b.invited_cats.length === 0 && b.my_cats.length > 0),
  );
  const requested = $derived(
    data.breedings.filter(
      (b) =>
        !b.is_admin &&
        b.invited_cats.length === 0 &&
        b.my_cats.length === 0 &&
        b.pending_cats.length > 0,
    ),
  );
  const rest = $derived(
    data.breedings.filter(
      (b) =>
        !b.is_admin &&
        b.invited_cats.length === 0 &&
        b.my_cats.length === 0 &&
        b.pending_cats.length === 0,
    ),
  );

  const names = (cats: { name: string }[]) => cats.map((cat) => cat.name).join(', ');

  let name = $state('');
  let description = $state('');
  let creating = $state(false);
  let createError = $state<string | null>(null);

  async function createBreeding(event: SubmitEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 1) return;

    creating = true;
    createError = null;
    try {
      const res = await fetch('/api/breedings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, description: description.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? m.breeding_create_failed());
      }
      name = '';
      description = '';
      await invalidateAll();
    } catch (err) {
      createError = err instanceof Error ? err.message : m.breeding_create_failed();
    } finally {
      creating = false;
    }
  }
</script>

<section
  class="relative min-h-screen overflow-hidden px-4 py-10"
  style="background: radial-gradient(ellipse at 10% 10%, #1a003a 0%, #08001a 50%), radial-gradient(ellipse at 90% 90%, #001a3a 0%, transparent 60%);"
>
  <Sparkles count={20} />

  <div class="relative z-10 mx-auto flex max-w-4xl flex-col gap-6">
    <PageNav trail={[{ label: m.nav_breedings() }]} />

    <header>
      <span class="font-retro text-xs" style="color: var(--color-lime);">
        {m.breeding_label()}
      </span>
      <h1
        class="title-shimmer"
        style="font-family: var(--font-chunky); font-size: clamp(2rem, 5vw, 3rem); line-height: 1.1;"
      >
        {m.breeding_list_title()}
      </h1>
    </header>

    <!-- create -->
    <form
      onsubmit={createBreeding}
      class="flex flex-col gap-3 rounded-xl p-4"
      style="background: rgba(8,0,26,0.55); border: 1px dashed var(--color-magic);"
    >
      <p class="font-retro text-xs" style="color: var(--color-cyan);">
        {m.breeding_create_title()}
      </p>
      <input
        type="text"
        bind:value={name}
        maxlength="48"
        required
        placeholder={m.breeding_name_placeholder()}
        class="rounded-lg px-4 py-3 outline-none"
        style="background: rgba(0,0,0,0.5); color: var(--color-silver); font-family: var(--font-pixel); border: 2px solid var(--color-magic);"
      />
      <textarea
        bind:value={description}
        maxlength="500"
        rows="2"
        placeholder={m.breeding_description_placeholder()}
        class="rounded-lg px-4 py-3 outline-none"
        style="background: rgba(0,0,0,0.5); color: var(--color-silver); font-family: var(--font-pixel); border: 2px solid var(--color-magic);"
      ></textarea>
      <button
        type="submit"
        disabled={creating || name.trim().length < 1}
        class="btn-magic text-lg disabled:opacity-60"
      >
        {creating ? m.breeding_creating() : m.breeding_create_cta()}
      </button>
      {#if createError}
        <p class="font-retro text-[0.55rem]" style="color: var(--color-magenta);">{createError}</p>
      {/if}
    </form>

    <!-- list -->
    {#snippet card(breeding: BreedingListItem)}
      <li>
        <a
          href="/breedings/{breeding.id}"
          class="flex items-center justify-between gap-4 rounded-xl p-4 transition-opacity hover:opacity-90"
          style={breeding.is_member
            ? 'background: rgba(26,10,0,0.6); border: 2px solid var(--color-gold); box-shadow: 0 0 12px rgba(255,196,0,0.35);'
            : 'background: rgba(8,0,26,0.6); border: 2px solid var(--color-magic); box-shadow: 0 0 8px rgba(155,0,255,0.4);'}
        >
          <div class="min-w-0">
            <p
              class="truncate font-bold"
              style="font-family: var(--font-display); color: var(--color-gold); font-size: 1.2rem;"
            >
              {breeding.name}
            </p>

            {#if breeding.description}
              <p
                class="font-cursive truncate text-sm"
                style="color: var(--color-silver); opacity: 0.8;"
              >
                {breeding.description}
              </p>
            {/if}

            {#if breeding.my_cats.length > 0}
              <p class="font-retro mt-2 text-[0.55rem]" style="color: var(--color-lime);">
                {m.breeding_your_cats_here({ names: names(breeding.my_cats) })}
              </p>
            {/if}
            {#if breeding.invited_cats.length > 0}
              <p class="font-retro mt-2 text-[0.55rem]" style="color: var(--color-gold);">
                {m.breeding_invited_here({ names: names(breeding.invited_cats) })}
              </p>
            {/if}
            {#if breeding.pending_cats.length > 0}
              <p class="font-retro mt-1 text-[0.55rem]" style="color: var(--color-cyan);">
                {m.breeding_your_requests_here({ names: names(breeding.pending_cats) })}
              </p>
            {/if}
          </div>

          <span class="font-retro shrink-0 text-xs" style="color: var(--color-cyan);">
            {m.breeding_cat_count({ count: breeding.cat_count })}
          </span>
        </a>
      </li>
    {/snippet}

    {#snippet section(title: string, items: BreedingListItem[])}
      {#if items.length > 0}
        <div>
          <h2
            class="mb-3"
            style="font-family: var(--font-display); color: var(--color-gold); font-size: 1.1rem; text-shadow: 0 0 8px var(--color-gold);"
          >
            {title} ({items.length})
          </h2>
          <ul class="flex flex-col gap-3">
            {#each items as breeding (breeding.id)}
              {@render card(breeding)}
            {/each}
          </ul>
        </div>
      {/if}
    {/snippet}

    {#if data.breedings.length === 0}
      <p class="font-cursive text-lg" style="color: var(--color-silver); opacity: 0.7;">
        {m.breeding_empty()}
      </p>
    {:else}
      {@render section(m.breeding_section_invited(), invited)}
      {@render section(m.breeding_section_yours(), yours)}
      {@render section(m.breeding_section_joined(), joined)}
      {@render section(m.breeding_section_requested(), requested)}
      {@render section(m.breeding_section_rest(), rest)}
    {/if}

  </div>
</section>
