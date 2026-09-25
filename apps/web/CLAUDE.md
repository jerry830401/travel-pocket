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

Users sign in with Google through Cloudflare Access, which sits in front of the whole site, so the app has no sign-in screen. The API sees the Access cookie on every same-origin request and returns only that user's trips; the app never sends a token.

Pages never call `fetch` for trip data themselves; they go through `src/dataSource.ts`:

- `loadTrips()` / `loadTripData(tripId, type)` resolve to `{ data, editable }`. With `VITE_API_URL` set they read the API; on the dev server a failed request falls back to the static JSON, while production builds (which ship no trip JSON) surface the error. Without `VITE_API_URL` they read the static JSON only.
- `editable` is true only for data read live from the API. The static fallback is never editable, and neither is a response the service worker answered from its cache (it marks those with the `X-Travel-Pocket-Cache` header, see [Offline](#offline)). Saves replace whole lists, so editing an old copy could overwrite newer data.
- Each page keeps its own `editable` state from its load and gates every edit control on it. `apiEnabled && !editable` (once loaded) shows `ReadOnlyBanner` to explain why the controls are gone.
- Writes: `saveTrips`, `saveTripData` (`PUT`), `createTrip` (`POST`, the server assigns the id) and `deleteTrip` (`DELETE`, which also removes the trip's itinerary, shops and info). All of them reject when there is no API.
- `loadMe()` returns the signed-in `Me`, or null. `signOut()` clears the `trip-api` cache and goes to `/cdn-cgi/access/logout`. Home shows the email, and shows 登出 outside the dev server, which has no Access.

| Command | Data source | Editable |
|---|---|---|
| `pnpm dev:web` (web `dev`) | Static JSON | No |
| `pnpm dev` (web `dev:fullstack` + API) | Local API (Vite proxies `/api` → wrangler on `:8787`, signed in as the API's dev user), static JSON when it fails | Yes, writes to the local D1 |
| Production build | The API (`VITE_API_URL`) | Yes, for the signed-in user |

`.env.fullstack` (committed) sets `VITE_API_URL=/api`; only `vite --mode fullstack` loads it. The API itself is `apps/api`; talk to it only over HTTP using the contract types from `@travel-pocket/shared`. Before the first `pnpm dev`, set up the local D1 as described in [apps/api/CLAUDE.md](../api/CLAUDE.md) (`db:migrate:local`, then `db:seed --owner dev@example.com`).

### Static JSON

On the dev server only, the static trip data is served from `${BASE_URL}data/`. The JSON files live in the `@travel-pocket/data` package ([packages/data/](../../packages/data/CLAUDE.md)), not in this app:

- `trips.json` — Array of `Trip` metadata (id, name, dates, cover image, snapshot path)
- `{tripId}/itinerary.json` — `ItineraryDay[]` (array of days, each with `ItineraryItem[]`)
- `{tripId}/shops.json` — `Shop[]`
- `{tripId}/info.json` — `InfoItem[]`

`vite-plugin-trip-data.ts` (`apply: "serve"`) serves them at `data/` straight from the package. It backs `pnpm dev:web`, the E2E tests and the dev-server fallback. Production builds do not include them: the trips are private to their owners, and `packages/data` only seeds an account (`db:seed --owner`). Only files that follow the contract layout (`ID_PATTERN` folders, `DATA_TYPES` file names) are served. Snapshot images are web-only assets and stay in `public/data/{tripId}/snapshot.jpg`, which the build still copies.

New trips are created in the app (首頁 → 新增旅程). The JSON in `packages/data/` is sample data for local development.

Data types come from `@travel-pocket/shared`; `src/types.ts` re-exports them so app code keeps importing from `../types`. New fields go into `packages/shared/src/types.ts`, not into this app.

Edits made in the browser go to the local D1, never back into `packages/data/`.

## Offline

- The service worker (`vite-plugin-pwa`, `generateSW`) caches GET `/api/` responses in `trip-api` (`NetworkFirst`, 7 days). When the network fails it answers from that cache and adds `X-Travel-Pocket-Cache: 1` (a `cachedResponseWillBeUsed` plugin in `vite.config.ts`), so `dataSource.ts` reports the data as not editable. The plugin is serialized into the service worker, so it repeats the header name instead of importing `SW_CACHE_HEADER`.
- `signOut()` deletes `trip-api`, so the next person on the same device never sees the previous user's trips.

## Theming

Dark/light mode is class-based (`.dark` on `<html>`). `ThemeContext.tsx` reads/writes `localStorage` and respects `prefers-color-scheme` as a default. All Tailwind dark variants use `dark:` prefix.

## Key Libraries

| Library | Usage |
|---|---|
| `framer-motion` | Bottom sheet modal slide-up, page transitions |
| `date-fns` | Time formatting and duration calculations in `Schedule.tsx` |
| `lucide-react` | Category icons mapped by `ItineraryItem.category` string |
| `clsx` | Conditional className construction |
| `vite-plugin-pwa` | Service worker, offline caching of GET `/api/` responses (see [Offline](#offline)) |

## Testing

| Layer | Tool | Location |
|---|---|---|
| Unit / component | Vitest + React Testing Library + jsdom | `src/**/*.test.tsx` |
| E2E | Playwright (Chromium only) | `e2e/*.spec.ts` |

- Vitest setup file is at `src/test/setup.ts` — patches `matchMedia` for jsdom and runs `cleanup` after each test
- Unit tests run without `VITE_API_URL`, so page tests exercise the static path by spying on `globalThis.fetch`. `src/dataSource.test.ts` covers API mode with `vi.stubEnv` plus a fresh `import()` after `vi.resetModules()`, because `dataSource.ts` reads `import.meta.env` at load time
- `src/pages/Home.account.test.tsx` covers Home as a signed-in user (account line, add / delete trip, empty state, read-only data) by mocking `../dataSource` at the module boundary
- E2E tests run against the dev server at `http://localhost:5173/travel-pocket/`; Playwright starts it automatically via `webServer` in `playwright.config.ts`. That is web's own `pnpm dev` (static mode), so E2E never needs the API

## Build & Deploy

- Base path is `/travel-pocket/` (set in `vite.config.ts`) — required for GitHub Pages
- TypeScript strict mode is on (`noUnusedLocals`, `noUnusedParameters`)
- Tailwind typography plugin is used for markdown-style content in `Info.tsx`
- Mobile-first layout: main container is capped at `max-width: 480px`
- `.github/workflows/deploy.yml` (at the repo root) builds and publishes `dist/` to GitHub Pages on pushes to `master` that touch `apps/web/`, `packages/shared/`, `packages/data/`, or root workspace files
