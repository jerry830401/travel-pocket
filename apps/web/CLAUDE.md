# apps/web

Guidance for `@travel-pocket/web`, the frontend PWA. Repo-wide rules — including the mandatory Isolation Rules — live in the root [CLAUDE.md](../../CLAUDE.md). Paths in this file are relative to `apps/web/`.

Travel Pocket is a mobile-optimized PWA for managing travel itineraries, built with React + Vite and deployed to GitHub Pages.

## Commands

Run from the repo root (or drop the `-F @travel-pocket/web` prefix when inside `apps/web/`):

```bash
pnpm -F @travel-pocket/web dev             # Vite dev server with HMR (same as root `pnpm dev` / `pnpm dev:web`)
pnpm -F @travel-pocket/web build           # tsc -b + Vite build to dist/
pnpm -F @travel-pocket/web lint            # ESLint
pnpm -F @travel-pocket/web test            # Vitest unit tests
pnpm -F @travel-pocket/web test:watch      # Vitest watch mode
pnpm -F @travel-pocket/web test:coverage   # Vitest with V8 coverage report
pnpm -F @travel-pocket/web test:e2e        # Playwright E2E tests (auto-starts dev server)
pnpm -F @travel-pocket/web test:e2e:ui     # Playwright interactive UI
pnpm -F @travel-pocket/web preview         # Preview the production build locally
pnpm -F @travel-pocket/web run deploy      # Build then push dist/ via gh-pages (`run` is required: `pnpm deploy` is a pnpm built-in)
```

## Routing

Uses **HashRouter** (not BrowserRouter) — required for GitHub Pages static hosting. Routes follow the pattern `/#/trip/{tripId}/schedule`, `/#/trip/{tripId}/shops`, `/#/trip/{tripId}/info`.

`TripView.tsx` is the nested layout shell; it fetches trip data and passes it down to child routes via `useOutletContext`.

## Data

All trip data is **static JSON** fetched at runtime from `public/data/`:

- `trips.json` — Array of `Trip` metadata (id, name, dates, cover image, snapshot path)
- `{tripId}/itinerary.json` — `ItineraryDay[]` (array of days, each with `ItineraryItem[]`)
- `{tripId}/shops.json` — `Shop[]`
- `{tripId}/info.json` — `InfoItem[]`

To add a new trip: add its folder under `public/data/`, populate the three JSON files, then add an entry to `trips.json`. No code changes are needed unless new data fields are introduced.

Data types come from `@travel-pocket/shared`; `src/types.ts` re-exports them so app code keeps importing from `../types`. New fields go into `packages/shared/src/types.ts`, not into this app.

`vite-plugin-data-editor.ts` is a dev-server-only plugin (`apply: "serve"`) that exposes `GET`/`POST /api/data/trips` and `/api/data/{tripId}/{type}` to read and write the JSON files under `public/data/`; `src/hooks/useDataEditor.ts` is its client. It is not part of the production build.

## Theming

Dark/light mode is class-based (`.dark` on `<html>`). `ThemeContext.tsx` reads/writes `localStorage` and respects `prefers-color-scheme` as a default. All Tailwind dark variants use `dark:` prefix.

## Key Libraries

| Library | Usage |
|---|---|
| `framer-motion` | Bottom sheet modal slide-up, page transitions |
| `date-fns` | Time formatting and duration calculations in `Schedule.tsx` |
| `lucide-react` | Category icons mapped by `ItineraryItem.category` string |
| `clsx` | Conditional className construction |
| `vite-plugin-pwa` | Service worker, offline caching (7-day expiry for JSON data) |

## Testing

| Layer | Tool | Location |
|---|---|---|
| Unit / component | Vitest + React Testing Library + jsdom | `src/**/*.test.tsx` |
| E2E | Playwright (Chromium only) | `e2e/*.spec.ts` |

- Vitest setup file is at `src/test/setup.ts` — patches `matchMedia` for jsdom and runs `cleanup` after each test
- E2E tests run against the dev server at `http://localhost:5173/travel-pocket/`; Playwright starts it automatically via `webServer` in `playwright.config.ts`

## Build & Deploy

- Base path is `/travel-pocket/` (set in `vite.config.ts`) — required for GitHub Pages
- TypeScript strict mode is on (`noUnusedLocals`, `noUnusedParameters`)
- Tailwind typography plugin is used for markdown-style content in `Info.tsx`
- Mobile-first layout: main container is capped at `max-width: 480px`
- `.github/workflows/deploy.yml` (at the repo root) builds and publishes `dist/` to GitHub Pages on pushes to `master` that touch `apps/web/`, `packages/shared/`, or root workspace files
