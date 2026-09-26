import type { InfoItem, ItineraryDay, Shop, Trip } from "./types.ts";

/** Per-trip data, keyed by type (`public/data/{tripId}/{type}.json`). */
export interface TripDataMap {
  itinerary: ItineraryDay[];
  shops: Shop[];
  info: InfoItem[];
}

export type DataType = keyof TripDataMap;

export const DATA_TYPES = ["itinerary", "shops", "info"] as const satisfies readonly DataType[];

/** Allowed characters for a trip ID (also used as a path segment). */
export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** `GET /api/me`: the signed-in user. */
export interface Me {
  email: string;
}

/** `POST /api/trips` body: a new trip. The server assigns its `id`. */
export type NewTrip = Omit<Trip, "id">;

/*
 * Versions. Every write that replaces data states the version it was based
 * on, so it never overwrites a change it has not seen:
 * - `GET /api/trips/:tripId/:type` answers with `ETag: "<version>"`; a trip's
 *   own fields carry theirs in `TripEntry.version`.
 * - `PUT /api/trips/:tripId` and `PUT /api/trips/:tripId/:type` must send that
 *   version as `If-Match: "<version>"`. A stale one gets 412 and changes
 *   nothing; none at all gets 428.
 * - A successful write bumps the version. `PUT /api/trips/:tripId/:type`
 *   answers with the new `ETag`; the trip's writes return the new `version`.
 */

/** How the signed-in user reaches a trip: they own it, or its owner approved them. */
export type TripRole = "owner" | "member";

/**
 * A trip as `GET /api/trips` lists it, and as `POST /api/trips` and
 * `PUT /api/trips/:tripId` return it: with the version of its fields, and who
 * shares it. A trip with no members is personal; any member makes it shared.
 */
export interface TripEntry extends Trip {
  version: number;
  role: TripRole;
  ownerEmail: string;
  /** Approved members, not counting the owner. */
  memberCount: number;
  /** Requests to join that wait for the owner; always 0 for a member. */
  pendingCount: number;
}

/** `PUT /api/trips/:tripId` body: the trip's new fields (it keeps its `id`). */
export type TripUpdate = NewTrip;

/** The `ETag` / `If-Match` value for a version. */
export function versionTag(version: number): string {
  return `"${version}"`;
}

/** The version in an `ETag` / `If-Match` value, or null when there is none. */
export function parseVersionTag(tag: string | null | undefined): number | null {
  const match = /^"(\d+)"$/.exec(tag?.trim() ?? "");
  return match ? Number(match[1]) : null;
}

/*
 * Sharing. The owner hands out a link with the trip's invite code; whoever
 * signs in with it asks to join (`POST /api/invites/:code`), and becomes a
 * member once the owner approves (`PUT /api/trips/:tripId/members/:email`).
 * Members read and edit the trip like its owner does, but only the owner
 * deletes it, sees the invite code and manages members; a member may leave
 * (`DELETE /api/trips/:tripId/members/<their own email>`).
 */

/** An invite code: 128 random bits in hex. */
export const INVITE_CODE_PATTERN = /^[0-9a-f]{32}$/;

export type MemberStatus = "member" | "pending";

export interface TripMember {
  email: string;
  status: MemberStatus;
}

/**
 * `GET /api/trips/:tripId/members`. Members see only the approved members; the
 * owner also sees pending requests and the invite code (null until created).
 */
export interface TripMembers {
  ownerEmail: string;
  members: TripMember[];
  inviteCode: string | null;
}

/** `POST /api/trips/:tripId/invite`: the trip's invite code, created on first use. */
export interface TripInvite {
  inviteCode: string;
}

/** Where the signed-in user stands with an invited trip: `none` until they ask to join. */
export type InviteStatus = TripRole | "pending" | "none";

/** `GET` / `POST /api/invites/:code`: the invited trip, and the user's status after the call. */
export interface Invite {
  tripId: string;
  tripName: string;
  ownerEmail: string;
  status: InviteStatus;
}

/** Largest cover image `PUT /api/trips/:tripId/cover` accepts, in bytes. */
export const MAX_COVER_BYTES = 1_000_000;

/** Image formats a cover can be stored in (recognized by content, not by header). */
export const COVER_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * `PUT /api/trips/:tripId/cover` response. The body of the request is the
 * image itself; the server stores it and points the trip's `coverImage` at it,
 * which bumps the trip's `version`.
 */
export interface CoverUpload {
  coverImage: string;
  version: number;
}
