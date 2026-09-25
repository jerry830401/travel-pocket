import type { DataType, TripDataMap } from "@travel-pocket/shared";
import { getInfo } from "./info";
import { getItinerary } from "./itinerary";
import { runBatch } from "./run";
import { getShops } from "./shops";
import { replaceTripDataStatements } from "./writes";

export { createTrip, listTrips, tripIdsOwnedByOthers, tripOwnedBy, upsertTrips } from "./trips";
export { ensureUser } from "./users";

export function getTripData(
  db: D1Database,
  tripId: string,
  type: DataType
): Promise<TripDataMap[DataType]> {
  switch (type) {
    case "itinerary":
      return getItinerary(db, tripId);
    case "shops":
      return getShops(db, tripId);
    case "info":
      return getInfo(db, tripId);
  }
}

/** Replaces the trip's data of one type in a single transaction. */
export function replaceTripData(
  db: D1Database,
  tripId: string,
  type: DataType,
  data: readonly unknown[]
): Promise<void> {
  return runBatch(db, replaceTripDataStatements(tripId, type, data));
}
