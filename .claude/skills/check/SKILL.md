---
name: check
description: Run the static-check suite for the magic-cats monorepo — svelte-check, tsc, ESLint, Prettier, Knip — and fix real failures. Use when asked to check, verify, or QA the code (e.g. "run the checks", "is it clean?", before committing/deploying).
---

# Static checks (magic-cats)

Two apps with separate toolchains. Run checks per app with `pnpm -F game …` /
`pnpm -F web …`; the root `pnpm check` fans out through Turbo but currently
aborts on the broken tasks below, so per-app is more informative.

There are **no tests** in this repo — no runner, no test files. Don't look for a
test command.

## What to run

| App    | Check     | Command                    | State                          |
| ------ | --------- | -------------------------- | ------------------------------ |
| game   | Types     | `pnpm -F game check`       | ✅ passes — the primary gate    |
| web    | Types     | `pnpm -F web typecheck`    | ❌ pre-existing errors          |
| web    | Dead code | `pnpm -F web knip`         | ❌ pre-existing findings        |
| both   | Lint      | `pnpm -F <app> lint:check` | ❌ broken config, never runs    |
| both   | Format    | `pnpm -F <app> format:check` | ❌ broken config, never runs  |

`pnpm -F game check` runs paraglide compile + `svelte-kit sync` + `svelte-check`
and is the one gate that is meaningful today. Treat it as the must-pass check for
any change under `apps/game`.

## Known-broken tooling — do not chase these to green

All verified 2026-08-05. These fail on a clean checkout with zero local changes,
so a failure here is **not** evidence that your change broke something. Confirm
the failure matches the signature below, report it, and move on.

- **ESLint, both apps** — `ERR_MODULE_NOT_FOUND: Cannot find package '@eslint/js'
  imported from /eslint.config.js`. The shared root config imports `@eslint/js`,
  `typescript-eslint`, and the plugins, but they're installed only under
  `apps/web/node_modules`; the root `package.json` has just `turbo`. Nothing lints
  right now, in either app.
- **Prettier, game** — `Cannot find package 'prettier-plugin-astro'`. The root
  `prettier.config.js` declares Astro/Tailwind/sort-imports plugins that aren't
  dependencies of `apps/game`.
- **Prettier, web** — fails on 3 files, including generated `src/paraglide/server.js`
  (compiled output, gitignored, but not in `.prettierignore`, which only lists
  `**/*.svg`).
- **`pnpm -F web typecheck`** — 3 × `TS2339: Property 'data' does not exist on type
  'never'` in `src/utils/schema.ts`.
- **`pnpm -F web knip`** — reports the ESLint/Prettier plugins as unused
  dependencies, largely a knock-on of ESLint never running.

Two extra traps if you do decide to touch the tooling:

- The root `prettier.config.js` sets `semi: false`, but `apps/game` is written
  **with** semicolons and was never formatted by it. Running `format:write` there
  would rewrite the entire app — never do that as a side effect of another task.
- ESLint's `globalIgnores` includes `**/*.svelte`, so Svelte components are out of
  scope even once ESLint works.

Fixing this tooling is its own task (hoist the dev deps to the root
`package.json`, add `prettier-plugin-svelte`, decide the game's semicolon style).
Only do it if asked.

## How to fix real failures

1. **svelte-check** — fix the types. `@typescript-eslint/consistent-type-definitions`
   is configured for `type` over `interface`; match the surrounding style.
2. **tsc (web)** — manual. If your change adds errors, fix those; leave the 3
   pre-existing `schema.ts` ones alone unless asked.
3. **knip (web)** — delete unused files, un-`export` internal-only symbols, or drop
   unused deps. For deps used implicitly, add to `ignoreDependencies` in
   `apps/web/knip.config.ts` rather than removing them.

Never hand-format to satisfy Prettier, and never add `eslint-disable` comments —
`.cursorrules` bans them outright.

## Done criterion

`pnpm -F game check` exits 0, and `pnpm -F web typecheck` / `knip` show no *new*
findings beyond the pre-existing ones listed above. Report what you ran, what you
changed, and which failures were pre-existing — never present a known-broken check
as if your change caused it, and never claim the suite is green when it isn't.
