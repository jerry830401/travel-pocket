import type { NewTrip, TripEntry } from "@travel-pocket/shared";
import { run, runBatch } from "./run";
import {
  VERSION_COLUMNS,
  deleteTripStatement,
  insertTripStatement,
  updateTripStatements,
  type VersionedPart,
} from "./writes";

export interface TripRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  cover_image: string;
  version: number;
}

export function toTripEntry(row: TripRow): TripEntry {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    coverImage: row.cover_image,
    version: row.version,
  };
}

export async function listTrips(db: D1Database, ownerId: string): Promise<TripEntry[]> {
  const { results } = await db
    .prepare(
      `SELECT id, name, start_date, end_date, cover_image, version
       FROM trips WHERE owner_id = ? ORDER BY position`
    )
    .bind(ownerId)
    .all<TripRow>();
  return results.map(toTripEntry);
}

export async function tripOwnedBy(db: D1Database, tripId: string, ownerId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM trips WHERE id = ? AND owner_id = ?")
    .bind(tripId, ownerId)
    .first();
  return row !== null;
}

/** The current version of one part of a trip, or null when there is no such trip. */
export function getVersion(db: D1Database, tripId: string, part: VersionedPart): Promise<number | null> {
  return db
    .prepare(`SELECT ${VERSION_COLUMNS[part]} AS v FROM trips WHERE id = ?`)
    .bind(tripId)
    .first<number>("v");
}

/**
 * Replaces the trip's fields if their version is still `expected` (a version
 * conflict fails otherwise, see `isVersionConflict`).
 */
export async function updateTrip(
  db: D1Database,
  tripId: string,
  fields: NewTrip,
  expected: number
): Promise<TripEntry> {
  await runBatch(db, updateTripStatements(tripId, fields, expected));
  return { id: tripId, ...fields, version: expected + 1 };
}

/** Deletes the trip if it belongs to the owner; false when there was none to delete. */
export async function deleteTrip(db: D1Database, ownerId: string, tripId: string): Promise<boolean> {
  const { meta } = await run(db, deleteTripStatement(ownerId, tripId));
  return meta.changes > 0;
}

function newTripId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
}

/** Adds a trip after the owner's last one, under a server-assigned id. */
export async function createTrip(db: D1Database, ownerId: string, fields: NewTrip): Promise<TripEntry> {
  // Ids are global; retry on the (astronomically rare) collision.
  for (let attempt = 0; ; attempt++) {
    const trip = { ...fields, id: newTripId() };
    try {
      await run(db, insertTripStatement(ownerId, trip));
      return { ...trip, version: 0 };
    } catch (err) {
      const collision = err instanceof Error && err.message.includes("trips.id");
      if (!collision || attempt >= 2) throw err;
    }
  }
}
