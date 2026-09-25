# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

所有回應請使用**繁體中文**。

## Issue Workflow (mandatory)

Before evaluating, planning, or changing any file, follow [.claude/skills/issue-workflow/SKILL.md](.claude/skills/issue-workflow/SKILL.md): check the GitHub issues (or the issue number the user named) first. Always ask the user before creating, commenting on, editing, or closing an issue — the only exception is ticking checkboxes for work that is done and verified.

## Repository Layout

Travel Pocket is a mobile-optimized PWA for managing travel itineraries. The repo is a **pnpm workspace** monorepo (globs `apps/*` and `packages/*`, see `pnpm-workspace.yaml`):

| Path | Package | Role | Deploy target | Guide |
|---|---|---|---|---|
| `apps/web/` | `@travel-pocket/web` | Frontend PWA (React + Vite) | GitHub Pages | [apps/web/CLAUDE.md](apps/web/CLAUDE.md) |
| `packages/shared/` | `@travel-pocket/shared` | Data types and API contract | — (consumed via `workspace:*`) | [packages/shared/CLAUDE.md](packages/shared/CLAUDE.md) |

`apps/*` holds deployable applications; `packages/*` holds libraries that apps depend on. The root `package.json` only contains workspace-level scripts — no application code and no application dependencies.

This file holds only repo-wide rules. Each workspace keeps its own architecture, commands, and conventions in its own `CLAUDE.md`; **read that file before changing anything inside the workspace**, and keep package-specific guidance there rather than here.

## Isolation Rules (mandatory)

Frontend, backend, and any app added later **must be developed in complete isolation**. Treat every directory under `apps/` as if it lived in its own repository that happens to share `packages/`. These rules apply to every change:

1. **No cross-app imports.** An app never imports from another app — not by relative path (`../../apps/...`) and not by package name (`@travel-pocket/<other-app>`). An app never lists another app as a dependency.
2. **Share only through `packages/`.** Anything two or more apps need (types, API contract, validation constants) goes into a package under `packages/` and is consumed via `workspace:*`. Never copy code between apps and never reach into another app's source.
3. **Apps talk only through the contract.** Cross-app communication happens over the API defined in `packages/shared`. An app never reads another app's files at runtime or build time (e.g. a backend must not read `apps/web/public/data/`); data that must be shared moves into a package.
4. **Packages stay runtime-agnostic.** Code in `packages/` must run in the browser, Node, and Cloudflare Workers alike: no DOM, Node, or Workers APIs, and no framework dependencies (React, Hono, …).
5. **Each app owns its dependencies and config.** Every app has its own `package.json`, `tsconfig*.json`, ESLint config, test config, and `CLAUDE.md`. Declare a dependency in the app that uses it — never in the root `package.json`, and never rely on a dependency hoisted in from another package. Don't extend another app's config; extract a shared config package under `packages/` if one is ever needed.
6. **Each app runs on its own.** `dev`, `build`, `lint`, `test`, and deploy must succeed for one app via `pnpm -F <package> <script>` without any other app running or built. An app that consumes another app's API must degrade gracefully when that API is unavailable, and its tests mock the API at the network boundary using the shared contract types — never by importing the other app.
7. **Each app deploys on its own.** Each app has its own GitHub Actions workflow whose `paths` filter lists only that app's directory, the packages it depends on, and root workspace files; it installs with `pnpm install --frozen-lockfile --filter <package>...`. `.github/workflows/deploy.yml` is the reference for `apps/web`.
8. **Keep changes scoped.** A commit or PR should touch one app, plus `packages/` only when the contract itself changes. When changing a package, verify every app that depends on it:

   ```bash
   pnpm -F "...@travel-pocket/shared" build   # the package and all its dependents
   pnpm -F "...@travel-pocket/shared" test
   ```

### Adding a new app

1. Create `apps/<name>/` with package name `@travel-pocket/<name>`.
2. Give it `dev`, `build`, `lint`, and `test` scripts so the recursive root commands pick it up.
3. Add its own `tsconfig*.json`, ESLint config, and test config.
4. Depend on `@travel-pocket/shared` (`workspace:*`) if it needs the data types or contract; add new shared types there, not in the app.
5. Add a `dev:<name>` script to the root `package.json`.
6. Add its own workflow under `.github/workflows/` following rule 7.
7. Write `apps/<name>/CLAUDE.md` (link back to this file for the Isolation Rules), then add a row to the Repository Layout table above.

## Commands

Run from the repo root:

```bash
pnpm dev          # Start the web dev server (same as pnpm dev:web)
pnpm dev:web      # Start the web dev server only
pnpm build        # Run build in every workspace package
pnpm lint         # Run ESLint in every workspace package
pnpm test         # Run unit tests in every workspace package
pnpm test:e2e     # Run web Playwright E2E tests (auto-starts dev server)
pnpm preview      # Preview the web production build locally
```

`build`, `lint`, and `test` run recursively (`pnpm -r`). When working on a single workspace, target it with `pnpm -F <package> <script>` instead; each workspace's `CLAUDE.md` lists its own scripts.
