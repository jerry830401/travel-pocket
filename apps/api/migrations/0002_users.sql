-- Multi-user (#17): every trip belongs to a user. A user row is created on the
-- first request, keyed by the email that Cloudflare Access verified.
--
-- trips is rebuilt to add owner_id NOT NULL. Existing trips have no owner, so
-- they are dropped (the DROP cascades to their itinerary, shops and info).
-- When this migration was written only local databases held data; re-import it
-- with `db:seed --owner <email>`.

PRAGMA defer_foreign_keys = true;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE trips_new (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  cover_image TEXT NOT NULL,
  snapshot TEXT,
  position INTEGER NOT NULL
);

DROP TABLE trips;
ALTER TABLE trips_new RENAME TO trips;

CREATE INDEX trips_owner_position ON trips (owner_id, position);
