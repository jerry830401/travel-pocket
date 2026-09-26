import type { Invite, TripMember, TripMembers, TripRole } from "@travel-pocket/shared";
import { run } from "./run";
import {
  approveMemberStatement,
  ensureInviteCodeStatement,
  removeMemberStatement,
  requestToJoinStatement,
} from "./writes";
import type { Statement } from "./statements";

/** Who shares the trip, as `role` may see it: pending requests and the code are the owner's. */
export async function listMembers(db: D1Database, tripId: string, role: TripRole): Promise<TripMembers> {
  const isOwner = role === "owner";
  const [trip, { results }] = await Promise.all([
    db
      .prepare(
        `SELECT o.email AS owner_email, t.invite_code
         FROM trips t JOIN users o ON o.id = t.owner_id WHERE t.id = ?`
      )
      .bind(tripId)
      .first<{ owner_email: string; invite_code: string | null }>(),
    db
      .prepare(
        `SELECT u.email, m.status
         FROM trip_members m JOIN users u ON u.id = m.user_id
         WHERE m.trip_id = ?1 AND (?2 OR m.status = 'member')
         ORDER BY m.created_at, u.email`
      )
      .bind(tripId, isOwner ? 1 : 0)
      .all<TripMember>(),
  ]);
  if (!trip) throw new Error(`Trip ${tripId} does not exist`);
  return {
    ownerEmail: trip.owner_email,
    members: results,
    inviteCode: isOwner ? trip.invite_code : null,
  };
}

/** 128 random bits in hex (INVITE_CODE_PATTERN). */
function newInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The trip's invite code, created the first time it is asked for. */
export async function ensureInviteCode(db: D1Database, tripId: string): Promise<string> {
  const { sql, params } = ensureInviteCodeStatement(tripId, newInviteCode());
  const code = await db.prepare(sql).bind(...params).first<string>("invite_code");
  if (!code) throw new Error(`Trip ${tripId} does not exist`);
  return code;
}

async function changed(db: D1Database, statement: Statement): Promise<boolean> {
  const { meta } = await run(db, statement);
  return meta.changes > 0;
}

/** Approves a request to join; false when the user never asked. */
export function approveMember(db: D1Database, tripId: string, email: string): Promise<boolean> {
  return changed(db, approveMemberStatement(tripId, email));
}

/** Removes a member or a request to join; false when there was neither. */
export function removeMember(db: D1Database, tripId: string, email: string): Promise<boolean> {
  return changed(db, removeMemberStatement(tripId, email));
}

/** The trip behind an invite code as `userId` stands with it, or null for an unknown code. */
export async function findInvite(db: D1Database, code: string, userId: string): Promise<Invite | null> {
  const row = await db
    .prepare(
      `SELECT t.id AS trip_id, t.name AS trip_name, o.email AS owner_email,
              CASE WHEN t.owner_id = ?2 THEN 'owner'
                   ELSE COALESCE((SELECT m.status FROM trip_members m
                                  WHERE m.trip_id = t.id AND m.user_id = ?2), 'none')
              END AS status
       FROM trips t JOIN users o ON o.id = t.owner_id
       WHERE t.invite_code = ?1`
    )
    .bind(code, userId)
    .first<{ trip_id: string; trip_name: string; owner_email: string; status: Invite["status"] }>();
  return (
    row && {
      tripId: row.trip_id,
      tripName: row.trip_name,
      ownerEmail: row.owner_email,
      status: row.status,
    }
  );
}

/** Asks to join the trip (nothing happens for its owner, or when already asked). */
export async function requestToJoin(db: D1Database, tripId: string, userId: string): Promise<void> {
  await run(db, requestToJoinStatement(tripId, userId));
}
