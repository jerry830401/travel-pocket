import type { InfoItem, ItineraryDay, Shop } from "./types.ts";

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
