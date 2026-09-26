import type { ItineraryDay, ItineraryItem } from "@travel-pocket/shared";

export interface ItineraryDayRow {
  id: string;
  day: string;
  date: string;
}

export interface ItineraryItemRow {
  day_id: string;
  id: string;
  title: string;
  location: string;
  category: string;
  start_time: string;
  end_time: string;
  description: string | null; // JSON text
}

export function toItineraryItem(row: ItineraryItemRow): ItineraryItem {
  const item: ItineraryItem = {
    id: row.id,
    title: row.title,
    location: row.location,
    // Not narrowed: real data has categories outside the union.
    category: row.category as ItineraryItem["category"],
    startTime: row.start_time,
    endTime: row.end_time,
  };
  if (row.description !== null) item.description = JSON.parse(row.description) as string | string[];
  return item;
}

export function toItineraryDay(row: ItineraryDayRow, items: ItineraryItem[]): ItineraryDay {
  return { id: row.id, day: row.day, date: row.date, items };
}

export async function getItinerary(db: D1Database, tripId: string): Promise<ItineraryDay[]> {
  const [days, items] = await Promise.all([
    db
      .prepare("SELECT id, day, date FROM itinerary_days WHERE trip_id = ? ORDER BY position")
      .bind(tripId)
      .all<ItineraryDayRow>(),
    db
      .prepare(
        `SELECT day_id, id, title, location, category, start_time, end_time, description
         FROM itinerary_items WHERE trip_id = ? ORDER BY position`
      )
      .bind(tripId)
      .all<ItineraryItemRow>(),
  ]);

  const itemsByDay = new Map<string, ItineraryItem[]>();
  for (const row of items.results) {
    const list = itemsByDay.get(row.day_id) ?? [];
    list.push(toItineraryItem(row));
    itemsByDay.set(row.day_id, list);
  }
  return days.results.map((row) => toItineraryDay(row, itemsByDay.get(row.id) ?? []));
}
