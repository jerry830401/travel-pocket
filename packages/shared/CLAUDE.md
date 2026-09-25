# packages/shared

Guidance for `@travel-pocket/shared`, the data types and API contract shared by every app. Repo-wide rules — including the mandatory Isolation Rules — live in the root [CLAUDE.md](../../CLAUDE.md). Paths in this file are relative to `packages/shared/`.

## Contents

- [src/types.ts](src/types.ts) — all data interfaces (`Trip`, `ItineraryDay`, `ItineraryItem`, `Shop`, `InfoItem`, …)
- [src/contract.ts](src/contract.ts) — API contract: `TripDataMap`, `DataType`, `DATA_TYPES`, `ID_PATTERN`, and the request/response shapes `Me` (`GET /api/me`) and `NewTrip` (`POST /api/trips`)
- [src/index.ts](src/index.ts) — the package entry, re-exporting both

## Conventions

- Ships TypeScript source with no build step; `exports` points at `./src/index.ts`. The `build` script is `tsc --noEmit`, a type check only.
- Relative imports must keep the `.ts` extension, because `apps/web/vite.config.ts` loads this package through Node's native type stripping, which does not resolve extensionless paths.
- Currently types and plain constants only, with no runtime dependencies. Any dependency added later must be runtime-agnostic (a schema library like zod is fine; React, Hono, or Node-only libraries are not). It compiles with `lib: ["ES2022"]` and `types: []` so that DOM, Node, or Workers APIs fail to type-check (Isolation Rule 4).
- Every change here affects all dependent apps. Verify them before committing (Isolation Rule 8):

  ```bash
  pnpm -F "...@travel-pocket/shared" build   # this package and all its dependents
  pnpm -F "...@travel-pocket/shared" test
  ```
