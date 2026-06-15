<script lang="ts">
  import { browser } from '$app/environment';
  import { inject } from '@vercel/analytics';
  import '../app.css';

  const { children } = $props();

  if (browser) inject();
</script>

{@render children()}
