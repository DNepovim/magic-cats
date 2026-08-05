---
name: ship
description: Ship the current work — first run the `check` suite, then (default) commit on a new branch and open a GitHub PR, or (`ship prod`) commit and push straight to main. Use when finishing a piece of work and you want it committed / PR'd / shipped. Argument, `prod`, controls the mode.
---

# Ship

Two modes:

- **`ship`** (no argument) → ask the user whether to open a branch + PR or commit
  directly to `main`.
- **`ship prod`** → skip the question and commit directly to `main`.

Both start by gating on the checks and proposing Conventional Commit messages for
confirmation. **Never commit, push, or open a PR without the user's explicit
confirmation of the message(s) — and, for the branch flow, the branch name.**

Remote is `git@github.com:DNepovim/magic-cats.git`, default branch `main`.

## Step 0 — Gate on checks (both modes)

Invoke the **`check`** skill. It distinguishes real failures from this repo's
known-broken tooling (ESLint and Prettier don't run at all right now). Ship only
if `pnpm -F game check` is clean and nothing *new* appeared; if a real failure
can't be made green, **stop** and report.

Then look at what will ship: `git status --short` and `git diff` (staged +
unstaged). If the tree is clean, say there's nothing to ship and stop.

## Step 0b — Migration check (both modes)

```bash
git status --short apps/game/supabase/migrations/
```

If any migration files appear (new `??` or modified `M`), ask with
**`AskUserQuestion`** before proceeding:

- **"Yes, push now"** — `cd apps/game && supabase db push`. Wait for success
  before continuing; if it fails, report and stop — never ship code whose
  migration failed. (Recommended for `ship prod`)
- **"No, skip"** — continue without pushing.

Two caveats specific to this repo:

- `supabase db push` targets whichever project `supabase link --project-ref <ref>`
  last pointed at. **As of 2026-08-05 no cloud project is linked** — the previous
  ref (`xsxkhtsyceyadtljgrax`) was deleted and returns NXDOMAIN. Until a
  replacement is created and linked, "push now" cannot succeed; say so rather than
  running it blind.
- Every migration that creates a table must also `grant` on it — RLS policies do
  not imply table privileges here, and a missing grant fails every query with
  `42501`. See `apps/game/README.md`.

If no migration files changed, skip this step silently.

## Step 0c — Choose ship mode (only when invoked as plain `ship`)

Ask with **`AskUserQuestion`**:

- **"Branch + PR"** — new branch, commit, push, open a PR. (Recommended)
- **"Commit to main"** — commit and push directly to `main` (same as `ship prod`).

## Step 1 — Propose Conventional Commit message(s) (both modes)

Read the diff and propose message(s) following **Conventional Commits v1.0.0**
(https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

- **types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
  `ci`, `chore`, `revert`.
- `feat` → MINOR, `fix` → PATCH. Breaking change → `!` after type/scope **and/or**
  a `BREAKING CHANGE:` footer.
- Description: imperative mood, lowercase, no trailing period, concise.
- Scope is optional and in parentheses. In this monorepo prefer the app as scope
  when a change is app-local: `feat(game): …`, `fix(web): …`.

If the working tree contains **logically separate** changes, propose **multiple
commits** (each a coherent Conventional Commit with the files it covers) rather
than one catch-all. Otherwise propose a single commit.

Present the proposed message(s) (and, in branch mode, the branch name) with
**`AskUserQuestion`**:

- **"Ship it"** — proceed as-is (Recommended)
- **"Edit message"** — user types a replacement; apply it and ship
- **"Cancel"** — stop, do not commit

Only continue on "Ship it" or an edited message. Do **not** ask in plain text —
always use `AskUserQuestion` so the session stays unblocked.

Every commit message must end with the footer:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## Step 2 — Ship

### Default (`ship`, no arg): branch + PR

1. Suggest a branch name `<type>/<kebab-summary>` (e.g. `feat/leaderboard`,
   `fix/oauth-redirect`). Include it in the Step 1 confirmation prompt.
2. If on `main`, `git checkout -b <branch>` — this carries the uncommitted changes
   with it.
3. Commit the confirmed message(s) (stage per-commit if splitting).
4. `git push -u origin <branch>`.
5. Open the PR: `gh pr create --base main --head <branch> --title "<conventional title>" --body "<short summary of what & why>"`.
6. Report the PR URL.

**`gh` is not installed on this machine** (`command not found`). Don't fail
silently at step 5 — push the branch, then tell the user to either install it
(`! brew install gh && gh auth login`) or open the PR from the compare URL:
`https://github.com/DNepovim/magic-cats/compare/main...<branch>`.

### `ship prod`: commit + push to main

1. Ensure you're on `main` (or check it out).
2. Commit the confirmed message(s).
3. `git push origin main`.
4. **Note to the user:** there is no CI in this repo (no `.github/workflows`).
   Deploys run through Vercel's git integration, so pushing `main` publishes both
   apps — `apps/web` and `apps/game` (meow.magic-cats.fyi) — straight to
   production, with no checks in between. Say this explicitly before pushing.

## Notes

- Vercel env vars are configured per scope in the dashboard, not in the repo. If a
  change needs a new env var, flag it — a green local run proves nothing about
  Production.
- Don't touch unrelated files or amend history the user didn't ask about.
- `.env`, `.env.*` (except `.env.example`) are gitignored; never stage secrets.
