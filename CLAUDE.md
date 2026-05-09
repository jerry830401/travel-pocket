# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

所有回應請使用**繁體中文**。

## Project Overview

Travel Pocket is a mobile-optimized PWA (Progressive Web App) for managing travel itineraries. It is deployed to GitHub Pages and reads all trip data from static JSON files in `/public/data/`.

## Commands

```bash
pnpm dev          # Start Vite dev server with HMR
pnpm build        # TypeScript check + production Vite build (outputs to dist/)
pnpm lint         # Run ESLint
pnpm preview      # Preview production build locally
pnpm deploy       # Build then push dist/ to GitHub Pages via gh-pages

pnpm test              # Run Vitest unit tests (single run)
pnpm test:watch        # Run Vitest in watch mode
pnpm test:coverage     # Run Vitest with V8 coverage report
pnpm test:e2e          # Run Playwright E2E tests (auto-starts dev server)
pnpm test:e2e:ui       # Run Playwright E2E tests with interactive UI
```

## Architecture

### Routing

Uses **HashRouter** (not BrowserRouter) — required for GitHub Pages static hosting. Routes follow the pattern `/#/trip/{tripId}/schedule`, `/#/trip/{tripId}/shops`, `/#/trip/{tripId}/info`.

`TripView.tsx` is the nested layout shell; it fetches trip data and passes it down to child routes via `useOutletContext`.

### Data

All trip data is **static JSON** fetched at runtime from `/public/data/`:

- `trips.json` — Array of `Trip` metadata (id, name, dates, cover image, snapshot path)
- `{tripId}/itinerary.json` — `ItineraryDay[]` (array of days, each with `ItineraryItem[]`)
- `{tripId}/shops.json` — `Shop[]`
- `{tripId}/info.json` — `InfoItem[]`

To add a new trip: add its folder under `/public/data/`, populate the three JSON files, then add an entry to `trips.json`. No code changes are needed unless new data fields are introduced.

All TypeScript interfaces for data structures are defined in [src/types.ts](src/types.ts).

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
