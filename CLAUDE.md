# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

pnpm + Turborepo monorepo (`packages: apps/*`), two independently deployed Vercel apps:

- **`apps/web`** — Astro 5 marketing/event site. Locale-prefixed routes (`/`, `/en/`, `/cs/`, `/sk/`).
- **`apps/game`** — SvelteKit 2 + Svelte 5 "tame the cat" game backed by Supabase (Postgres + Google OAuth). Deployed at `meow.magic-cats.fyi`.

The root `README.md` is stale — it still describes the Astro event-website starter this repo was forked from, not Magic Cats. `apps/game/README.md` is current and detailed; read it before touching anything Supabase-related.

## Commands

Root scripts fan out through Turbo (`pnpm dev`, `pnpm build`, `pnpm check`, …). Target one app with `pnpm -F game <script>` / `pnpm -F web <script>`.

```bash
pnpm -F web dev            # Astro on :4321
pnpm -F game dev           # SvelteKit on :5173 (runs paraglide compile first)
pnpm -F game check         # paraglide + svelte-kit sync + svelte-check — currently the only check that passes
```

There are **no tests** in this repo — no test runner, no test files. Don't invent a test command; verify changes by running the app.

### Known-broken tooling (pre-existing, verified 2026-08-05)

Don't assume you broke these:

- `lint:check` / `lint:fix` fail in **both** apps: the shared root `eslint.config.js` imports `@eslint/js`, `typescript-eslint`, etc., which are installed only under `apps/web/node_modules`, so resolving them from the root config throws `ERR_MODULE_NOT_FOUND`.
- `pnpm -F game format:check` fails: the root `prettier.config.js` declares `prettier-plugin-astro`, which isn't a dependency of `apps/game`. That config also lacks `prettier-plugin-svelte` (present in the game's devDeps but never loaded), and its `semi: false` contradicts the game's actual semicolon style — running `format:write` there would rewrite the whole app.
- `pnpm -F web typecheck` fails with pre-existing `TS2339: Property 'data' does not exist on type 'never'` in `src/utils/schema.ts`.

ESLint's `globalIgnores` includes `**/*.svelte`, so Svelte components are never linted even when ESLint works.

## Code style

From `.cursorrules` and `AGENTS.md` — note `.cursorrules` predates the monorepo and still says "yarn" and "Astro only"; the rules below are what still applies:

- Arrow functions, never `function` declarations.
- Functional and immutable: `const` over `let`, `map`/`filter`/`reduce` over mutating loops, no side effects where avoidable.
- Svelte 5 event syntax without colons — `onclick`, not `on:click`.
- Never add `eslint-disable` comments; fix the cause.
- `type` over `interface` (enforced by `@typescript-eslint/consistent-type-definitions`).

## Architecture

### Shared design system, duplicated by hand

`apps/game/src/app.css` and `apps/web/src/styles/global.css` are **identical, all 247 lines** — the Tailwind v4 CSS-first `@theme` block (colour tokens, display/pixel/retro fonts). There is no shared package. Any token change must be applied to both files or the apps drift apart visually.

### i18n: same library, two different strategies

Both apps use Paraglide 2 with `baseLocale: hu` and locales `hu, en, cs, sk`, message sources in `<app>/messages/{locale}.json`, compiled output gitignored (`src/paraglide/`, `src/lib/paraglide/`).

- **web**: Astro's native `i18n` routing with `prefixDefaultLocale: false`; `src/middleware.ts` calls `setLocale(context.currentLocale)`.
- **game**: no URL prefixes at all. Compiled with `--strategy cookie preferredLanguage baseLocale`, resolved per-request in `hooks.server.ts` via `paraglideMiddleware`, which also substitutes `%paraglide.lang%` into `app.html`.

Adding a string requires the key in `messages/hu.json` (Paraglide refuses to compile if the base locale is missing it) plus the other three, or `pnpm -F <app> machine-translate`.

### Game auth and data flow

`hooks.server.ts` composes `sequence(paraglide, supabase)`. The Supabase handle builds a per-request server client from cookies and exposes `locals.supabase`, `locals.session`, `locals.user`, and `locals.safeGetSession()` — the last verifies the session with `getUser()` rather than trusting the cookie, and every route relies on `locals.user` being trustworthy.

Route responsibilities:

- `+page.server.ts` returns a discriminated `PageState` (`login` | `tame-cta` | `dashboard`) and the page component branches on it — there is no client-side auth guard.
- `auth/callback/+server.ts` exchanges the OAuth `code` for a session, then redirects; failures land on `/auth/error`.
- `tame/+page.server.ts` redirects away if the user is signed out *or* already owns a cat.
- `api/cats/+server.ts` re-validates everything the client claims (name length, URL scheme, `domestication_points >= THRESHOLD`) before inserting, and maps Postgres `23505` to a 409 — the `cats_one_per_user` unique constraint is the real enforcement of "one cat per user".

Game simulation is pure functions in `src/lib/game/` (`physics.ts`, `constants.ts`, `foods.ts`); components own only rendering and the animation loop. Cat images come from `api.thecatapi.com` at runtime, which is why both that host and `cdn2.thecatapi.com` appear in the CSP in `apps/game/vercel.json`.

### Supabase

`apps/game/supabase/` holds `config.toml`, versioned `migrations/`, and local-only `seed.sql`. Schema flows local → dev cloud → prod cloud purely through migration files; never write SQL in the dashboard, and never edit a migration that has been applied to a cloud project — add a new one.

Two traps that have already caused outages here, both documented at length in `apps/game/README.md`:

1. **RLS policies do not grant table privileges.** This stack has no default privileges on `public`, so every new table needs an explicit `grant … to authenticated` (and `service_role`) alongside its policies, or all queries fail with `42501 permission denied`.
2. **`apps/game/.env` configures both the SvelteKit app and the local Supabase stack**, because `supabase start` reads `.env` from its working directory. It holds `PUBLIC_SUPABASE_*` plus the Google OAuth client ID/secret that fill the `env(...)` placeholders in `config.toml`. GoTrue receives those as container env vars at creation time, so editing `.env` does nothing until `supabase stop && supabase start`.

`apps/game/README.md` has a Troubleshooting section covering the OAuth and connection failure modes with the exact diagnostic commands.
