import type { DataType, TripDataMap } from "@travel-pocket/shared";
import { getInfo } from "./info";
import { getItinerary } from "./itinerary";
import { runBatch } from "./run";
import { getShops } from "./shops";
import { bumpVersionStatement, replaceTripDataStatements } from "./writes";

export { createTrip, deleteTrip, getVersion, listTrips, tripOwnedBy, updateTrip } from "./trips";
export { isVersionConflict } from "./writes";
export { ensureUser } from "./users";
export { getCover, saveCover } from "./covers";

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

/**
 * Replaces the trip's data of one type in a single transaction, if its version
 * is still `expected` (a version conflict fails otherwise, see
 * `isVersionConflict`). Resolves with the new version.
 */
export async function replaceTripData(
  db: D1Database,
  tripId: string,
  type: DataType,
  data: readonly unknown[],
  expected: number
): Promise<number> {
  await runBatch(db, [
    bumpVersionStatement(tripId, type, expected),
    ...replaceTripDataStatements(tripId, type, data),
  ]);
  return expected + 1;
}
