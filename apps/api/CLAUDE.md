# apps/api

Guidance for `@travel-pocket/api`, the backend API. Repo-wide rules — including the mandatory Isolation Rules — live in the root [CLAUDE.md](../../CLAUDE.md). Paths in this file are relative to `apps/api/`.

Hono app running on Cloudflare Workers, storing trip data in D1. Every user signs in with Google through Cloudflare Access and sees only their own trips. Locally, `wrangler dev` simulates D1 in `.wrangler/state/`; no Cloudflare account and no frontend are needed.

## Commands

Run from the repo root (or drop the `-F @travel-pocket/api` prefix when inside `apps/api/`):

```bash
pnpm -F @travel-pocket/api db:migrate:local   # Apply migrations/ to the local D1 (run once, and after adding a migration)
pnpm -F @travel-pocket/api db:seed --owner dev@example.com            # Import @travel-pocket/data into an account in the local D1
pnpm -F @travel-pocket/api db:seed --owner you@example.com --remote   # … into the production D1
pnpm -F @travel-pocket/api dev                # wrangler dev on :8787, signed in as dev@example.com (same as root `pnpm dev:api`)
pnpm -F @travel-pocket/api build              # Type check only (tsc -b)
pnpm -F @travel-pocket/api lint               # ESLint
pnpm -F @travel-pocket/api test               # Vitest inside workerd (@cloudflare/vitest-plugin)
pnpm -F @travel-pocket/api cf-typegen         # Regenerate worker-configuration.d.ts
pnpm -F @travel-pocket/api db:migrate:remote  # Apply migrations to the remote D1
pnpm -F @travel-pocket/api run deploy         # wrangler deploy (`run` is required: `pnpm deploy` is a pnpm built-in)
```

Local setup: `db:migrate:local`, then `db:seed --owner dev@example.com` so the dev account has the sample trips. No `.dev.vars` is needed.

`db:seed` writes SQL straight to D1 with `wrangler d1 execute` (`--local` by default, `--remote` for production); it never goes through the API, so the API has no admin access to protect. The account is created if needed. Running it again replaces the imported data. If any trip id already belongs to another account, it writes nothing. Remote access comes from your `wrangler login`.

## Authentication

- In production, Cloudflare Access sits in front of the Worker and passes the user's JWT in `Cf-Access-Jwt-Assertion`. `src/auth.ts` verifies it against the team's public keys (`https://<ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs`, RS256) and checks `iss` and `aud` (`ACCESS_AUD`). Without both vars set, no JWT is accepted.
- Locally there is no Access. The `dev` scripts pass `--var DEV_USER_EMAIL:dev@example.com`, and requests to `localhost` / `127.0.0.1` without a JWT act as that user. The var never applies to other hosts, and is never configured for a deployed Worker. To act as someone else locally, run `wrangler dev --var DEV_USER_EMAIL:<email>`.
- The email (lowercased) identifies the user. The first request from a new email creates the `users` row (`ensureUser`).
- Every route except `/health` requires a user (401 otherwise); sign-in is checked before the request is validated.

## API

All routes live under `/api` (`basePath`). Data shapes, the `Me` / `NewTrip` / `CoverUpload` request and response types, and the `ID_PATTERN` / `DATA_TYPES` / `MAX_COVER_BYTES` validation constants come from `@travel-pocket/shared`.

| Route | Behavior |
|---|---|
| `GET /health` | `{ ok: true }`; no sign-in |
| `GET /me` | `Me`: the signed-in user's email |
| `GET /trips` | The user's `Trip[]`, ordered by `position` |
| `POST /trips` | Creates a trip from a `NewTrip` under a server-assigned id, after the user's last trip; 201 with the `Trip` |
| `PUT /trips` | Upsert only — never deletes trip rows. Array index becomes `position`. Drops the user's uploaded covers that their trip's `coverImage` no longer points at. 409 (and nothing written) if any id belongs to another user |
| `DELETE /trips/:tripId` | Deletes the trip; its itinerary, shops, info and cover cascade. 404 if the trip does not exist or belongs to another user |
| `GET /trips/:tripId/cover` | The uploaded cover image, with its stored `Content-Type`, `Cache-Control: private, max-age=31536000, immutable` and `nosniff`; 404 if there is none or the trip belongs to another user |
| `PUT /trips/:tripId/cover` | Body is the image itself (at most `MAX_COVER_BYTES`, else 413). Only JPEG, PNG and WebP are kept, judged by the bytes rather than the header (400 otherwise, SVG included). Points the trip's `coverImage` at `/api/trips/:tripId/cover?v=<time>` and returns it as `CoverUpload`; 404 like `GET` |
| `GET /trips/:tripId/:type` | `TripDataMap[type]`; 404 if the trip does not exist or belongs to another user |
| `PUT /trips/:tripId/:type` | Replaces the trip's data of that type in one `DB.batch()` (one transaction); 404 like `GET` |

- 400 for an invalid `tripId`, unknown `type`, a body of the wrong shape or not JSON, or data that violates a table constraint (missing field, duplicate id).
- The two cover routes are registered before `/trips/:tripId/:type`, which would otherwise take `cover` for a type.
- Trip ids are global (`trips.id` is the primary key). Only `db:seed` brings in existing ids; everything else gets a server-assigned one from `POST /trips`.
- CORS allows only the comma-separated origins in the `CORS_ORIGINS` var. In production the web app is served from the same origin, so this only matters for local tools.

