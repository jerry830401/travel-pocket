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
