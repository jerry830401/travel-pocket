-- Uploaded trip covers (#28). The image lives in its own table, so listing
-- trips never reads it, and it goes with its trip (ON DELETE CASCADE).
--
-- snapshot (a path to a static image) is merged into cover_image, which now
-- holds the one URL the card shows: an uploaded cover, a static path, or ''.

CREATE TABLE trip_covers (
  trip_id TEXT PRIMARY KEY REFERENCES trips (id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  data BLOB NOT NULL
);

UPDATE trips SET cover_image = '/' || snapshot WHERE snapshot IS NOT NULL AND snapshot <> '';

ALTER TABLE trips DROP COLUMN snapshot;
