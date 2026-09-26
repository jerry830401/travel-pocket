# apps/web

Guidance for `@travel-pocket/web`, the frontend PWA. Repo-wide rules — including the mandatory Isolation Rules — live in the root [CLAUDE.md](../../CLAUDE.md). Paths in this file are relative to `apps/web/`.

Travel Pocket is a mobile-optimized PWA for managing travel itineraries, built with React + Vite and deployed to Cloudflare Workers behind Cloudflare Access.

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
pnpm -F @travel-pocket/web preview         # Preview the production build locally (vite preview, proxies /api like dev)
pnpm -F @travel-pocket/web preview:worker  # Serve dist/ through the production Worker on :8788 (build first; start the API for /api)
pnpm -F @travel-pocket/web run deploy      # Build, then wrangler deploy (`run` is required: `pnpm deploy` is a pnpm built-in)
pnpm -F @travel-pocket/web cf-typegen      # Regenerate worker/worker-configuration.d.ts
```

## Routing

Uses **HashRouter** (not BrowserRouter): every route is served by `index.html`, so the static assets need no fallback rules. Routes follow the pattern `/#/trip/{tripId}/schedule`, `/#/trip/{tripId}/shops`, `/#/trip/{tripId}/info`. `/#/settings` is the 設定 page (theme and account), reached only from the gear link in Home's header. `/#/join/{code}` is the join page an invite link opens (see [Sharing](#sharing)).

`TripView.tsx` is the nested layout shell; it fetches trip data and passes it down to child routes via `useOutletContext`.

## Data

Users sign in with Google through Cloudflare Access, which sits in front of the whole site, so the app has no sign-in screen. The API sees the Access cookie on every same-origin request and returns only the trips that user owns or shares; the app never sends a token.

Pages never call `fetch` for trip data themselves; they go through `src/dataSource.ts`:

