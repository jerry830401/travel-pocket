import type { Shop } from "@travel-pocket/shared";

export interface ShopRow {
  id: string;
  name: string;
  location: string;
  tags: string; // JSON text
  business_hours: string;
  google_map_link: string;
}

export function toShop(row: ShopRow): Shop {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    tags: JSON.parse(row.tags) as string[],
    businessHours: row.business_hours,
    googleMapLink: row.google_map_link,
  };
}

export async function getShops(db: D1Database, tripId: string): Promise<Shop[]> {
  const { results } = await db
    .prepare(
      `SELECT id, name, location, tags, business_hours, google_map_link
       FROM shops WHERE trip_id = ? ORDER BY position`
    )
    .bind(tripId)
    .all<ShopRow>();
  return results.map(toShop);
}

export async function replaceShops(
  db: D1Database,
  tripId: string,
  shops: readonly Shop[]
): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM shops WHERE trip_id = ?1").bind(tripId),
    db
      .prepare(
        `INSERT INTO shops (trip_id, id, name, location, tags, business_hours,
                            google_map_link, position)
         SELECT ?1, value ->> 'id', value ->> 'name', value ->> 'location', value -> 'tags',
                value ->> 'businessHours', value ->> 'googleMapLink', key
         FROM json_each(?2)`
      )
      .bind(tripId, JSON.stringify(shops)),
  ]);
}
