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

/**
 * A trip as `GET /api/trips` lists it, and as `POST /api/trips` and
 * `PUT /api/trips/:tripId` return it, with the version of its fields.
 */
export interface TripEntry extends Trip {
  version: number;
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
