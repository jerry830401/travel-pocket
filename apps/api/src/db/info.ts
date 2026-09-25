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
