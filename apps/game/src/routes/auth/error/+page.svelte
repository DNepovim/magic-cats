<script lang="ts">
  import { m } from '$lib/paraglide/messages';
</script>

<section
  class="relative flex min-h-screen flex-col items-center justify-center px-4 text-center"
  style="background: radial-gradient(ellipse at center, #1a0010 0%, #08001a 60%);"
>
  <h1
    class="title-shimmer"
    style="font-family: var(--font-chunky); font-size: clamp(2.5rem, 7vw, 4rem);"
  >
    {m.auth_error_title()}
  </h1>
  <p class="font-cursive mt-4 text-xl" style="color: var(--color-cyan);">
    {m.auth_error_subtitle()}
  </p>
  <a href="/" class="btn-magic mt-8 text-lg">{m.auth_error_retry()}</a>
</section>
