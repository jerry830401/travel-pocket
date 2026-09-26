import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import {
  DATA_TYPES,
  ID_PATTERN,
  INVITE_CODE_PATTERN,
  MAX_COVER_BYTES,
  parseVersionTag,
  versionTag,
} from "@travel-pocket/shared";
import type {
  CoverUpload,
  DataType,
  Invite,
  Me,
  NewTrip,
  TripEntry,
  TripInvite,
  TripMembers,
  TripRole,
} from "@travel-pocket/shared";
import { requireUser, type AppEnv } from "./auth";
import {
  approveMember,
  createTrip,
  deleteTrip,
  ensureInviteCode,
  findInvite,
  getCover,
  getTripData,
  getVersion,
  isVersionConflict,
  listMembers,
  listTrips,
  removeMember,
  replaceTripData,
  requestToJoin,
  saveCover,
  tripAccess,
  updateTrip,
} from "./db";
import { normalizeEmail } from "./email";
import { detectImageType } from "./image";

const app = new Hono<AppEnv>().basePath("/api");

function allowedOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

app.use(
  "*",
  cors({
    origin: (origin, c: Context<AppEnv>) =>
      allowedOrigins(c.env).includes(origin) ? origin : null,
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Content-Type", "If-Match"],
    exposeHeaders: ["ETag"],
  })
);

// Registered before requireUser, so it answers without signing in.
app.get("/health", (c) => c.json({ ok: true }));

// The Access cookie has no SameSite, so browsers send it with a form another
// site posts here. A write a form could make (a form content type, or none)
// must come from this origin: 403 otherwise, before anything else runs.
app.use("*", csrf());

// Every other route acts as the signed-in user and sees only the trips they
// own or were approved to share.
app.use("*", requireUser);

function isDataType(value: string): value is DataType {
  return (DATA_TYPES as readonly string[]).includes(value);
}

function parseTripId(c: Context<AppEnv>): string {
  const tripId = c.req.param("tripId") ?? "";
  if (!ID_PATTERN.test(tripId)) throw new HTTPException(400, { message: "Invalid tripId" });
  return tripId;
}

function parseTripDataParams(c: Context<AppEnv>): { tripId: string; type: DataType } {
  const tripId = parseTripId(c);
  const type = c.req.param("type") ?? "";
  if (!isDataType(type)) throw new HTTPException(400, { message: "Invalid type" });
  return { tripId, type };
}

async function readJsonBody(c: Context<AppEnv>): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Body must be JSON" });
  }
}

async function readArrayBody(c: Context<AppEnv>): Promise<unknown[]> {
  const body = await readJsonBody(c);
  if (!Array.isArray(body)) throw new HTTPException(400, { message: "Body must be an array" });
  return body;
}

const NEW_TRIP_FIELDS = ["name", "startDate", "endDate", "coverImage"] as const;

// Copies only the known fields, so a client-sent `id` never reaches the insert.
function parseNewTrip(body: unknown): NewTrip {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HTTPException(400, { message: "Body must be an object" });
  }
  const fields = body as Record<string, unknown>;
  for (const key of NEW_TRIP_FIELDS) {
    if (typeof fields[key] !== "string") {
      throw new HTTPException(400, { message: `${key} must be a string` });
    }
  }
  return {
    name: fields.name as string,
    startDate: fields.startDate as string,
    endDate: fields.endDate as string,
    coverImage: fields.coverImage as string,
  };
}

// The version a write is based on (see the contract): 428 without If-Match.
function requireVersion(c: Context<AppEnv>): number {
  const header = c.req.header("If-Match");
  if (header === undefined) throw new HTTPException(428, { message: "If-Match required" });
  const version = parseVersionTag(header);
  if (version === null) throw new HTTPException(400, { message: "Invalid If-Match" });
  return version;
}

/**
 * How the user reaches the trip. A trip they do not share answers 404, exactly
 * like one that does not exist; a member asking for what only the owner may
 * do gets 403.
 */
async function requireTripAccess(
  c: Context<AppEnv>,
  tripId: string,
  need: TripRole = "member"
): Promise<TripRole> {
  const role = await tripAccess(c.env.DB, tripId, c.get("userId"));
  if (!role) throw new HTTPException(404, { message: "Trip not found" });
  if (need === "owner" && role !== "owner") {
    throw new HTTPException(403, { message: "Only the trip's owner can do that" });
  }
  return role;
}

function parseInviteCode(c: Context<AppEnv>): string {
  const code = c.req.param("code") ?? "";
  if (!INVITE_CODE_PATTERN.test(code)) throw new HTTPException(400, { message: "Invalid invite code" });
  return code;
}

app.get("/me", (c) => c.json<Me>({ email: c.get("email") }));

app.get("/trips", async (c) => c.json(await listTrips(c.env.DB, c.get("userId"))));

app.post("/trips", async (c) => {
  const fields = parseNewTrip(await readJsonBody(c));
  return c.json<TripEntry>(await createTrip(c.env.DB, c.get("userId"), c.get("email"), fields), 201);
});

// Replaces the trip's fields (never its data); a cover it no longer points at is dropped.
app.put("/trips/:tripId", async (c) => {
  const tripId = parseTripId(c);
  const expected = requireVersion(c);
  const fields = parseNewTrip(await readJsonBody(c));
  await requireTripAccess(c, tripId);
  const userId = c.get("userId");
  return c.json<TripEntry>(await updateTrip(c.env.DB, tripId, userId, fields, expected));
});

