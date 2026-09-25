# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

所有回應請使用**繁體中文**。

## Project Overview

Travel Pocket is a mobile-optimized PWA (Progressive Web App) for managing travel itineraries. It is deployed to GitHub Pages and reads all trip data from static JSON files in `apps/web/public/data/`.

The repo is a **pnpm workspace** monorepo (globs `apps/*` and `packages/*`, see `pnpm-workspace.yaml`):

- `apps/web/` — the frontend (package `@travel-pocket/web`)
- `packages/shared/` — data types and API contract constants shared across packages (package `@travel-pocket/shared`, consumed via `workspace:*`)

Unless noted otherwise, paths in the Architecture section are relative to `apps/web/`.

## Commands

Run from the repo root:

```bash
pnpm dev          # Start the web Vite dev server with HMR (same as pnpm dev:web)
pnpm dev:web      # Start the web Vite dev server only
pnpm build        # Run build in every workspace package (web: tsc + Vite build to apps/web/dist/)
pnpm lint         # Run ESLint in every workspace package
pnpm preview      # Preview the web production build locally

pnpm test              # Run Vitest unit tests in every workspace package
pnpm test:e2e          # Run web Playwright E2E tests (auto-starts dev server)
```

Other web scripts run through a filter:

```bash
pnpm -F @travel-pocket/web test:watch      # Vitest watch mode
pnpm -F @travel-pocket/web test:coverage   # Vitest with V8 coverage report
pnpm -F @travel-pocket/web test:e2e:ui     # Playwright interactive UI
pnpm -F @travel-pocket/web run deploy      # Build then push dist/ via gh-pages (`run` is required: `pnpm deploy` is a pnpm built-in)
```

## Architecture

### Routing

Uses **HashRouter** (not BrowserRouter) — required for GitHub Pages static hosting. Routes follow the pattern `/#/trip/{tripId}/schedule`, `/#/trip/{tripId}/shops`, `/#/trip/{tripId}/info`.

`TripView.tsx` is the nested layout shell; it fetches trip data and passes it down to child routes via `useOutletContext`.

### Data

All trip data is **static JSON** fetched at runtime from `public/data/`:

- `trips.json` — Array of `Trip` metadata (id, name, dates, cover image, snapshot path)
- `{tripId}/itinerary.json` — `ItineraryDay[]` (array of days, each with `ItineraryItem[]`)
- `{tripId}/shops.json` — `Shop[]`
- `{tripId}/info.json` — `InfoItem[]`

To add a new trip: add its folder under `public/data/`, populate the three JSON files, then add an entry to `trips.json`. No code changes are needed unless new data fields are introduced.

All TypeScript interfaces for data structures are defined in [packages/shared/src/types.ts](packages/shared/src/types.ts); `src/types.ts` re-exports them so app code keeps importing from `../types`. Contract constants (`DATA_TYPES`, `ID_PATTERN`, `TripDataMap`) live in [packages/shared/src/contract.ts](packages/shared/src/contract.ts).

`@travel-pocket/shared` ships TypeScript source (no build step). Relative imports inside it must keep the `.ts` extension, because `vite.config.ts` loads it through Node's native type stripping, which does not resolve extensionless paths.

### Theming

Dark/light mode is class-based (`.dark` on `<html>`). `ThemeContext.tsx` reads/writes `localStorage` and respects `prefers-color-scheme` as a default. All Tailwind dark variants use `dark:` prefix.

### Key Libraries

| Library | Usage |
|---|---|
| `framer-motion` | Bottom sheet modal slide-up, page transitions |
| `date-fns` | Time formatting and duration calculations in `Schedule.tsx` |
| `lucide-react` | Category icons mapped by `ItineraryItem.category` string |
| `clsx` | Conditional className construction |
| `vite-plugin-pwa` | Service worker, offline caching (7-day expiry for JSON data) |

### Testing

| Layer | Tool | Location |
|---|---|---|
| Unit / component | Vitest + React Testing Library + jsdom | `src/**/*.test.tsx` |
| E2E | Playwright (Chromium only) | `e2e/*.spec.ts` |

- Vitest setup file is at `src/test/setup.ts` — patches `matchMedia` for jsdom and runs `cleanup` after each test
- E2E tests run against the dev server at `http://localhost:5173/travel-pocket/`; Playwright starts it automatically via `webServer` in `playwright.config.ts`

### Build Notes

- Base path is `/travel-pocket/` (set in `vite.config.ts`) — required for GitHub Pages
- TypeScript strict mode is on (`noUnusedLocals`, `noUnusedParameters`)
- Tailwind typography plugin is used for markdown-style content in `Info.tsx`
- Mobile-first layout: main container is capped at `max-width: 480px`
