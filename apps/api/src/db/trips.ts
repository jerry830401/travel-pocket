import type { NewTrip, TripEntry, TripRole } from "@travel-pocket/shared";
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
  role: TripRole;
  owner_email: string;
  member_count: number;
  pending_count: number;
}

export function toTripEntry(row: TripRow): TripEntry {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    coverImage: row.cover_image,
    version: row.version,
    role: row.role,
    ownerEmail: row.owner_email,
    memberCount: row.member_count,
    pendingCount: row.pending_count,
  };
}

// The trips user ?1 reaches, as TripRows: the ones they own, and the ones
// whose owner approved them (`me`). Only the owner counts pending requests.
const ENTRY_SQL = `
  SELECT t.id, t.name, t.start_date, t.end_date, t.cover_image, t.version,
         CASE WHEN t.owner_id = ?1 THEN 'owner' ELSE 'member' END AS role,
         o.email AS owner_email,
         (SELECT COUNT(*) FROM trip_members m
          WHERE m.trip_id = t.id AND m.status = 'member') AS member_count,
         CASE WHEN t.owner_id = ?1
           THEN (SELECT COUNT(*) FROM trip_members m
                 WHERE m.trip_id = t.id AND m.status = 'pending')
           ELSE 0 END AS pending_count
  FROM trips t
  JOIN users o ON o.id = t.owner_id
  LEFT JOIN trip_members me ON me.trip_id = t.id AND me.user_id = ?1 AND me.status = 'member'
  WHERE (t.owner_id = ?1 OR me.user_id IS NOT NULL)`;

/** The user's own trips in their order, then the ones they joined, in the order they asked. */
export async function listTrips(db: D1Database, userId: string): Promise<TripEntry[]> {
  const { results } = await db
    .prepare(
      `${ENTRY_SQL}
       ORDER BY me.user_id IS NOT NULL, CASE WHEN me.user_id IS NULL THEN t.position END,
                me.created_at`
    )
    .bind(userId)
    .all<TripRow>();
  return results.map(toTripEntry);
}

async function getTripEntry(db: D1Database, tripId: string, userId: string): Promise<TripEntry> {
  const row = await db.prepare(`${ENTRY_SQL} AND t.id = ?2`).bind(userId, tripId).first<TripRow>();
  if (!row) throw new Error(`Trip ${tripId} is out of reach`);
  return toTripEntry(row);
}

/** How the user reaches the trip, or null when it does not exist or is not theirs to see. */
export function tripAccess(db: D1Database, tripId: string, userId: string): Promise<TripRole | null> {
  return db
    .prepare(
      `SELECT CASE WHEN t.owner_id = ?2 THEN 'owner' ELSE 'member' END AS role
       FROM trips t
       WHERE t.id = ?1 AND (t.owner_id = ?2 OR EXISTS (
         SELECT 1 FROM trip_members m
         WHERE m.trip_id = t.id AND m.user_id = ?2 AND m.status = 'member'))`
    )
    .bind(tripId, userId)
    .first<TripRole>("role");
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
 * conflict fails otherwise, see `isVersionConflict`), and returns the trip as
 * `userId` sees it.
 */
export async function updateTrip(
  db: D1Database,
  tripId: string,
  userId: string,
  fields: NewTrip,
  expected: number
): Promise<TripEntry> {
  await runBatch(db, updateTripStatements(tripId, fields, expected));
  return getTripEntry(db, tripId, userId);
}

/** Deletes the trip if it belongs to the owner; false when there was none to delete. */
export async function deleteTrip(db: D1Database, ownerId: string, tripId: string): Promise<boolean> {
  const { meta } = await run(db, deleteTripStatement(ownerId, tripId));
  return meta.changes > 0;
}

function newTripId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
}

/** Adds a personal trip after the owner's last one, under a server-assigned id. */
export async function createTrip(
  db: D1Database,
  ownerId: string,
  ownerEmail: string,
  fields: NewTrip
): Promise<TripEntry> {
  // Ids are global; retry on the (astronomically rare) collision.
  for (let attempt = 0; ; attempt++) {
    const trip = { ...fields, id: newTripId() };
    try {
      await run(db, insertTripStatement(ownerId, trip));
      return { ...trip, version: 0, role: "owner", ownerEmail, memberCount: 0, pendingCount: 0 };
    } catch (err) {
      const collision = err instanceof Error && err.message.includes("trips.id");
      if (!collision || attempt >= 2) throw err;
    }
  }
}
