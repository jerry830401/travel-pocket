import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import {
  DATA_TYPES,
  ID_PATTERN,
  MAX_COVER_BYTES,
  parseVersionTag,
  versionTag,
} from "@travel-pocket/shared";
import type { CoverUpload, DataType, Me, NewTrip, TripEntry } from "@travel-pocket/shared";
import { requireUser, type AppEnv } from "./auth";
import {
  createTrip,
  deleteTrip,
  getCover,
  getTripData,
  getVersion,
  isVersionConflict,
  listTrips,
  replaceTripData,
  saveCover,
  tripOwnedBy,
  updateTrip,
} from "./db";
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

// Every other route acts as the signed-in user and sees only that user's trips.
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

// Another user's trip answers 404, exactly like a trip that does not exist.
async function requireOwnTrip(c: Context<AppEnv>, tripId: string): Promise<void> {
  if (!(await tripOwnedBy(c.env.DB, tripId, c.get("userId")))) {
    throw new HTTPException(404, { message: "Trip not found" });
  }
}

app.get("/me", (c) => c.json<Me>({ email: c.get("email") }));

app.get("/trips", async (c) => c.json(await listTrips(c.env.DB, c.get("userId"))));

app.post("/trips", async (c) => {
  const fields = parseNewTrip(await readJsonBody(c));
  return c.json<TripEntry>(await createTrip(c.env.DB, c.get("userId"), fields), 201);
});

// Replaces the trip's fields (never its data); a cover it no longer points at is dropped.
app.put("/trips/:tripId", async (c) => {
  const tripId = parseTripId(c);
  const expected = requireVersion(c);
  const fields = parseNewTrip(await readJsonBody(c));
  await requireOwnTrip(c, tripId);
  return c.json<TripEntry>(await updateTrip(c.env.DB, tripId, fields, expected));
});

// The trip's itinerary, shops and info go with it (ON DELETE CASCADE).
app.delete("/trips/:tripId", async (c) => {
  const tripId = c.req.param("tripId");
  if (!ID_PATTERN.test(tripId)) throw new HTTPException(400, { message: "Invalid tripId" });
  if (!(await deleteTrip(c.env.DB, c.get("userId"), tripId))) {
    throw new HTTPException(404, { message: "Trip not found" });
  }
  return c.json({ ok: true });
});

// Registered before /trips/:tripId/:type, which would take "cover" for a type.
app.get("/trips/:tripId/cover", async (c) => {
  const tripId = parseTripId(c);
  await requireOwnTrip(c, tripId);
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
  await requireOwnTrip(c, tripId);
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
  await requireOwnTrip(c, tripId);
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
  await requireOwnTrip(c, tripId);
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
