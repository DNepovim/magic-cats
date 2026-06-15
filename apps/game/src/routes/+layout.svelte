<script lang="ts">
  import { browser } from '$app/environment';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import { inject } from '@vercel/analytics';
  import '../app.css';
  import type { LayoutData } from './$types';

  const { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();

  if (browser) inject();
</script>

<div class="fixed top-3 right-3 z-50">
  <LanguageSwitcher current={data.locale} />
</div>

{@render children()}
