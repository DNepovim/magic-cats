<script lang="ts">
  import { m } from '$lib/paraglide/messages';
  import GoogleLoginButton from './GoogleLoginButton.svelte';
  import Sparkles from './Sparkles.svelte';
</script>

<section
  class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center"
  style="background: radial-gradient(ellipse at 20% 30%, #2a005a 0%, #08001a 40%), radial-gradient(ellipse at 80% 70%, #001a3a 0%, transparent 60%);"
>
  <Sparkles />

  <div class="relative z-10 flex flex-col items-center gap-6">
    <span class="badge-new">{m.login_badge()}</span>

    <div class="relative">
      <div class="starburst" style="width:300px;height:300px;top:50%;left:50%;transform:translate(-50%,-50%);"></div>
      <span class="float-anim relative text-9xl">🐱</span>
    </div>

    <h1
      class="title-shimmer leading-tight"
      style="font-family: var(--font-chunky); font-size: clamp(2.5rem, 8vw, 5rem);"
    >
      {m.site_title()}
    </h1>

    <p
      class="font-cursive max-w-md text-xl sm:text-2xl"
      style="color: var(--color-cyan); text-shadow: 0 0 12px var(--color-cyan);"
    >
      {m.login_subtitle()}
    </p>

    <GoogleLoginButton />

    <p class="font-retro mt-3 text-xs" style="color: var(--color-silver); opacity:0.6">
      {m.login_perks()}
    </p>
  </div>
</section>
