import { DATA_TYPES } from "@travel-pocket/shared";
import type { Trip, TripDataMap } from "@travel-pocket/shared";
import type { Statement } from "./statements";
import {
  insertUserStatement,
  replaceTripDataStatements,
  touchVersionStatement,
  upsertTripsStatement,
} from "./writes";

// Statements behind scripts/seed.ts, which imports @travel-pocket/data into one
// account with `wrangler d1 execute` instead of going through the API. Kept
// free of D1 types so the Node script and the Worker tests share them.

export interface SeedData {
  trips: Trip[];
  /** The data files that exist, per trip id. */
  tripData: Record<string, Partial<TripDataMap>>;
}

/** Rows `{ id }`: the user bound to `email`, if any. */
export function userIdQuery(email: string): Statement {
  return { sql: "SELECT id FROM users WHERE email = ?1", params: [email] };
}

/** Rows `{ id }`: the ids in `tripIds` that belong to an account other than `email`. */
export function conflictingTripsQuery(email: string, tripIds: readonly string[]): Statement {
  return {
    sql: `SELECT id FROM trips
          WHERE id IN (SELECT value FROM json_each(?1))
            AND owner_id NOT IN (SELECT id FROM users WHERE email = ?2)`,
    params: [JSON.stringify(tripIds), email],
  };
}

/**
 * Imports `data` into the account bound to `email`. `ownerId` must be that
 * account's id, or a fresh one when the account does not exist yet. What it
 * replaces gets a new version, so a client editing an older copy is refused.
 */
export function seedStatements(ownerId: string, email: string, data: SeedData): Statement[] {
  return [
    insertUserStatement(ownerId, email),
    upsertTripsStatement(ownerId, data.trips),
    ...data.trips.flatMap((trip) =>
      DATA_TYPES.flatMap((type) => {
        const rows = data.tripData[trip.id]?.[type];
        return rows
          ? [touchVersionStatement(trip.id, type), ...replaceTripDataStatements(trip.id, type, rows)]
          : [];
      })
    ),
  ];
}
