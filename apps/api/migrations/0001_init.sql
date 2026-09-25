-- JSON columns (description, tags, links) hold JSON text.
-- category has no CHECK constraint: real data uses values outside the
-- ItineraryItem["category"] union (planeTakeoff, train, hotel).
-- day is stored as TEXT; the JSON has both numbers and strings.

CREATE TABLE trips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  cover_image TEXT NOT NULL,
  snapshot TEXT,
  position INTEGER NOT NULL
);

CREATE TABLE itinerary_days (
  trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  day TEXT NOT NULL,
  date TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (trip_id, id)
);

CREATE TABLE itinerary_items (
  trip_id TEXT NOT NULL,
  day_id TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  google_map_link TEXT,
  description TEXT,
  thumbnail TEXT,
  position INTEGER NOT NULL,
  PRIMARY KEY (trip_id, day_id, id),
  FOREIGN KEY (trip_id, day_id) REFERENCES itinerary_days (trip_id, id) ON DELETE CASCADE
);

CREATE TABLE shops (
  trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  tags TEXT NOT NULL,
  business_hours TEXT NOT NULL,
  google_map_link TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (trip_id, id)
);

CREATE TABLE info_items (
  trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  icon TEXT NOT NULL,
  links TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (trip_id, id)
);
