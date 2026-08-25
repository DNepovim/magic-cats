<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import CatCard from '$lib/components/CatCard.svelte';
  import PageNav from '$lib/components/PageNav.svelte';
  import Sparkles from '$lib/components/Sparkles.svelte';
  import { m } from '$lib/paraglide/messages';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  let busy = $state(false);
  let actionError = $state<string | null>(null);
  let selectedCatId = $state('');
  let message = $state('');

  async function send(url: string, init: RequestInit, fallback: string) {
    busy = true;
    actionError = null;
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? fallback);
      }
      await invalidateAll();
      return true;
    } catch (err) {
      actionError = err instanceof Error ? err.message : fallback;
      return false;
    } finally {
      busy = false;
    }
  }

  const json = (payload: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  async function apply(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedCatId) return;
    const ok = await send(
      `/api/breedings/${data.breeding.id}/requests`,
      json({ cat_id: selectedCatId }),
      m.breeding_request_failed(),
    );
    if (ok) selectedCatId = '';
  }

  // The admin never asks permission to join their own breeding — the cat goes
  // straight onto the roster.
  async function addOwnCat(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedCatId) return;
    const ok = await send(
      `/api/breedings/${data.breeding.id}/cats`,
      json({ cat_id: selectedCatId }),
      m.breeding_add_failed(),
    );
    if (ok) selectedCatId = '';
  }

  const decide = (requestId: string, action: 'accept' | 'reject') =>
    send(
      `/api/breedings/${data.breeding.id}/requests/${requestId}`,
      json({ action }),
      m.breeding_decide_failed(),
    );

  const removeCat = (catId: string) =>
    send(
      `/api/breedings/${data.breeding.id}/cats/${catId}`,
      { method: 'DELETE' },
      m.breeding_remove_failed(),
    );

  async function post(event: SubmitEvent) {
    event.preventDefault();
    const body = message.trim();
    if (!body) return;
    const ok = await send(
      `/api/breedings/${data.breeding.id}/posts`,
      json({ body }),
      m.breeding_post_failed(),
    );
    if (ok) message = '';
  }

  const formatWhen = (iso: string) => new Date(iso).toLocaleString();
</script>

<section
  class="relative min-h-screen overflow-hidden px-4 py-10"
  style="background: radial-gradient(ellipse at 10% 10%, #1a003a 0%, #08001a 50%), radial-gradient(ellipse at 90% 90%, #001a3a 0%, transparent 60%);"
