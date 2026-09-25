import type { DataType, TripDataMap } from "@travel-pocket/shared";
import { getInfo, replaceInfo } from "./info";
import { getItinerary, replaceItinerary } from "./itinerary";
import { getShops, replaceShops } from "./shops";

export { listTrips, tripExists, upsertTrips } from "./trips";

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

// `data` is only checked to be an array; the table constraints reject
// elements with missing fields (reported as 400 by the app's error handler).
export function replaceTripData(
  db: D1Database,
  tripId: string,
  type: DataType,
  data: unknown[]
): Promise<void> {
  switch (type) {
    case "itinerary":
      return replaceItinerary(db, tripId, data as TripDataMap["itinerary"]);
    case "shops":
      return replaceShops(db, tripId, data as TripDataMap["shops"]);
    case "info":
      return replaceInfo(db, tripId, data as TripDataMap["info"]);
  }
}
