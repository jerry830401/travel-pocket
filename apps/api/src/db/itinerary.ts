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
  google_map_link: string | null;
  description: string | null; // JSON text
  thumbnail: string | null;
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
  if (row.google_map_link !== null) item.googleMapLink = row.google_map_link;
  if (row.description !== null) item.description = JSON.parse(row.description) as string | string[];
  if (row.thumbnail !== null) item.thumbnail = row.thumbnail;
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
        `SELECT day_id, id, title, location, category, start_time, end_time,
                google_map_link, description, thumbnail
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

// One batch = one transaction. Deleting the days cascades to their items.
// Each INSERT reads the whole array through json_each, so the statement count
// stays fixed however long the trip is.
export async function replaceItinerary(
  db: D1Database,
  tripId: string,
  days: readonly ItineraryDay[]
): Promise<void> {
  const json = JSON.stringify(days);
  await db.batch([
    db.prepare("DELETE FROM itinerary_days WHERE trip_id = ?1").bind(tripId),
    db
      .prepare(
        `INSERT INTO itinerary_days (trip_id, id, day, date, position)
         SELECT ?1, d.value ->> 'id', CAST(d.value ->> 'day' AS TEXT), d.value ->> 'date', d.key
         FROM json_each(?2) AS d`
      )
      .bind(tripId, json),
    db
      .prepare(
        `INSERT INTO itinerary_items (trip_id, day_id, id, title, location, category,
                                      start_time, end_time, google_map_link, description,
                                      thumbnail, position)
         SELECT ?1, d.value ->> 'id', i.value ->> 'id', i.value ->> 'title',
                i.value ->> 'location', i.value ->> 'category', i.value ->> 'startTime',
                i.value ->> 'endTime', i.value ->> 'googleMapLink', i.value -> 'description',
                i.value ->> 'thumbnail', i.key
         FROM json_each(?2) AS d, json_each(d.value, '$.items') AS i`
      )
      .bind(tripId, json),
  ]);
}