## Data Layer

- `migrations/0001_init.sql` — `trips`, `itinerary_days`, `itinerary_items`, `shops`, `info_items`. `migrations/0002_users.sql` — `users`, and rebuilds `trips` with `owner_id` (existing trips were dropped; they had no owner). `migrations/0003_trip_covers.sql` — `trip_covers` (one uploaded image per trip, as a BLOB), and merges the old `snapshot` path into `cover_image` before dropping the column. Every child table cascades from its parent (`users` → `trips` → the rest), and D1 enforces foreign keys by default, so **`PUT /trips` must stay an upsert**: deleting or replacing a trip row wipes its itinerary, shops and info. Only `DELETE /trips/:tripId` removes trip rows, on purpose.
- `src/db/writes.ts` — every write, as plain `Statement`s (`src/db/statements.ts`: SQL with `?1`-style params). The API runs them through `src/db/run.ts`; `scripts/seed.ts` renders them to SQL text with `toSqlText` (params inlined as literals, one statement per line). These files, and `src/db/seed.ts` (the seed's statements and queries) and `src/email.ts`, must stay free of D1 types so the Node script can import them.
- `src/db/statements.ts` — `SqlValue` may be an `ArrayBuffer`, which D1 stores as a BLOB and `toSqlText` inlines as `X'…'`.
- Covers live in `trip_covers`, apart from `trips`, so listing trips never reads an image. `saveCoverStatements` stores one and points `cover_image` at it in one batch; the URL carries a version so caches never serve an old image. A cover is kept only while its trip's `cover_image` still starts with `/api/trips/<id>/cover` (`deleteStaleCoversStatement`, run with every `PUT /trips`). `src/db/covers.ts` reads and saves them; `src/image.ts` recognizes the formats.
- `src/db/<type>.ts` — row types, row → shared type converters (`toTrip`, `toShop`, …) and queries. `src/db/users.ts` binds emails to user ids. `src/db/index.ts` dispatches by `DataType`.
- Array and nested values (`tags`, `links`, `description`) are stored as JSON text. `day` is stored as text, so numeric days come back as strings. `category` has no CHECK constraint because real data uses values outside the union type.
- Writes pass the whole array as one JSON parameter and insert it with `INSERT … SELECT … FROM json_each(?)`. This keeps each request at a fixed, small number of statements regardless of data size (the Free plan allows 50 queries per invocation and 100 bound parameters per query). Keep new write paths in this form rather than one `INSERT` per row.

## Configuration

- `wrangler.jsonc` — D1 binding `DB` (`database_name: travel-pocket`; `--remote` commands also need its `database_id` from `wrangler d1 create`); vars `CORS_ORIGINS`, `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` (the last two stay empty until Access is set up in #5). `secrets.required` is an empty list on purpose: it stops `wrangler types` and `wrangler dev` from reading a local `.dev.vars`.
- `workers_dev` and `preview_urls` are `false`: the deployed Worker (`travel-pocket-api`, using the remote D1 `travel-pocket`, created in the APAC region) has no public URL. Only the web Worker (`apps/web`) reaches it, through its `API` service binding, so every request has already passed Cloudflare Access.
- `.github/workflows/deploy-api.yml` runs the tests, applies migrations to the remote D1, then deploys, on pushes to `master` that touch `apps/api/`, `packages/shared/`, or root workspace files. It needs the repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- `worker-configuration.d.ts` is generated by `cf-typegen` (`wrangler types --strict-vars=false`, so vars are typed `string`) and committed. Rerun it after changing `wrangler.jsonc` or upgrading wrangler. `DEV_USER_EMAIL` is declared by hand in `src/env.d.ts`, because typegen never sees it.
- TypeScript is split like `apps/web`: `tsconfig.worker.json` (`src/`, Workers types), `tsconfig.node.json` (`scripts/`, `vitest.config.ts`), and `test/tsconfig.json`; `tsconfig.json` only references them.

## Testing

- Tests run inside workerd via `@cloudflare/vitest-plugin` (formerly `@cloudflare/vitest-pool-workers`), against a local D1.
- `vitest.config.ts` reads `migrations/` into a `TEST_MIGRATIONS` binding; `test/apply-migrations.ts` applies them before tests. It also binds a test Access team and AUD, and `DEV_USER_EMAIL`.
- `test/helpers.ts` plays Cloudflare Access: it generates an RSA key, serves the public key at the team's certs URL (by spying on `fetch`), and signs JWTs with `accessToken(email)`. `api(path, { as: email })` sends a signed-in request to a non-local host, so `DEV_USER_EMAIL` only applies when a test asks for a `localhost` origin.
- Storage is isolated per test file, not per test: `resetDatabase()` in `beforeEach` deletes `users`, which cascades to everything else.
- `test/seed.test.ts` runs `seedStatements` as SQL text through `DB.exec`, the way `wrangler d1 execute --file` does.
- Tests call the Worker through `exports.default.fetch` from `cloudflare:workers`.
