import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    alias: {
      '@': 'src',
      '@/lib': 'src/lib',
      '@/components': 'src/lib/components',
      '@/game': 'src/lib/game',
      '@/supabase': 'src/lib/supabase',
    },
  },
};

export default config;
