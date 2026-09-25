import type { InfoItem, InfoLink } from "@travel-pocket/shared";

export interface InfoItemRow {
  id: string;
  title: string;
  icon: string;
  links: string; // JSON text
}

export function toInfoItem(row: InfoItemRow): InfoItem {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    links: JSON.parse(row.links) as InfoLink[],
  };
}

export async function getInfo(db: D1Database, tripId: string): Promise<InfoItem[]> {
  const { results } = await db
    .prepare("SELECT id, title, icon, links FROM info_items WHERE trip_id = ? ORDER BY position")
    .bind(tripId)
    .all<InfoItemRow>();
  return results.map(toInfoItem);
}

export async function replaceInfo(
  db: D1Database,
  tripId: string,
  items: readonly InfoItem[]
): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM info_items WHERE trip_id = ?1").bind(tripId),
    db
      .prepare(
        `INSERT INTO info_items (trip_id, id, title, icon, links, position)
         SELECT ?1, value ->> 'id', value ->> 'title', value ->> 'icon', value -> 'links', key
         FROM json_each(?2)`
      )
      .bind(tripId, JSON.stringify(items)),
  ]);
}
