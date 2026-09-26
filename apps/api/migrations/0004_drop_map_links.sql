-- Map links and thumbnails are gone (#30): the app searches Google Maps by an
-- item's or shop's location, and thumbnails were never shown. Links saved so
-- far are dropped with their columns.

ALTER TABLE itinerary_items DROP COLUMN google_map_link;

ALTER TABLE itinerary_items DROP COLUMN thumbnail;

ALTER TABLE shops DROP COLUMN google_map_link;
