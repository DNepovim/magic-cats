<script lang="ts">
  import { m } from '$lib/paraglide/messages';
  import { supabase } from '$lib/supabase/client';

  let loading = $state(false);
  let errorMsg = $state<string | null>(null);

  async function signIn() {
    loading = true;
    errorMsg = null;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback?next=/`,
      },
    });
    if (error) {
      errorMsg = error.message;
      loading = false;
    }
    // on success Supabase redirects, no need to reset loading
  }
</script>

<button
  type="button"
  class="btn-magic leading-none disabled:opacity-60"
  disabled={loading}
  onclick={signIn}
>
  <span
    aria-hidden="true"
    class="inline-flex shrink-0 items-center justify-center"
    style="width:28px;height:28px;line-height:0;filter:drop-shadow(0 0 4px var(--color-gold)) drop-shadow(0 0 10px var(--color-magic));"
  >
    <svg viewBox="0 0 24 24" width="24" height="24" fill="var(--color-gold)" style="display:block">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"
      />
      <path
        d="M5.84 14.12A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.45.34-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.77.42 3.44 1.18 4.96l3.66-2.84z"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  </span>
  <span class="leading-none">{loading ? m.login_button_loading() : m.login_button()}</span>
</button>

{#if errorMsg}
  <p class="mt-3 font-retro text-xs" style="color: var(--color-magenta)">
    {errorMsg}
  </p>
{/if}
