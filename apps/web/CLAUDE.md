# apps/web

Guidance for `@travel-pocket/web`, the frontend PWA. Repo-wide rules — including the mandatory Isolation Rules — live in the root [CLAUDE.md](../../CLAUDE.md). Paths in this file are relative to `apps/web/`.

Travel Pocket is a mobile-optimized PWA for managing travel itineraries, built with React + Vite and deployed to GitHub Pages.

## Commands

Run from the repo root (or drop the `-F @travel-pocket/web` prefix when inside `apps/web/`):

```bash
pnpm -F @travel-pocket/web dev             # Vite dev server, static JSON, read-only (same as root `pnpm dev:web`)
pnpm -F @travel-pocket/web dev:fullstack   # Vite in mode `fullstack`: reads/writes the API through the proxy (root `pnpm dev` runs it alongside the API)
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

Pages never call `fetch` for trip data themselves; they go through `src/dataSource.ts`:

- `loadTrips()` / `loadTripData(tripId, type)` — with `VITE_API_URL` set, read from the API and fall back to the static JSON when the request fails; without it, read the static JSON only.
- `saveTrips(trips)` / `saveTripData(tripId, type, data)` — `PUT` to the API with `Authorization: Bearer ${VITE_ADMIN_TOKEN}`; no-ops unless `isDevMode`.
- `isDevMode` (`import.meta.env.DEV && apiEnabled`) gates every edit control (`isDevMode && …`).

| Command | Data source | Editable |
|---|---|---|
| `pnpm dev:web` (web `dev`) | Static JSON | No |
| `pnpm dev` (web `dev:fullstack` + API) | Local API (Vite proxies `/api` → wrangler on `:8787`), static JSON when it fails | Yes, writes to the local D1 |
| Production build | API when `VITE_API_URL` is set at build time, otherwise static JSON | No |

`.env.fullstack` (committed) sets `VITE_API_URL=/api` and `VITE_ADMIN_TOKEN=dev-token`. Only `vite --mode fullstack` loads it, so the token never reaches a production build. The API itself is `apps/api`; talk to it only over HTTP using the contract types from `@travel-pocket/shared`. Before the first `pnpm dev`, set up the local D1 as described in [apps/api/CLAUDE.md](../api/CLAUDE.md) (`.dev.vars`, `db:migrate:local`, `db:seed`).

### Static JSON

The static trip data is fetched from `${BASE_URL}data/`. The JSON files live in the `@travel-pocket/data` package ([packages/data/](../../packages/data/CLAUDE.md)), not in this app:

- `trips.json` — Array of `Trip` metadata (id, name, dates, cover image, snapshot path)
- `{tripId}/itinerary.json` — `ItineraryDay[]` (array of days, each with `ItineraryItem[]`)
- `{tripId}/shops.json` — `Shop[]`
- `{tripId}/info.json` — `InfoItem[]`

`vite-plugin-trip-data.ts` publishes them at `data/`: the dev server reads them straight from the package, and the build emits them into `dist/data/`. Only files that follow the contract layout (`ID_PATTERN` folders, `DATA_TYPES` file names) are published. Snapshot images are web-only assets and stay in `public/data/{tripId}/snapshot.jpg`; both end up under the same `data/` URL.

To add a new trip: add its JSON files to `packages/data/` (see that package's `CLAUDE.md`) and, optionally, a snapshot image under `public/data/{tripId}/`. No code changes are needed unless new data fields are introduced.

Data types come from `@travel-pocket/shared`; `src/types.ts` re-exports them so app code keeps importing from `../types`. New fields go into `packages/shared/src/types.ts`, not into this app.

Edits made in the browser go to the local D1, never back into `packages/data/`.

## Theming

Dark/light mode is class-based (`.dark` on `<html>`). `ThemeContext.tsx` reads/writes `localStorage` and respects `prefers-color-scheme` as a default. All Tailwind dark variants use `dark:` prefix.

## Key Libraries

| Library | Usage |
|---|---|
| `framer-motion` | Bottom sheet modal slide-up, page transitions |
| `date-fns` | Time formatting and duration calculations in `Schedule.tsx` |
| `lucide-react` | Category icons mapped by `ItineraryItem.category` string |
| `clsx` | Conditional className construction |
| `vite-plugin-pwa` | Service worker, offline caching (`NetworkFirst`, 7-day expiry for the data JSON and for GET `/api/` responses) |

## Testing

| Layer | Tool | Location |
|---|---|---|
| Unit / component | Vitest + React Testing Library + jsdom | `src/**/*.test.tsx` |
| E2E | Playwright (Chromium only) | `e2e/*.spec.ts` |

- Vitest setup file is at `src/test/setup.ts` — patches `matchMedia` for jsdom and runs `cleanup` after each test
- Unit tests run without `VITE_API_URL`, so page tests exercise the static path by spying on `globalThis.fetch`. `src/dataSource.test.ts` covers API mode with `vi.stubEnv` plus a fresh `import()` after `vi.resetModules()`, because `dataSource.ts` reads `import.meta.env` at load time
- E2E tests run against the dev server at `http://localhost:5173/travel-pocket/`; Playwright starts it automatically via `webServer` in `playwright.config.ts`. That is web's own `pnpm dev` (static mode), so E2E never needs the API

## Build & Deploy

- Base path is `/travel-pocket/` (set in `vite.config.ts`) — required for GitHub Pages
- TypeScript strict mode is on (`noUnusedLocals`, `noUnusedParameters`)
- Tailwind typography plugin is used for markdown-style content in `Info.tsx`
- Mobile-first layout: main container is capped at `max-width: 480px`
- `.github/workflows/deploy.yml` (at the repo root) builds and publishes `dist/` to GitHub Pages on pushes to `master` that touch `apps/web/`, `packages/shared/`, `packages/data/`, or root workspace files
