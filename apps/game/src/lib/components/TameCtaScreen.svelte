<script lang="ts">
  import Sparkles from './Sparkles.svelte';
</script>

<section
  class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center"
  style="background: radial-gradient(ellipse at 70% 30%, #1a003a 0%, #08001a 50%), radial-gradient(ellipse at 30% 80%, #003020 0%, transparent 60%);"
>
  <Sparkles />

  <div class="relative z-10 flex flex-col items-center gap-8">
    <span class="badge-hot">🔥 THE WILD IS WAITING</span>

    <div class="relative">
      <div class="starburst" style="width:340px;height:340px;top:50%;left:50%;transform:translate(-50%,-50%);"></div>
      <span class="wobble relative text-9xl">😼</span>
    </div>

    <h1
      class="title-shimmer leading-tight"
      style="font-family: var(--font-chunky); font-size: clamp(3rem, 9vw, 6rem);"
    >
      Tame your cat
    </h1>

    <p
      class="font-cursive max-w-lg text-xl sm:text-2xl"
      style="color: var(--color-cyan); text-shadow: 0 0 12px var(--color-cyan);"
    >
      Catch the flying food. Drop it on a cat. The right offerings will earn her trust
      forever.
    </p>

    <a href="/tame" class="btn-magic zoom-pulse text-2xl">⚔️ TAME THE CAT ⚔️</a>

    <p class="font-retro text-xs blink" style="color: var(--color-lime)">
      ▶▶ Click to begin ◀◀
    </p>
  </div>
</section>
