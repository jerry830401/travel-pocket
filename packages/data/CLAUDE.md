# packages/data

Guidance for `@travel-pocket/data`, the trip data shared by every app. Repo-wide rules — including the mandatory Isolation Rules — live in the root [CLAUDE.md](../../CLAUDE.md). Paths in this file are relative to `packages/data/`.

## Contents

Plain JSON only — no code, no build step, no dependencies. The shapes are defined in `@travel-pocket/shared`:

- `trips.json` — `Trip[]`
- `{tripId}/itinerary.json` — `ItineraryDay[]`
- `{tripId}/shops.json` — `Shop[]`
- `{tripId}/info.json` — `InfoItem[]`

`tripId` must match `ID_PATTERN`, and the file names must be the values in `DATA_TYPES` (both in `packages/shared/src/contract.ts`). Consumers only pick up files that follow this layout.

To add a new trip: add its folder here, populate the three JSON files, then add an entry to `trips.json`. Images such as `snapshot.jpg` are web-only assets and stay in `apps/web/public/data/{tripId}/`.

## Consumers

- `apps/web` serves these files at `data/` on the dev server only (`vite-plugin-trip-data.ts`). Production builds do not include them.
- `apps/api` imports them into one account's D1 data with `db:seed --owner <email>` (`scripts/seed.ts`), writing SQL through `wrangler d1 execute`.

Consumers locate files through the package name (`@travel-pocket/data/trips.json`), never through a relative path into `packages/`. `exports` exposes every `*.json` file for that purpose.
