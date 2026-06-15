<script lang="ts">
  const { count = 40 }: { count?: number } = $props();
  const colors = [
    'var(--color-gold)',
    'var(--color-cyan)',
    'var(--color-magenta)',
    'var(--color-lime)',
    'var(--color-electric)',
  ];
  const sparkles = $derived(
    Array.from({ length: count }, (_, i) => ({
      top: `${(i * 7 + 3) % 95}%`,
      left: `${(i * 13 + 5) % 97}%`,
      delay: `${(i * 0.23) % 3}s`,
      size: `${6 + (i % 5) * 2}px`,
      color: colors[i % colors.length],
    })),
  );
</script>

{#each sparkles as s, i (i)}
  <span
    class="sparkle pointer-events-none"
    style="top:{s.top}; left:{s.left}; animation-delay:{s.delay}; width:{s.size}; height:{s.size}; background:{s.color};"
  ></span>
{/each}
