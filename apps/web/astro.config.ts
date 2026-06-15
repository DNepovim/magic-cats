// @ts-check
import { resolve } from 'path'
import sitemap from '@astrojs/sitemap'
import vercel from '@astrojs/vercel'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import { loadEnv } from 'vite'

import { envConfig } from './env.config.ts'

const { SITE_URL } = loadEnv('', process.cwd(), '')

export default defineConfig({
  env: envConfig,
  site: SITE_URL ?? 'http://localhost:4321',
  integrations: [
    sitemap({
      lastmod: new Date(),
    }),
  ],

  vite: {
    // @ts-expect-error vite versions incompatibility
    plugins: [...tailwindcss()],
    resolve: {
      alias: {
        '@': resolve('./src'),
      },
    },
  },

  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },

  i18n: {
    defaultLocale: 'hu',
    locales: ['hu', 'en', 'cs', 'sk'],
    routing: {
      prefixDefaultLocale: false,
    },
  },

  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
})