// The trip's itinerary, shops, info and members go with it (ON DELETE CASCADE).
app.delete("/trips/:tripId", async (c) => {
  const tripId = parseTripId(c);
  await requireTripAccess(c, tripId, "owner");
  if (!(await deleteTrip(c.env.DB, c.get("userId"), tripId))) {
    throw new HTTPException(404, { message: "Trip not found" });
  }
  return c.json({ ok: true });
});

// Registered before /trips/:tripId/:type, which would take "members" for a type.
app.get("/trips/:tripId/members", async (c) => {
  const tripId = parseTripId(c);
  const role = await requireTripAccess(c, tripId);
  return c.json<TripMembers>(await listMembers(c.env.DB, tripId, role));
});

app.post("/trips/:tripId/invite", async (c) => {
  const tripId = parseTripId(c);
  await requireTripAccess(c, tripId, "owner");
  return c.json<TripInvite>({ inviteCode: await ensureInviteCode(c.env.DB, tripId) });
});

// Approves a request to join.
app.put("/trips/:tripId/members/:email", async (c) => {
  const tripId = parseTripId(c);
  const email = normalizeEmail(c.req.param("email"));
  await requireTripAccess(c, tripId, "owner");
  if (!(await approveMember(c.env.DB, tripId, email))) {
    throw new HTTPException(404, { message: "No such request to join" });
  }
  return c.json({ ok: true });
});

// The owner removes a member or turns down a request; a member removes themself (leaves).
app.delete("/trips/:tripId/members/:email", async (c) => {
  const tripId = parseTripId(c);
  const email = normalizeEmail(c.req.param("email"));
  const role = await requireTripAccess(c, tripId);
  if (email === c.get("email")) {
    if (role === "owner") throw new HTTPException(400, { message: "The owner cannot leave" });
  } else if (role !== "owner") {
    throw new HTTPException(403, { message: "Only the trip's owner can do that" });
  }
  if (!(await removeMember(c.env.DB, tripId, email))) {
    throw new HTTPException(404, { message: "No such member" });
  }
  return c.json({ ok: true });
});

// Anyone signed in with the code sees which trip it opens and where they stand.
app.get("/invites/:code", async (c) => {
  const invite = await findInvite(c.env.DB, parseInviteCode(c), c.get("userId"));
  if (!invite) throw new HTTPException(404, { message: "Invite not found" });
  return c.json<Invite>(invite);
});

// Asks to join; the owner approves. Asking again changes nothing.
app.post("/invites/:code", async (c) => {
  const code = parseInviteCode(c);
  const userId = c.get("userId");
  const invite = await findInvite(c.env.DB, code, userId);
  if (!invite) throw new HTTPException(404, { message: "Invite not found" });
  if (invite.status !== "none") return c.json<Invite>(invite);
  await requestToJoin(c.env.DB, invite.tripId, userId);
  return c.json<Invite>({ ...invite, status: "pending" });
});

// Registered before /trips/:tripId/:type, which would take "cover" for a type.
app.get("/trips/:tripId/cover", async (c) => {
  const tripId = parseTripId(c);
  await requireTripAccess(c, tripId);
  const cover = await getCover(c.env.DB, tripId);
  if (!cover) throw new HTTPException(404, { message: "Trip has no cover" });
  return c.body(cover.data, 200, {
    "Content-Type": cover.contentType,
    // Every upload gets a new URL (saveCover), so a cached copy never goes stale.
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
});

// The body is the image itself. Its format is judged by its bytes, not by the
// Content-Type header, and only JPEG, PNG and WebP are kept.
app.put("/trips/:tripId/cover", async (c) => {
  const tripId = parseTripId(c);
  const tooLarge = () => new HTTPException(413, { message: "Cover is too large" });
  if (Number(c.req.header("Content-Length")) > MAX_COVER_BYTES) throw tooLarge();
  await requireTripAccess(c, tripId);
  const data = await c.req.arrayBuffer();
  if (data.byteLength > MAX_COVER_BYTES) throw tooLarge();
  const contentType = detectImageType(new Uint8Array(data));
  if (!contentType) {
    throw new HTTPException(400, { message: "Cover must be a JPEG, PNG or WebP image" });
  }
  return c.json<CoverUpload>(await saveCover(c.env.DB, tripId, contentType, data));
});

app.get("/trips/:tripId/:type", async (c) => {
  const { tripId, type } = parseTripDataParams(c);
  await requireTripAccess(c, tripId);
  // The version is read before the data: should a write land in between, the
  // client holds newer data under an older version, and its next write is
  // refused rather than let through over a change it has not seen.
  const version = await getVersion(c.env.DB, tripId, type);
  if (version === null) throw new HTTPException(404, { message: "Trip not found" });
  const data = await getTripData(c.env.DB, tripId, type);
  c.header("ETag", versionTag(version));
  return c.json(data);
});

app.put("/trips/:tripId/:type", async (c) => {
  const { tripId, type } = parseTripDataParams(c);
  const expected = requireVersion(c);
  const data = await readArrayBody(c);
  await requireTripAccess(c, tripId);
  const version = await replaceTripData(c.env.DB, tripId, type, data, expected);
  c.header("ETag", versionTag(version));
  return c.json({ ok: true });
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.res ? err.getResponse() : c.json({ error: err.message }, err.status);
  }
  // Checked first: a stale version surfaces as a NOT NULL constraint failure.
  if (isVersionConflict(err)) {
    return c.json({ error: "Changed since it was read; reload and try again" }, 412);
  }
  // Missing fields, duplicate ids and the like surface as constraint failures.
  if (err.message.includes("SQLITE_CONSTRAINT")) {
    return c.json({ error: "Data violates a database constraint", detail: err.message }, 400);
  }
  console.error(err);
  return c.json({ error: "Internal Server Error" }, 500);
});

export default app;
