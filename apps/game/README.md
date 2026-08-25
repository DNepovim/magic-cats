# Magic Cats — Game

The drag-and-drop "tame the cat" game. SvelteKit + Supabase, deployed on Vercel at [meow.magic-cats.fyi](https://meow.magic-cats.fyi).

## Stack

- **[SvelteKit 2](https://svelte.dev/docs/kit)** with **Svelte 5 runes** and TypeScript strict
- **[Tailwind CSS v4](https://tailwindcss.com)** (CSS-first `@theme` — design system shared verbatim with `apps/web`)
- **[Supabase](https://supabase.com)** — Postgres + Auth (Google OAuth) + Realtime
- **[@inlang/paraglide-js](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) 2** — type-safe i18n in 4 locales (hu, en, cs, sk)
- **[@sveltejs/adapter-vercel](https://kit.svelte.dev/docs/adapter-vercel)** — deploy target

## Prerequisites

- **Node.js 24** (matches `apps/web`)
- **pnpm 10** (`packageManager` is pinned at the repo root)
- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** running — needed by the local Supabase stack
- **[Supabase CLI](https://supabase.com/docs/guides/cli)** — `brew install supabase/tap/supabase`

## Quick start (5 minutes from clone to running)

From the repo root:

```bash
# 1. install workspace deps
pnpm install

# 2. boot the local Supabase stack (Postgres + Auth + Studio + Inbucket)
#    first run downloads ~2 GB of Docker images
cd apps/game
supabase start

# 3. copy the printed API URL and publishable key into apps/game/.env:
#    PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#    PUBLIC_SUPABASE_ANON_KEY=<PUBLISHABLE_KEY from `supabase status`>
cp .env.example .env
# edit .env

# 4. run the game
cd ../..
pnpm -F game dev   # http://localhost:5173
```

The local stack prints both a legacy `ANON_KEY` (JWT) and a `PUBLISHABLE_KEY`
(`sb_publishable_…`); either works, but the cloud projects issue the publishable form, so
prefer it to keep local and cloud symmetrical.

The dashboard will already show 4 cats from `supabase/seed.sql` ("Other Tribes" sidebar), and the `cats` table is created by the migration auto-run on `supabase start`. Sign in (see "Auth in local dev" below) to tame your own.

## Environments

This app runs against three different Postgres databases depending on context:

| Env | DB | Wired via |
|---|---|---|
| **Local** | Docker stack via `supabase start` | `apps/game/.env` |
| **Dev (cloud)** | `magic-cats-dev` Supabase project | Vercel env vars on Preview + Development scopes |
| **Prod (cloud)** | `magic-cats-prod` Supabase project | Vercel env vars on Production scope only |

Schema changes flow `local → dev → prod` via the migration files in `supabase/migrations/` — there is **never** any manual SQL in the dashboard.

## Daily workflow

```bash
# every dev session — from the repo root, no `cd` needed
pnpm db:start              # boots Postgres + Auth + Studio + Inbucket in Docker
pnpm -F game dev           # SvelteKit on :5173
# ... develop ...
pkill -f 'vite dev'
pnpm db:stop               # frees ~1.5 GB RAM
```

The `db:*` scripts are thin wrappers around the Supabase CLI that run it inside
`apps/game/` (where `supabase/config.toml` lives), so they work from anywhere in the repo.
Every command below can still be run directly as `supabase <cmd>` from `apps/game/`.

| Script (repo root) | Runs | Notes |
|---|---|---|
| `pnpm db:start` | `supabase start` | boots the Docker stack |
| `pnpm db:stop` | `supabase stop` | keeps the data volume |
| `pnpm db:restart` | `supabase stop && supabase start` | required after editing `.env` — GoTrue reads it at container creation |
| `pnpm db:status` | `supabase status` | prints URLs + keys |
| `pnpm db:reset` | `supabase db reset` | drops the local DB, re-runs all migrations + `seed.sql` |
| `pnpm db:studio` | opens http://127.0.0.1:54323 | |

Two more live only in `apps/game` (`pnpm -F game …`) because they touch migrations:
`db:migration <name>` (`supabase migration new`) and `db:push` (`supabase db push`, which
writes to whichever cloud project is currently linked).

If `supabase start` reports `already running` while a container is `Exited` — typically
after a Docker restart — `pnpm db:restart` clears it.

Useful local URLs while `supabase start` is running:

| Service | URL |
|---|---|
| Game | http://localhost:5173 |
| Supabase Studio (DB UI) | http://127.0.0.1:54323 |
| Inbucket (email catcher) | http://127.0.0.1:54324 |
| Supabase REST API | http://127.0.0.1:54321 |

## Cat care model

A cat is not stored as "how she is right now" — she is stored as a snapshot plus
the moment it was taken:

| Column | Meaning |
|---|---|
| `satiety`, `happiness` | 0–100, as of `state_at` |
| `state_at` | when that snapshot was true |
| `illness` | `sniffles` \| `earmites` \| `furball`, or null |
| `taste_seed` | fixed per cat; decides how she rates each food |

`simulate()` in `src/lib/game/care.ts` replays a cat forward from `state_at` in
five-minute steps, so **nothing has to tick server-side** and an untouched cat
still gets hungry. Illness onset is rolled inside that replay from a PRNG seeded
by the cat id and the step index — deterministic, so the browser and the API
derive exactly the same cat from the same row without the server writing on
every page load. Every action (feed, medicine, play, a cat-vs-cat game)
simulates up to `now`, applies its effect, and stores a fresh snapshot.

The loop:

- Satiety falls ~3/hour, doubled while ill.
- Above `SATIETY_THRESHOLD` (50) happiness climbs 2/hour; below it, it falls
  4/hour. Illness costs another 3/hour.
- Food raises satiety, scaled by that cat's taste (0.5×–1.6×, from
  `tasteFor()`); dainties barely feed her but lift her mood a lot.
- Playing with her is free happiness on a 30-minute cooldown.
- Low satiety *and* low happiness raise the hourly chance of illness. Curing
  needs the matching medicine **and** satiety ≥ `CURE_SATIETY` (80).

Food and medicine are items, not cooldowns: they come from supply runs
(`/supply`) and live in `user_items`. A run is validated rather than trusted —
the server stores a seed, the client derives the identical flight plan from it
(`scheduleFor()`), and on hand-in the server re-derives the schedule and grants
only indices that were genuinely in the air, each at most once.

## Auth in local dev

`supabase start` does not enable Google OAuth out of the box (Google won't redirect to `localhost:54321` unless its OAuth client is configured for it). Two options:

**A. Add the local Supabase callback to your Google OAuth client.**
Google Cloud Console → your OAuth client → **Authorized redirect URIs** → add, spelled
exactly (`127.0.0.1`, *not* `localhost` — Google matches the string literally, and this
is the URI GoTrue sends):
```
http://127.0.0.1:54321/auth/v1/callback
```
Then add the client ID/secret to `apps/game/.env` — `supabase start` reads `.env` from the
directory it runs in, so the same gitignored file configures both the app and the stack,
and these two keys resolve the `env(...)` placeholders in `config.toml`:
```bash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<...>.apps.googleusercontent.com
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=GOCSPX-<...>
```
```bash
cd apps/game && supabase stop && supabase start   # env is read at container creation
```
The restart is not optional: GoTrue receives these as container environment variables, so
editing `.env` while the stack is up changes nothing until the containers are recreated.
If the vars are missing entirely, `supabase start` warns `environment variable is unset:
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and the login button sends Google a literal
`client_id=env(...)`.

**B. Seed yourself a user via SQL (fastest).**
Open Supabase Studio at http://127.0.0.1:54323 → **Authentication → Users → Add user** → email + password. Then tweak `LoginScreen.svelte` to also offer an email/password form, or sign in once via the Studio's "Sign in as user" affordance.

## Schema migrations

Migrations live in `supabase/migrations/<timestamp>_<name>.sql`. The Supabase CLI tracks applied migrations in a `supabase_migrations.schema_migrations` table on each linked Postgres database.

```bash
# Create a new migration
cd apps/game
supabase migration new add_battles_table
# → supabase/migrations/<timestamp>_add_battles_table.sql

# Edit the file, write idempotent SQL (prefer `create … if not exists`, `drop … if exists`)

# Validate locally — wipes DB, replays all migrations, re-runs seed.sql
supabase db reset

# Promote to dev cloud
supabase link --project-ref <DEV-REF>
supabase db push

# Promote to prod cloud (after validating preview deploys)
supabase link --project-ref <PROD-REF>
supabase db push
```

`supabase link` swaps which remote project the CLI talks to. The migration files themselves never change between dev and prod — that's the whole point.

> ⚠️ **Never edit a migration after it's been applied to any cloud project.** Add a new migration that alters/fixes the previous state instead. Editing a committed migration breaks the migration tracking table.

### Every new table needs explicit GRANTs

RLS policies do **not** grant table privileges — Postgres checks the `GRANT` first and only
then evaluates policies. This stack has no default privileges on `public` (`\ddp` returns
zero rows), so a table created with policies but no grants fails every request with:

```
42501  permission denied for table <name>
```

So each migration that creates a table must also grant, matching whatever roles its
policies target — see `20260805120000_grant_cats_privileges.sql`:

```sql
grant select, insert, update, delete on public.<table> to authenticated;
grant all on public.<table> to service_role;
```

Grant to `anon` only if logged-out visitors genuinely need the data; for `cats` they don't,
since every read sits behind a `locals.user` check.

## Seed data

`supabase/seed.sql` runs **automatically after migrations** on `supabase start` and `supabase db reset`. It inserts 4 dummy `auth.users` + their cats so the dashboard's "Other Tribes" sidebar isn't empty before you sign in.

`supabase db push` (for cloud projects) **ignores seed.sql** by design — seed data should never end up in dev/prod.

To reset local DB to the seed state at any time:
```bash
supabase db reset
```

## Build & deploy

```bash
# build (runs paraglide compile + vite build via @sveltejs/adapter-vercel)
pnpm -F game build

# type-check + svelte-check
pnpm -F game check
```

Vercel project settings (see also the top-level [PR checklist for game deploy](#vercel-setup-checklist) below):
- **Root Directory:** `apps/game` (with "Include source files outside of Root Directory" enabled)
- **Framework Preset:** SvelteKit (auto-detected)
- **Build Command:** `pnpm build` (override)
- **Output Directory:** leave empty (adapter-vercel writes `.vercel/output`)
- **Env vars** (per scope):
  - Production: `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` from `magic-cats-prod`
  - Preview + Development: same vars but from `magic-cats-dev`

## i18n

Source-of-truth message files in `messages/{hu,en,cs,sk}.json`. The build runs `paraglide-js compile` and emits `src/lib/paraglide/` (gitignored).

Locale resolution is server-side per request:
1. `PARAGLIDE_LOCALE` cookie (set by the `LanguageSwitcher` in `+layout.svelte`)
2. `Accept-Language` header (first matching locale)
3. Fallback: `hu` (baseLocale, matches `apps/web`)

Add a new string:
```bash
# 1. add a key to messages/hu.json (baseLocale) — Paraglide refuses to compile if base is missing
# 2. add the same key to en.json, cs.json, sk.json — or run:
pnpm -F game machine-translate
# 3. import and call in any .svelte file:
#    import { m } from '$lib/paraglide/messages';
#    {m.your_key()}
```

## Project structure

```
apps/game/
├── .env                      Local config + secrets — gitignored, see .env.example
├── src/
│   ├── app.html              SvelteKit root template
│   ├── app.css               Magic Cats design system (mirrors apps/web/src/styles/global.css)
│   ├── app.d.ts              App.Locals types: supabase + session + locale
│   ├── hooks.server.ts       paraglideMiddleware + Supabase server client + safeGetSession
│   ├── lib/
│   │   ├── components/       Svelte 5 components (Game, Dashboard, login, modal, etc.)
│   │   ├── game/             Game logic: constants, foods, physics, types
│   │   ├── supabase/         Browser Supabase client + row types
│   │   └── paraglide/        Generated by `paraglide-js compile` — gitignored
│   └── routes/
│       ├── +layout.{server.ts,svelte}    Loads session + locale; mounts LanguageSwitcher
│       ├── +page.{server.ts,svelte}      Branches on state: login | tame-cta | dashboard
│       ├── tame/             Game canvas; blocked if user already has a cat
│       ├── auth/callback/    Supabase OAuth code exchange → /
│       ├── auth/error/       Friendly error page if OAuth round-trip fails
│       └── api/cats/         POST endpoint that inserts the tamed cat
├── supabase/
│   ├── config.toml           Supabase CLI project config (`project_id` names the local stack)
│   ├── migrations/           Versioned SQL — single source of truth for schema
│   └── seed.sql              Local-only dummy data (runs after migrations)
├── static/                   Public assets (favicon)
├── messages/                 Paraglide source: {locale}.json
├── project.inlang/           Paraglide settings
└── vercel.json               CSP + cache headers
```

## Troubleshooting

**Login button → `DNS_PROBE_FINISHED_NXDOMAIN` on `<ref>.supabase.co`**
`PUBLIC_SUPABASE_URL` points at a Supabase project that no longer exists. NXDOMAIN means
*deleted*, not paused — a paused project still resolves in DNS and answers with an HTTP
error. Confirm with `host <ref>.supabase.co`, then either point `.env` at the local stack
(`http://127.0.0.1:54321`) or create a replacement cloud project and `supabase link` to it.
Check the Vercel env vars too: if Preview/Production carry the same dead ref, the deployed
site is broken in the same way, and its logged-out page still returns 200 because
`safeGetSession` short-circuits with no session cookie.

**`supabase start` → `Missing required field in config: project_id`**
`project_id` in `config.toml` is empty. It is the *local* stack's name (used as the Docker
container prefix), not something `supabase link` fills in for you. Set it to any stable
slug — this repo uses `magic-cats`.

**Google sign-in → `invalid_client` / "The OAuth client was not found"**
GoTrue is sending a client ID Google doesn't recognise. Check what it actually sends —
this is the single most useful command when OAuth misbehaves:
```bash
curl -si "http://127.0.0.1:54321/auth/v1/authorize?provider=google&redirect_to=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback" | grep -i ^location
```
- literal `client_id=env(...)` → the vars are missing from `.env`; `supabase start` also
  warns `environment variable is unset: …`
- a *stale* client ID → `.env` was edited without recreating the containers; the values are
  baked in at container creation, so `supabase stop && supabase start`
- the right ID but still rejected → the client was deleted in Google Cloud Console, or
  belongs to a different GCP project than the one you're looking at

To confirm the client is valid end to end, follow that Location with curl: reaching
`accounts.google.com/v3/signin/identifier` means Google accepted both the client ID and the
redirect URI, since it validates the URI before rendering the sign-in page.

**Google sign-in → `redirect_uri_mismatch`**
The OAuth client is missing `http://127.0.0.1:54321/auth/v1/callback`, or has it spelled
with `localhost`. Google matches the string literally and GoTrue sends `127.0.0.1`.

**Any query → `42501 permission denied for table …`**
Missing GRANTs — see "Every new table needs explicit GRANTs" above.
