import type { NewTrip, Trip } from "@travel-pocket/shared";
import { run } from "./run";
import { insertTripStatement, upsertTripsStatement } from "./writes";

export interface TripRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  cover_image: string;
  snapshot: string | null;
}

export function toTrip(row: TripRow): Trip {
  const trip: Trip = {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    coverImage: row.cover_image,
  };
  if (row.snapshot !== null) trip.snapshot = row.snapshot;
  return trip;
}

export async function listTrips(db: D1Database, ownerId: string): Promise<Trip[]> {
  const { results } = await db
    .prepare(
      `SELECT id, name, start_date, end_date, cover_image, snapshot
       FROM trips WHERE owner_id = ? ORDER BY position`
    )
    .bind(ownerId)
    .all<TripRow>();
  return results.map(toTrip);
}

export async function tripOwnedBy(db: D1Database, tripId: string, ownerId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM trips WHERE id = ? AND owner_id = ?")
    .bind(tripId, ownerId)
    .first();
  return row !== null;
}

/** The ids in `tripIds` that already belong to another user. */
export async function tripIdsOwnedByOthers(
  db: D1Database,
  tripIds: readonly string[],
  ownerId: string
): Promise<string[]> {
  const { results } = await db
    .prepare(
      "SELECT id FROM trips WHERE id IN (SELECT value FROM json_each(?1)) AND owner_id != ?2"
    )
    .bind(JSON.stringify(tripIds), ownerId)
    .all<{ id: string }>();
  return results.map((row) => row.id);
}

export async function upsertTrips(
  db: D1Database,
  ownerId: string,
  trips: readonly Trip[]
): Promise<void> {
  await run(db, upsertTripsStatement(ownerId, trips));
}

function newTripId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
}

/** Adds a trip after the owner's last one, under a server-assigned id. */
export async function createTrip(db: D1Database, ownerId: string, fields: NewTrip): Promise<Trip> {
  // Ids are global; retry on the (astronomically rare) collision.
  for (let attempt = 0; ; attempt++) {
    const trip: Trip = { ...fields, id: newTripId() };
    try {
      await run(db, insertTripStatement(ownerId, trip));
      return trip;
    } catch (err) {
      const collision = err instanceof Error && err.message.includes("trips.id");
      if (!collision || attempt >= 2) throw err;
    }
  }
}
