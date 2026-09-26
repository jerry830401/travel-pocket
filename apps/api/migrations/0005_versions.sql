-- Versions (#31): a write that replaces a trip's fields, or one of its lists,
-- must name the version it was based on and bumps it, so it never overwrites a
-- change it has not seen. Existing trips start at 0.

ALTER TABLE trips ADD COLUMN version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE trips ADD COLUMN itinerary_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE trips ADD COLUMN shops_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE trips ADD COLUMN info_version INTEGER NOT NULL DEFAULT 0;
