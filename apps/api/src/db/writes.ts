import type { DataType, InfoItem, ItineraryDay, NewTrip, Shop, Trip } from "@travel-pocket/shared";
import type { Statement } from "./statements";

// Every write the API and scripts/seed.ts perform, as plain statements.
// Arrays go in as one JSON parameter and are expanded with json_each, so the
// statement count stays fixed however much data there is (the Free plan allows
// 50 queries per invocation and 100 bound parameters per query).

/** Binds an email to a new user id, unless the email is already bound. */
export function insertUserStatement(id: string, email: string): Statement {
  return {
    sql: "INSERT INTO users (id, email) VALUES (?1, ?2) ON CONFLICT (email) DO NOTHING",
    params: [id, email],
  };
}

/** What a version covers: the trip's own fields, or one of its lists. */
export type VersionedPart = "trip" | DataType;

/** The `trips` column holding each part's version. */
export const VERSION_COLUMNS: Record<VersionedPart, string> = {
  trip: "version",
  itinerary: "itinerary_version",
  shops: "shops_version",
  info: "info_version",
};

/**
 * Bumps a version, but only from `expected`. Any other version becomes NULL,
 * which the column's NOT NULL constraint rejects, and that failure rolls back
 * the whole batch (see `isVersionConflict`). Put it first in the batch of the
 * write it guards.
 */
export function bumpVersionStatement(
  tripId: string,
  part: VersionedPart,
  expected: number
): Statement {
  const column = VERSION_COLUMNS[part];
  return {
    sql: `UPDATE trips SET ${column} = CASE WHEN ${column} = ?2 THEN ${column} + 1 END
          WHERE id = ?1`,
    params: [tripId, expected],
  };
}

/** Bumps a version whatever it is, for writes that are not based on a read (the seed). */
export function touchVersionStatement(tripId: string, part: VersionedPart): Statement {
  const column = VERSION_COLUMNS[part];
  return { sql: `UPDATE trips SET ${column} = ${column} + 1 WHERE id = ?1`, params: [tripId] };
}

/** Whether a failed batch was stopped by `bumpVersionStatement`. */
export function isVersionConflict(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const columns = Object.values(VERSION_COLUMNS).join("|");
  return new RegExp(`NOT NULL constraint failed: trips\\.(${columns})\\b`).test(err.message);
}

// Upsert only, never delete: removing a trip row cascades to its itinerary,
// shops and info. The array index becomes the position. A trip that belongs to
// another user is never updated; callers reject those ids before writing.
// Used by the seed, which is not based on a read, so updated trips get a new
// version whatever they had.
// `WHERE true` resolves SQLite's parsing ambiguity between SELECT and ON CONFLICT.
export function upsertTripsStatement(ownerId: string, trips: readonly Trip[]): Statement {
  return {
    sql: `INSERT INTO trips (id, owner_id, name, start_date, end_date, cover_image, position)
          SELECT value ->> 'id', ?2, value ->> 'name', value ->> 'startDate', value ->> 'endDate',
                 value ->> 'coverImage', key
          FROM json_each(?1) WHERE true
          ON CONFLICT (id) DO UPDATE SET
            name = excluded.name,
            start_date = excluded.start_date,
            end_date = excluded.end_date,
            cover_image = excluded.cover_image,
            position = excluded.position,
            version = trips.version + 1
          WHERE trips.owner_id = excluded.owner_id`,
    params: [JSON.stringify(trips), ownerId],
  };
}

/**
 * Replaces a trip's fields if its version is still `expected`, and drops its
 * uploaded cover once `coverImage` no longer points at it. Run as one batch.
 */
export function updateTripStatements(tripId: string, fields: NewTrip, expected: number): Statement[] {
  return [
    bumpVersionStatement(tripId, "trip", expected),
    {
      sql: `UPDATE trips SET name = ?2, start_date = ?3, end_date = ?4, cover_image = ?5
            WHERE id = ?1`,
      params: [tripId, fields.name, fields.startDate, fields.endDate, fields.coverImage],
    },
    deleteStaleCoverStatement(tripId),
  ];
}

/** Inserts a trip after the owner's last one. */
export function insertTripStatement(ownerId: string, trip: Trip): Statement {
  return {
    sql: `INSERT INTO trips (id, owner_id, name, start_date, end_date, cover_image, position)
          SELECT ?1, ?2, ?3, ?4, ?5, ?6, COALESCE(MAX(position) + 1, 0)
          FROM trips WHERE owner_id = ?2`,
    params: [trip.id, ownerId, trip.name, trip.startDate, trip.endDate, trip.coverImage],
  };
}