>
  <Sparkles count={20} />

  <div class="relative z-10 mx-auto flex max-w-5xl flex-col gap-6">
    <PageNav
      trail={[{ label: m.nav_breedings(), href: '/breedings' }, { label: data.breeding.name }]}
    />

    <header class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <span class="font-retro flex items-center gap-2 text-xs" style="color: var(--color-lime);">
          {m.breeding_label()}
          {#if data.isAdmin}
            <span
              class="rounded px-2 py-1 text-[0.5rem]"
              style="color: var(--color-void); background: var(--color-gold);"
            >
              {m.breeding_badge_admin()}
            </span>
          {:else if data.isMember}
            <span
              class="rounded px-2 py-1 text-[0.5rem]"
              style="color: var(--color-lime); border: 1px solid var(--color-lime);"
            >
              {m.breeding_badge_member()}
            </span>
          {/if}
        </span>
        <h1
          class="title-shimmer"
          style="font-family: var(--font-chunky); font-size: clamp(1.8rem, 5vw, 2.8rem); line-height: 1.1;"
        >
          {data.breeding.name}
        </h1>
        {#if data.breeding.description}
          <p class="font-cursive text-lg" style="color: var(--color-cyan);">
            {data.breeding.description}
          </p>
        {/if}
      </div>
    </header>

    {#if actionError}
      <p class="font-retro text-xs" style="color: var(--color-magenta);">{actionError}</p>
    {/if}

    <div class="flex flex-col gap-6 lg:flex-row lg:items-start">
      <!-- roster -->
      <div class="flex-1">
        <h2
          class="mb-3"
          style="font-family: var(--font-display); color: var(--color-gold); font-size: 1.4rem; text-shadow: 0 0 10px var(--color-gold);"
        >
          {m.breeding_roster()} ({data.cats.length})
        </h2>

        {#if data.cats.length === 0}
          <p class="font-cursive text-sm" style="color: var(--color-silver); opacity: 0.7;">
            {m.breeding_roster_empty()}
          </p>
        {:else}
          <ul class="flex flex-col gap-3">
            {#each data.cats as cat (cat.id)}
              <li
                class="rounded-xl"
                style={data.isAdmin || cat.owner_user_id === data.myUserId
                  ? 'outline:1px solid var(--color-gold);outline-offset:2px;'
                  : ''}
              >
                <CatCard {cat} />
                {#if data.isAdmin || cat.owner_user_id === data.myUserId}
                  <div
                    class="rounded-b-xl px-3 pt-2 pb-3"
                    style="background: rgba(8,0,26,0.6); border: 2px solid var(--color-magic); border-top: 0;"
                  >
                    <button
                      type="button"
                      onclick={() => removeCat(cat.id)}
                      disabled={busy}
                      class="font-retro w-full rounded-md px-3 py-2 text-[0.6rem] disabled:opacity-50"
                      style="color: var(--color-magenta); background: rgba(255,255,255,0.04); border: 1px solid var(--color-magenta);"
                    >
                      {cat.owner_user_id === data.myUserId
                        ? m.breeding_leave({ name: cat.name })
                        : m.breeding_kick({ name: cat.name })}
                    </button>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <!-- side: apply + pending requests -->
      <aside class="w-full lg:w-96">
        <div
          class="mb-6 rounded-xl p-4"
          style="background: rgba(8,0,26,0.55); border: 1px dashed var(--color-magic);"
        >
          <p class="font-retro mb-2 text-xs" style="color: var(--color-cyan);">
            {data.isAdmin ? m.breeding_add_title() : m.breeding_apply_title()}
          </p>

          {#if data.myPendingCats.length > 0}
            <p class="font-retro mb-2 text-[0.55rem]" style="color: var(--color-gold);">
              {m.breeding_apply_pending()}
            </p>
            <ul class="mb-3 flex flex-col gap-1">
              {#each data.myPendingCats as pending (pending.cat_id)}
                <li
                  class="font-cursive rounded-md px-3 py-2 text-base"
                  style="color: var(--color-silver); background: rgba(255,255,255,0.04); border: 1px solid var(--color-gold);"
                >
                  ⏳ {m.breeding_pending_cat({ name: pending.name })}
                </li>
              {/each}
            </ul>
          {/if}

          {#if data.availableCats.length > 0}
            <form onsubmit={data.isAdmin ? addOwnCat : apply} class="flex flex-col gap-2">
              <select
                bind:value={selectedCatId}
                required
                class="rounded-lg px-3 py-2 outline-none"
                style="background: rgba(0,0,0,0.5); color: var(--color-silver); font-family: var(--font-pixel); border: 2px solid var(--color-magic);"
              >
                <option value="" disabled>{m.breeding_apply_choose()}</option>
                {#each data.availableCats as cat (cat.id)}
                  <option value={cat.id}>{cat.name}</option>
                {/each}
              </select>
              <button
                type="submit"
                disabled={busy || !selectedCatId}
                class="btn-magic text-base disabled:opacity-60"
              >
                {#if data.isAdmin}
                  {m.breeding_add_cta()}
                {:else if data.myPendingCats.length > 0}
                  {m.breeding_apply_another()}
                {:else}
                  {m.breeding_apply_cta()}
                {/if}
              </button>
            </form>
          {:else if data.myPendingCats.length === 0}
            <p class="font-cursive text-sm" style="color: var(--color-silver); opacity: 0.7;">
              {m.breeding_apply_no_cats()}
            </p>
          {/if}
        </div>

        {#if data.isAdmin}
          <h2
            class="mb-3"
            style="font-family: var(--font-display); color: var(--color-gold); font-size: 1.2rem;"
          >
            {m.breeding_requests_title()} ({data.pendingRequests.length})
          </h2>

          {#if data.pendingRequests.length === 0}
            <p class="font-cursive text-sm" style="color: var(--color-silver); opacity: 0.7;">
              {m.breeding_requests_empty()}
            </p>
          {:else}
            <ul class="flex flex-col gap-3">
              {#each data.pendingRequests as request (request.id)}
                <li
                  class="flex flex-col gap-2 rounded-xl p-3"
                  style="background: rgba(8,0,26,0.6); border: 2px solid var(--color-gold);"
                >
                  <p class="font-retro text-xs" style="color: var(--color-gold);">
                    {request.cat?.name ?? m.breeding_unknown_cat()}
                  </p>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      onclick={() => decide(request.id, 'accept')}
                      disabled={busy}
                      class="font-retro flex-1 rounded-md px-2 py-2 text-[0.55rem] disabled:opacity-50"
                      style="color: var(--color-void); background: var(--color-lime); border: 1px solid var(--color-lime);"
                    >
                      {m.breeding_accept()}
                    </button>
                    <button
                      type="button"
                      onclick={() => decide(request.id, 'reject')}
                      disabled={busy}
                      class="font-retro flex-1 rounded-md px-2 py-2 text-[0.55rem] disabled:opacity-50"
                      style="color: var(--color-silver); background: rgba(255,255,255,0.06); border: 1px solid var(--color-magenta);"
                    >
                      {m.breeding_reject()}
                    </button>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </aside>
    </div>

    <!-- forum -->
    <div class="mt-2">
      <h2
        class="mb-3"
        style="font-family: var(--font-display); color: var(--color-gold); font-size: 1.4rem; text-shadow: 0 0 10px var(--color-gold);"
      >
        {m.breeding_forum()}
      </h2>

      {#if !data.isMember}
        <p class="font-cursive text-sm" style="color: var(--color-silver); opacity: 0.7;">
          {m.breeding_forum_members_only()}
        </p>
      {:else}
        {#if data.posts.length === 0}
          <p class="font-cursive mb-3 text-sm" style="color: var(--color-silver); opacity: 0.7;">
            {m.breeding_forum_empty()}
          </p>
        {:else}
          <ul class="mb-4 flex flex-col gap-2">
            {#each data.posts as post (post.id)}
              <li
                class="rounded-xl p-3"
                style="background: rgba(8,0,26,0.6); border: 1px solid var(--color-magic);"
              >
                <p class="font-retro mb-1 text-[0.55rem]" style="color: var(--color-cyan);">
                  {post.author_user_id === data.myUserId
                    ? m.breeding_forum_you()
                    : m.breeding_forum_member()} · {formatWhen(post.created_at)}
                </p>
                <p class="font-cursive text-lg break-words" style="color: var(--color-silver);">
                  {post.body}
                </p>
              </li>
            {/each}
          </ul>
        {/if}

        <form onsubmit={post} class="flex flex-col gap-2">
          <textarea
            bind:value={message}
            maxlength="2000"
            rows="3"
            required
            placeholder={m.breeding_forum_placeholder()}
            class="rounded-lg px-4 py-3 outline-none"
            style="background: rgba(0,0,0,0.5); color: var(--color-silver); font-family: var(--font-pixel); border: 2px solid var(--color-magic);"
          ></textarea>
          <button
            type="submit"
            disabled={busy || message.trim().length < 1}
            class="btn-magic self-start px-6 text-base disabled:opacity-60"
          >
            {m.breeding_forum_send()}
          </button>
        </form>
      {/if}
    </div>
  </div>
</section>
