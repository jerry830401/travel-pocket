import type { CoverUpload } from "@travel-pocket/shared";
import { runBatch } from "./run";
import { coverPath, saveCoverStatements } from "./writes";

export interface Cover {
  contentType: string;
  data: Uint8Array<ArrayBuffer>;
}

interface CoverRow {
  content_type: string;
  data: ArrayBuffer | number[]; // D1 has returned BLOBs as both
}

/** The trip's uploaded cover, or null when it has none. */
export async function getCover(db: D1Database, tripId: string): Promise<Cover | null> {
  const row = await db
    .prepare("SELECT content_type, data FROM trip_covers WHERE trip_id = ?")
    .bind(tripId)
    .first<CoverRow>();
  return row && { contentType: row.content_type, data: new Uint8Array(row.data) };
}

/**
 * Stores the trip's cover and points its `coverImage` at it, which bumps the
 * trip's version. The URL changes with every upload, so browsers and the
 * service worker never show an old one.
 */
export async function saveCover(
  db: D1Database,
  tripId: string,
  contentType: string,
  data: ArrayBuffer
): Promise<CoverUpload> {
  const coverImage = `${coverPath(tripId)}?v=${Date.now()}`;
  const results = await runBatch(db, saveCoverStatements(tripId, contentType, data, coverImage));
  const [{ version }] = results[results.length - 1].results as { version: number }[];
  return { coverImage, version };
}
