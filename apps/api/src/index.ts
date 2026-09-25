import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { DATA_TYPES, ID_PATTERN } from "@travel-pocket/shared";
import type { DataType, Me, NewTrip, Trip } from "@travel-pocket/shared";
import { requireUser, type AppEnv } from "./auth";
import {
  createTrip,
  deleteTrip,
  getTripData,
  listTrips,
  replaceTripData,
  tripIdsOwnedByOthers,
  tripOwnedBy,
  upsertTrips,
} from "./db";

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
    allowHeaders: ["Content-Type"],
  })
);

// Registered before requireUser, so it answers without signing in.
app.get("/health", (c) => c.json({ ok: true }));

// Every other route acts as the signed-in user and sees only that user's trips.
app.use("*", requireUser);

function isDataType(value: string): value is DataType {
  return (DATA_TYPES as readonly string[]).includes(value);
}

function parseTripDataParams(c: Context<AppEnv>): { tripId: string; type: DataType } {
  const tripId = c.req.param("tripId") ?? "";
  const type = c.req.param("type") ?? "";
  if (!ID_PATTERN.test(tripId)) throw new HTTPException(400, { message: "Invalid tripId" });
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

function isTrip(value: unknown): value is Trip {
  if (typeof value !== "object" || value === null) return false;
  const { id } = value as { id?: unknown };
  return typeof id === "string" && ID_PATTERN.test(id);
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
  if (fields.snapshot !== undefined && typeof fields.snapshot !== "string") {
    throw new HTTPException(400, { message: "snapshot must be a string" });
  }
  const trip: NewTrip = {
    name: fields.name as string,
    startDate: fields.startDate as string,
    endDate: fields.endDate as string,
    coverImage: fields.coverImage as string,
  };
  if (typeof fields.snapshot === "string") trip.snapshot = fields.snapshot;
  return trip;
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
  return c.json(await createTrip(c.env.DB, c.get("userId"), fields), 201);
});

app.put("/trips", async (c) => {
  const trips = await readArrayBody(c);
  if (!trips.every(isTrip)) {
    throw new HTTPException(400, { message: "Every trip needs an id matching ID_PATTERN" });
  }
  const userId = c.get("userId");
  const taken = await tripIdsOwnedByOthers(c.env.DB, trips.map((trip) => trip.id), userId);
  if (taken.length > 0) throw new HTTPException(409, { message: "Trip id already in use" });
  await upsertTrips(c.env.DB, userId, trips);
  return c.json({ ok: true });
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

app.get("/trips/:tripId/:type", async (c) => {
  const { tripId, type } = parseTripDataParams(c);
  await requireOwnTrip(c, tripId);
  return c.json(await getTripData(c.env.DB, tripId, type));
});

app.put("/trips/:tripId/:type", async (c) => {
  const { tripId, type } = parseTripDataParams(c);
  const data = await readArrayBody(c);
  await requireOwnTrip(c, tripId);
  await replaceTripData(c.env.DB, tripId, type, data);
  return c.json({ ok: true });
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.res ? err.getResponse() : c.json({ error: err.message }, err.status);
  }
  // Missing fields, duplicate ids and the like surface as constraint failures.
  if (err.message.includes("SQLITE_CONSTRAINT")) {
    return c.json({ error: "Data violates a database constraint", detail: err.message }, 400);
  }
  console.error(err);
  return c.json({ error: "Internal Server Error" }, 500);
});

export default app;
