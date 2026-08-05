---
name: code-guide
description: Coding style and conventions for the magic-cats monorepo — TypeScript, Svelte 5 runes, Astro, Tailwind v4 design tokens, i18n, and Supabase access rules. Consult when writing or reviewing code.
---

# Code Guide

Style and pattern reference for magic-cats. Consult before writing or reviewing
any code. Sources: `.cursorrules`, `AGENTS.md`, and the conventions the existing
code actually follows.

Note that ESLint does not currently run in this repo (see the `check` skill), so
**nothing here is machine-enforced.** Apply it by reading the surrounding code.

---

## TypeScript

- Write functional, immutable code — `const` over `let`, `map`/`filter`/`reduce`
  over mutating loops, no side effects where avoidable
- **Arrow functions, never `function` declarations** (`AGENTS.md`)
- Do not use `any`
- Avoid type assertions (`as`) — model the types correctly instead
- Avoid non-null assertions (`!`) — guard or use `??`
- Do not write `// eslint-disable` comments — fix the underlying issue
- Prefer early returns over nested conditionals
- Use `type` for all type definitions, not `interface` — configured as
  `@typescript-eslint/consistent-type-definitions`
- Use the `type` keyword on import-only lines: `import type { CatRow } from '…'`

### Path aliases differ per app

- **game** (SvelteKit): `$lib/...` — `import { THRESHOLD } from '$lib/game/constants'`
- **web** (Astro): `@/...` → `./src` — `import { setLocale } from '@/paraglide/runtime'`

Never use parent-relative (`../`) imports in either app.

### Formatting differs per app

`apps/web` is written without semicolons (matching the root `prettier.config.js`,
`semi: false`, width 90, single quotes). `apps/game` is written **with**
semicolons and has never been run through that config. Match the file you're in;
do not reformat a file wholesale as a side effect of an unrelated change.

---

## Components

- Keep components small; extract a sub-component when a section owns its own state
  or animation logic
- Every named component lives in its own file — no inline sub-components inside
  another component's file
- Pass primitives over objects where reasonable (`name={cat.name}` over
  `cat={cat}`), except where a row type is genuinely the unit being rendered

### Svelte 5 (apps/game)

- **Runes only** — `$props()`, `$state()`, `$derived()`, `$effect()`. No
  `export let`, no legacy stores for component state.
- **Event syntax without colons** — `onclick`, `onsubmit` (not `on:click`)
- Type props inline on the `$props()` destructure, as in `CatCard.svelte`:

```svelte
<script lang="ts">
  const {
    cat,
    variant = 'compact',
  }: {
    cat: Pick<CatRow, 'id' | 'name' | 'image_url'>;
    variant?: 'hero' | 'compact';
  } = $props();

  const formatted = $derived(new Date(cat.domesticated_at).toLocaleDateString(getLocale()));
</script>
```

- Derive, don't sync: `$derived` over an `$effect` that assigns to `$state`

### Astro (apps/web)

- Components are `.astro`; ship zero client JS unless the interaction genuinely
  needs it
- Locale-prefixed routing is Astro-native (`prefixDefaultLocale: false`, `hu` is
  the unprefixed default); `src/middleware.ts` sets the Paraglide locale per request

---

## Value maps

Do not use `if`/ternary chains or `switch` to select a value from a known set. Use
a module-level constant map:

```ts
// ❌ Breaks silently when a new variant is added
const size = variant === 'hero' ? 192 : variant === 'compact' ? 96 : 64

// ✅ Exhaustiveness enforced by the type
const CARD_SIZES = {
  hero: 192,
  compact: 96,
} as const satisfies Record<CardVariant, number>

const size = CARD_SIZES[variant]
```

Always `as const satisfies Record<KnownUnion, Value>` — `as const` preserves
literal types, `satisfies` enforces exhaustiveness at compile time. Never
`Partial<Record<string, …>>`; it accepts unknown keys and defeats the check.

Use `switch` only for executing side effects per variant, never for computing a
value.

---

## Conditionals

Use `if` only for guards and genuinely boolean checks (`if (!locals.user)`). For
variant selection, use a value map.

The game's page state is modelled as a discriminated union
(`{ state: 'login' } | { state: 'tame-cta' } | { state: 'dashboard', … }`) built
server-side and branched on in the component — prefer that shape over booleans
like `isLoggedIn && hasCat` that can express impossible states.

---

## Game logic (apps/game/src/lib/game)

- Simulation stays in pure functions — `physics.ts`, `constants.ts`, `foods.ts`.
  Components own rendering and the animation loop only.
- Tunables (`THRESHOLD`, `CAT_COUNT`, speeds, respawn timings) belong in
  `constants.ts`, never inline in a component.

---

## Styling (Tailwind v4)

- Design tokens live in a CSS-first `@theme` block: colours (`--color-magic`,
  `--color-gold`, …) and fonts (`--font-display`, `--font-pixel`, …). Use the
  tokens (`text-magic`, `font-display`), not raw hex.
- **`apps/game/src/app.css` and `apps/web/src/styles/global.css` are identical, all
  247 lines, and there is no shared package.** Any token change must be applied to
  both files by hand or the apps drift apart visually.
- `tailwindcss-motion` is available in both apps for animation utilities.

---

## i18n (Paraglide 2)

- **Never hardcode a user-facing string.** Add the key to `messages/hu.json` first
  — `hu` is the `baseLocale` and Paraglide refuses to compile if the base is
  missing a key — then `en`, `cs`, `sk`, or run `pnpm -F <app> machine-translate`.
- Call as `m.your_key()` (game: `import { m } from '$lib/paraglide/messages'`).
- `src/paraglide/` and `src/lib/paraglide/` are generated and gitignored — never
  edit or commit them.

---

## Supabase (apps/game)

- Server routes must re-validate everything the client sends. `api/cats/+server.ts`
  is the model: check `locals.user`, validate name length and URL scheme, verify
  `domestication_points >= THRESHOLD`, and map Postgres `23505` to a 409 rather
  than leaking a DB error.
- Trust `locals.user` (verified via `getUser()` in `safeGetSession`), never a
  client-supplied user id.
- Auth gating happens in `+page.server.ts` / `+layout.server.ts` load functions —
  there is no client-side guard, so don't add one and assume it protects anything.
- Schema changes go in a new file under `supabase/migrations/`. Never edit an
  applied migration; never write SQL in the dashboard. Every new table needs an
  explicit `grant … to authenticated` alongside its RLS policies.

---

## Testing

There is no test infrastructure in this repo — no runner, no test files, nothing
wired into any script. Don't add test files expecting them to run, and don't claim
a change is "tested" on that basis. Verify by running the app (`pnpm -F game dev`
with the local Supabase stack up, or `pnpm -F web dev`) and by `pnpm -F game check`.

If the pure logic in `src/lib/game/` ever warrants tests, adding Vitest is a
deliberate setup task to raise with the user first.
