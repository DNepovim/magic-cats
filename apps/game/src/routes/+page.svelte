<script lang="ts">
  import Dashboard from '$lib/components/Dashboard.svelte';
  import LoginScreen from '$lib/components/LoginScreen.svelte';
  import TameCtaScreen from '$lib/components/TameCtaScreen.svelte';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();
</script>

{#if data.state === 'login'}
  <LoginScreen />
{:else if data.state === 'tame-cta'}
  <TameCtaScreen />
{:else if data.state === 'dashboard'}
  <Dashboard
    myCat={data.myCat}
    otherCats={data.otherCats}
    userEmail={data.user?.email ?? null}
  />
{/if}
