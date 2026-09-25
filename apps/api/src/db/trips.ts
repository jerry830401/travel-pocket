import type { Trip } from "@travel-pocket/shared";

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

export async function listTrips(db: D1Database): Promise<Trip[]> {
  const { results } = await db
    .prepare(
      "SELECT id, name, start_date, end_date, cover_image, snapshot FROM trips ORDER BY position"
    )
    .all<TripRow>();
  return results.map(toTrip);
}

export async function tripExists(db: D1Database, tripId: string): Promise<boolean> {
  const row = await db.prepare("SELECT 1 FROM trips WHERE id = ?").bind(tripId).first();
  return row !== null;
}

// Upsert only, never delete: removing a trip row cascades to its itinerary,
// shops and info. The array index becomes the position.
// `WHERE true` resolves SQLite's parsing ambiguity between SELECT and ON CONFLICT.
export async function upsertTrips(db: D1Database, trips: readonly Trip[]): Promise<void> {
  await db
    .prepare(
      `INSERT INTO trips (id, name, start_date, end_date, cover_image, snapshot, position)
       SELECT value ->> 'id', value ->> 'name', value ->> 'startDate', value ->> 'endDate',
              value ->> 'coverImage', value ->> 'snapshot', key
       FROM json_each(?1) WHERE true
       ON CONFLICT (id) DO UPDATE SET
         name = excluded.name,
         start_date = excluded.start_date,
         end_date = excluded.end_date,
         cover_image = excluded.cover_image,
         snapshot = excluded.snapshot,
         position = excluded.position`
    )
    .bind(JSON.stringify(trips))
    .run();
}
