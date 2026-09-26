-- Sharing (#32): a trip's owner hands out its invite code; whoever uses it
-- asks to join ('pending') and becomes a member once the owner approves.

ALTER TABLE trips ADD COLUMN invite_code TEXT;

-- NULLs are distinct, so trips without a code never clash.
CREATE UNIQUE INDEX trips_invite_code ON trips (invite_code);

CREATE TABLE trip_members (
  trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'member')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (trip_id, user_id)
);

CREATE INDEX trip_members_user ON trip_members (user_id, status);