/** Deletes one of the owner's trips; its itinerary, shops, info and cover cascade. */
export function deleteTripStatement(ownerId: string, tripId: string): Statement {
  return { sql: "DELETE FROM trips WHERE id = ?1 AND owner_id = ?2", params: [tripId, ownerId] };
}

/** Where the API serves a trip's uploaded cover (`GET /api/trips/:tripId/cover`). */
export function coverPath(tripId: string): string {
  return `/api/trips/${tripId}/cover`;
}

/**
 * Stores a trip's cover and points the trip at `coverImage`, bumping its
 * version (the last statement returns the new one). Run as one batch.
 */
export function saveCoverStatements(
  tripId: string,
  contentType: string,
  data: ArrayBuffer,
  coverImage: string
): Statement[] {
  return [
    {
      sql: `INSERT INTO trip_covers (trip_id, content_type, data) VALUES (?1, ?2, ?3)
            ON CONFLICT (trip_id) DO UPDATE SET
              content_type = excluded.content_type,
              data = excluded.data`,
      params: [tripId, contentType, data],
    },
    {
      sql: "UPDATE trips SET cover_image = ?2, version = version + 1 WHERE id = ?1 RETURNING version",
      params: [tripId, coverImage],
    },
  ];
}

// A cover is kept only while its trip's cover_image points at it (coverPath,
// plus a version query). Saving the trip with another image, or none, drops it.
function deleteStaleCoverStatement(tripId: string): Statement {
  return {
    sql: `DELETE FROM trip_covers WHERE trip_id IN (
            SELECT id FROM trips
            WHERE id = ?1 AND cover_image NOT LIKE '/api/trips/' || id || '/cover%')`,
    params: [tripId],
  };
}

// Deleting the days cascades to their items. Run as one batch (one transaction).
function replaceItineraryStatements(tripId: string, days: readonly ItineraryDay[]): Statement[] {
  const json = JSON.stringify(days);
  return [
    { sql: "DELETE FROM itinerary_days WHERE trip_id = ?1", params: [tripId] },
    {
      sql: `INSERT INTO itinerary_days (trip_id, id, day, date, position)
            SELECT ?1, d.value ->> 'id', CAST(d.value ->> 'day' AS TEXT), d.value ->> 'date', d.key
            FROM json_each(?2) AS d`,
      params: [tripId, json],
    },
    {
      sql: `INSERT INTO itinerary_items (trip_id, day_id, id, title, location, category,
                                         start_time, end_time, description, position)
            SELECT ?1, d.value ->> 'id', i.value ->> 'id', i.value ->> 'title',
                   i.value ->> 'location', i.value ->> 'category', i.value ->> 'startTime',
                   i.value ->> 'endTime', i.value -> 'description', i.key
            FROM json_each(?2) AS d, json_each(d.value, '$.items') AS i`,
      params: [tripId, json],
    },
  ];
}

function replaceShopsStatements(tripId: string, shops: readonly Shop[]): Statement[] {
  return [
    { sql: "DELETE FROM shops WHERE trip_id = ?1", params: [tripId] },
    {
      sql: `INSERT INTO shops (trip_id, id, name, location, tags, business_hours, position)
            SELECT ?1, value ->> 'id', value ->> 'name', value ->> 'location', value -> 'tags',
                   value ->> 'businessHours', key
            FROM json_each(?2)`,
      params: [tripId, JSON.stringify(shops)],
    },
  ];
}

function replaceInfoStatements(tripId: string, items: readonly InfoItem[]): Statement[] {
  return [
    { sql: "DELETE FROM info_items WHERE trip_id = ?1", params: [tripId] },
    {
      sql: `INSERT INTO info_items (trip_id, id, title, icon, links, position)
            SELECT ?1, value ->> 'id', value ->> 'title', value ->> 'icon', value -> 'links', key
            FROM json_each(?2)`,
      params: [tripId, JSON.stringify(items)],
    },
  ];
}

// `data` is only checked to be an array; the table constraints reject
// elements with missing fields (reported as 400 by the app's error handler).
// The API guards these with bumpVersionStatement, the seed with touchVersionStatement.
export function replaceTripDataStatements(
  tripId: string,
  type: DataType,
  data: readonly unknown[]
): Statement[] {
  switch (type) {
    case "itinerary":
      return replaceItineraryStatements(tripId, data as ItineraryDay[]);
    case "shops":
      return replaceShopsStatements(tripId, data as Shop[]);
    case "info":
      return replaceInfoStatements(tripId, data as InfoItem[]);
  }
}