- `loadTrips()` / `loadTripData(tripId, type)` resolve to `{ data, editable, version }`. With `VITE_API_URL` set they read the API; on the dev server a failed request falls back to the static JSON, while production builds (which ship no trip JSON) surface the error. Without `VITE_API_URL` they read the static JSON only.
- `editable` is true only for data read live from the API. The static fallback is never editable, and neither is a response the service worker answered from its cache (it marks those with the `X-Travel-Pocket-Cache` header, see [Offline](#offline)). Saves replace whole lists, so editing an old copy could overwrite newer data.
- Versions (#31): every save names the version its data was read at, and the API refuses it (412) when someone else saved in between. `loadTripData`'s `version` comes from the response's `ETag` (null for the static JSON; in production Cloudflare weakens it to `W/"<n>"` whenever it compresses the response, so it is read with `parseETagVersion`, never the strict `parseVersionTag`); `loadTrips` returns `TripEntry`s, each with the `version` of its fields (0 for the static JSON). `saveTripData(tripId, type, data, version)` and `updateTrip(tripId, fields, version)` send it as `If-Match` and resolve with the new version (`updateTrip` with the whole `TripEntry`); `uploadCover` returns the trip's new version too. A refused save throws `ConflictError`. The trip pages keep their list's version in a ref, set on every load and after every save.
- Each page keeps its own `editable` state from its load. `apiEnabled && !editable` (once loaded) shows `ReadOnlyBanner` to explain why the controls are gone.
- Pages open in view mode and edit a draft. Each page (Home, Schedule, Shops, Info) holds its list in `useEditSession` (`src/components/editor/useEditSession.ts`), which keeps the saved data and a draft. `EditControls` shows 編輯 in view mode and 取消／完成 while editing, and only when `editable`. They are round icon buttons named by `aria-label` (no `title`: the cards' `EditBtn` is found by its title 「編輯」). Every edit control (`EditBtn`, `DeleteBtn`, `AddBtn`, `EditModal`) is gated on `editable && editing` (and hidden while saving). `EditModal`'s 確定 only changes the draft.
  - 完成 saves the draft if it changed, shows a 「已儲存」 toast and returns to view mode. On failure it shows 「儲存失敗：…」 and stays in edit mode with the draft intact, so 完成 can be retried.
  - When the save throws `ConflictError`, the draft is dropped instead (keeping only the steps that already went through), the page leaves edit mode, shows 「別人剛修改過，已載入最新版本」 and loads its data again through the `reload` option each page passes to `useEditSession` (along with `lockNav`).
  - 取消 drops the draft (after a confirm when there are changes).
  - The trip pages save with one `saveTripData`. Home's save (`makeSaveTripList`) runs `deleteTrip` for removed trips, `createTrip` for trips added in the draft (placeholder ids start with `new:`, which never matches `ID_PATTERN`), `uploadCover` for covers picked in the draft, then `updateTrip` for each trip whose fields changed. It reports each step through `progress`, so a retry after a failure skips what already went through. After an upload the draft takes the trip's new version only when it is the next one; otherwise someone else saved the trip meanwhile, and its other edits go out at the old version, so the API refuses them.
  - Covers: Home's modal picks one with `FieldImage`. `resizeImage` (`src/resizeImage.ts`) scales the photo to a JPEG of at most `MAX_COVER_BYTES`; the draft shows it from a `blob:` URL while the `Blob` waits in `pendingCovers`, keyed by that URL. On 完成, `uploadCover` sends it to `PUT /api/trips/:tripId/cover` (a new trip is created with `coverImage: ""` first), and the trip takes the URL the API returns. The object URLs are revoked once editing ends. 移除 sets `coverImage` to `""`, and the API drops the stored image when `updateTrip` saves that. A trip without a cover shows a placeholder on its card. Cover images are `GET /api/` responses, so the service worker caches them in `trip-api` like the data.
  - Nothing is stored, so leaving the page drops the draft. To prevent that, editing locks navigation: Home disables the trip cards and the 設定 link; the trip pages pass `lockNav` (`setNavLocked` from `TripOutletContext`), which disables `TripView`'s back link and replaces its tabs with the page's add buttons. Locked links use `lockedLink` (`src/components/lockedLink.ts`).
- `EditControls` sits at the right of the header. Home renders it in its own header, next to the 設定 link. The trip header belongs to `TripView`, so it passes `editSlot` (an element at the right end of the header) through the outlet context, and each tab page portals its `EditControls` into it with `createPortal`. Every header's round buttons (back ‹, 設定, the edit controls) share the `circleBtn` style (`src/components/circleBtn.ts`).
- The add buttons (新增旅程, 新增行程 and 新增日, 新增店家, 新增類別) sit in a bottom bar while editing, so they can be reached without scrolling. They use `AddBtn`'s `bar` size inside `BottomBar` (`src/components/BottomBar.tsx`), which keeps its height while they are hidden during a save. `TripView`'s bottom bar shows the tabs, or while `setNavLocked(true)` is in effect, `actionSlot` (from the outlet context), where each tab page portals its add buttons. Home, which has no tabs, shows its own `BottomBar` while editing. Adds that belong to one card (新增連結 in Info) stay in the card.
- Toasts come from `ToastProvider` (`src/contexts/ToastContext.tsx`, in `App.tsx`): `useToast().showToast(message, "success" | "error")`. One at a time, above the bottom nav; success is `role="status"`, error is `role="alert"`.
- Writes: `updateTrip`, `saveTripData` (`PUT`, with `If-Match`), `createTrip` (`POST`, the server assigns the id), `deleteTrip` (`DELETE`, which also removes the trip's itinerary, shops, info and cover) and `uploadCover` (`PUT` with the image as the body; resolves with the trip's new `coverImage` and `version`). All of them reject when there is no API.
- Sharing calls: `loadMembers`, `createInvite`, `approveMember`, `removeMember`, `loadInvite` (null for an unknown code) and `requestJoin`; `inviteLink(code)` builds the link to hand out, and `isShared(trip)` tells a shared trip from a personal one. They all need the API.
- `loadMe()` returns the signed-in `Me`, or null. `signOut()` clears the `trip-api` cache and goes to `/cdn-cgi/access/logout`. The 設定 page (`src/pages/Settings.tsx`) shows the email, and shows 登出 outside the dev server, which has no Access.
- Signed out: Access answers every request without a session by redirecting to its login page (which shows a 「Google」 button; instant authentication is off, so nobody is sent to Google without clicking). API calls use `redirect: "manual"`, so that redirect (or a 401) becomes a `SignInRequiredError` and notifies `onSignedOut` listeners instead of failing as a cross-origin fetch. `SignInGate` (around the routes in `App.tsx`) then replaces the app with a 「請先登入」 screen whose 前往登入 button reloads through the network (`goToSignIn`). Nothing redirects on its own. This covers the app opening from the service worker (after the session expired) and a session ending while the app is open.

| Command | Data source | Editable |
|---|---|---|
| `pnpm dev:web` (web `dev`) | Static JSON | No |
| `pnpm dev` (web `dev:fullstack` + API) | Local API (Vite proxies `/api` → wrangler on `:8787`, signed in as the API's dev user), static JSON when it fails | Yes, writes to the local D1 |
| Production build | The API (`VITE_API_URL`) | Yes, for the signed-in user |

`.env.fullstack` (committed) sets `VITE_API_URL=/api`; only `vite --mode fullstack` loads it. The API itself is `apps/api`; talk to it only over HTTP using the contract types from `@travel-pocket/shared`. Before the first `pnpm dev`, set up the local D1 as described in [apps/api/CLAUDE.md](../api/CLAUDE.md) (`db:migrate:local`, then `db:seed --owner dev@example.com`).

### Sharing

A trip is personal until its owner approves someone; then it is shared (#32). `loadTrips` returns each trip's `role` (`owner` or `member`), `ownerEmail`, `memberCount` and, for the owner, `pendingCount`; the static JSON's trips read as the viewer's own personal ones.

- Home lists every trip in one list, newest first by `startDate`, then `endDate` (#36), so shared trips sit among the personal ones rather than below them. Draft changes (a new trip, new dates) move the card at once. With the API, a 全部／個人／共享 filter (`role="group"` 「篩選旅程」, buttons with `aria-pressed`) sits above the list and tells them apart with `isShared`. It is kept in `sessionStorage` (`home-filter`), so it survives opening a trip and coming back, and the app opens on 全部. Adding a trip under 共享 switches to 全部, since a new trip is personal. An empty filter shows 「沒有個人旅程」 or, for 共享, how to invite someone. A shared card says who shares it (「{owner} 分享」 or 「與 N 人共享」) and, for the owner, 「✋ N 人申請加入」. In edit mode a member's trip has 編輯 but no 刪除: members leave instead.
- `TripView`'s header has a 👥 button (「成員」) while the data is live and the page is not editing. It opens `ShareSheet` (`src/components/ShareSheet.tsx`), which acts at once rather than through a draft. The owner creates and copies (or, with `navigator.share`, shares) the invite link, approves or turns down requests and removes members; a member sees who shares the trip and can leave, after which `TripView` returns to Home. `ShareSheet` and `EditModal` share the bottom `Sheet` (`src/components/editor/index.tsx`), a `role="dialog"` named by its title.
- Invite links are `/?join=<code>`, not a hash route: Cloudflare Access sends a signed-out visitor back to the path and query after sign-in, but never sees the hash. `routeJoinLink` (`src/joinLink.ts`, run in `main.tsx` before the router starts) moves the code to `#/join/<code>`. The join page (`src/pages/Join.tsx`) shows the trip and its owner and offers 申請加入; after that it says the request waits for the owner, and for a member or the owner it links to the trip. An unknown or malformed code reads as an invalid link.

### Schedule

Schedule orders its days by date whenever a day is added or edited (#35). It shows each day's items in time order (`sortItems` in `src/pages/scheduleUtils.ts`, #37): by `startTime`, or by `endTime` for an item with only that (an arrival); an item with neither stays after the one before it, and ties keep their order. Only the display is sorted, so a new or retimed item moves as soon as its modal's 確定 is pressed, the saved list keeps its own order, and old data needs no resave. An item after midnight sorts to the top of its day.

### Static JSON

On the dev server only, the static trip data is served from `${BASE_URL}data/`. The JSON files live in the `@travel-pocket/data` package ([packages/data/](../../packages/data/CLAUDE.md)), not in this app:

- `trips.json` — Array of `Trip` metadata (id, name, dates, cover image URL)
- `{tripId}/itinerary.json` — `ItineraryDay[]` (array of days, each with `ItineraryItem[]`)
- `{tripId}/shops.json` — `Shop[]`
- `{tripId}/info.json` — `InfoItem[]`

`vite-plugin-trip-data.ts` (`apply: "serve"`) serves them at `data/` straight from the package. It backs `pnpm dev:web`, the E2E tests and the dev-server fallback. Production builds do not include them: the trips are private to their owners, and `packages/data` only seeds an account (`db:seed --owner`). Only files that follow the contract layout (`ID_PATTERN` folders, `DATA_TYPES` file names) are served. The sample trips' cover images are web-only assets and stay in `public/data/{tripId}/snapshot.jpg` (their `coverImage` is `/data/{tripId}/snapshot.jpg`), which the build still copies.

New trips are created in the app (首頁 → 新增旅程). The JSON in `packages/data/` is sample data for local development.

Data types come from `@travel-pocket/shared`; `src/types.ts` re-exports them so app code keeps importing from `../types`. New fields go into `packages/shared/src/types.ts`, not into this app.

Edits made in the browser go to the local D1, never back into `packages/data/`.

## Offline

- The service worker (`vite-plugin-pwa`, `generateSW`) caches GET `/api/` responses in `trip-api` (`NetworkFirst`, 7 days). When the network fails it answers from that cache and adds `X-Travel-Pocket-Cache: 1` (a `cachedResponseWillBeUsed` plugin in `vite.config.ts`), so `dataSource.ts` reports the data as not editable. The plugin is serialized into the service worker, so it repeats the header name instead of importing `SW_CACHE_HEADER`.
- `signOut()` deletes `trip-api`, so the next person on the same device never sees the previous user's trips.
- Page loads always go to the network (`NetworkOnly`), so Access sees them and can redirect a signed-out visitor to its login page. Its callback `/cdn-cgi/access/authorized`, which sets the session cookie, is never touched by the service worker. `navigateFallback` and `directoryIndex` are `null` on purpose: either one would answer `/` with the precached `index.html` and skip Access. Only when the network fails (offline) does the navigation rule fall back to that precached copy (`handlerDidError`). Both cache rules keep only `200` responses, never Access's redirect.

## Theming

Dark/light mode is class-based (`.dark` on `<html>`). The user picks 淺色, 深色 or 跟隨系統 on the 設定 page; no other page has a theme button. `ThemeContext.tsx` holds that `preference` (`light` / `dark` / `system`) and the resulting `theme`. `light` and `dark` are stored in `localStorage` (`theme`); `system`, the default, removes the key and follows `prefers-color-scheme`, including changes while the app is open. All Tailwind dark variants use `dark:` prefix.

## Key Libraries

| Library | Usage |
|---|---|
| `framer-motion` | Bottom sheet modal slide-up, page transitions |
| `vite-plugin-pwa` | Service worker, offline caching of GET `/api/` responses (see [Offline](#offline)) |

## Testing

| Layer | Tool | Location |
|---|---|---|
| Unit / component | Vitest + React Testing Library + jsdom | `src/**/*.test.tsx` |
| E2E | Playwright (Chromium only) | `e2e/*.spec.ts` |

- Vitest setup file is at `src/test/setup.ts` — patches `matchMedia` for jsdom and runs `cleanup` after each test
- Unit tests run without `VITE_API_URL`, so page tests exercise the static path by spying on `globalThis.fetch`. `src/dataSource.test.ts` covers API mode with `vi.stubEnv` plus a fresh `import()` after `vi.resetModules()`, because `dataSource.ts` reads `import.meta.env` at load time
- `src/pages/Home.account.test.tsx` covers Home as a signed-in user (the header, edit mode, add / edit / delete trip, picking and removing a cover, a failed save and its retry, a version conflict, the date order and the 全部／個人／共享 filter, empty state, read-only data) by mocking `../dataSource` at the module boundary, and `../resizeImage` (jsdom has no canvas; `fitWithin` is tested on its own) with `URL.createObjectURL` stubbed; `src/pages/tripPages.editMode.test.tsx` does the same for the edit mode of Schedule, Shops and Info, and `src/pages/Settings.test.tsx` for the 設定 page (theme options, account, 登出). `src/components/editor/useEditSession.test.tsx` covers the draft, 取消, 完成 and the toasts on their own. Sharing is covered the same way by `src/components/ShareSheet.test.tsx` (owner and member), `src/pages/Join.test.tsx`, `src/pages/TripView.share.test.tsx` (the 👥 button) and `src/joinLink.test.ts`
- Tests that check a toast wrap the page in `ToastProvider`; without it, `useToast()` is a no-op
- E2E tests run against the dev server at `http://localhost:5173/`; Playwright starts it automatically via `webServer` in `playwright.config.ts`. That is web's own `pnpm dev` (static mode), so E2E never needs the API

## Build & Deploy

- Deployed to Cloudflare Workers as the `travel-pocket` Worker (`wrangler.jsonc`), at `https://travel-pocket.travel-pocket-web.workers.dev`, which Cloudflare Access protects. Static assets come from `dist/`. `assets.run_worker_first: ["/api/*"]` sends only API calls to `worker/index.ts`, which forwards them unchanged, Access headers included, to the API Worker (`travel-pocket-api`) through the `API` service binding, and answers 503 when that Worker is unreachable. The app and its API therefore share one origin.
- `worker/` is typed with its own `tsconfig.worker.json` and the generated `worker/worker-configuration.d.ts` (`cf-typegen`); rerun it after changing `wrangler.jsonc`. `worker/index.test.ts` runs with the unit tests.
- `.env.production` sets `VITE_API_URL=/api` for every `vite build`.
- Base path is `/` (`vite.config.ts`, the PWA manifest, `index.html`).
- TypeScript strict mode is on (`noUnusedLocals`, `noUnusedParameters`)
- Mobile-first layout: main container is capped at `max-width: 480px`
- `.github/workflows/deploy.yml` (at the repo root) tests, builds and runs `wrangler deploy` on pushes to `master` that touch `apps/web/`, `packages/shared/`, `packages/data/`, or root workspace files. It needs the repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, and the API Worker must already be deployed, since the service binding points at it.
