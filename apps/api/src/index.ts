import { Hono, type Context } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { DATA_TYPES, ID_PATTERN } from "@travel-pocket/shared";
import type { DataType, Trip } from "@travel-pocket/shared";
import { getTripData, listTrips, replaceTripData, tripExists, upsertTrips } from "./db";

type AppEnv = { Bindings: Env };

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
    allowMethods: ["GET", "PUT"],
    allowHeaders: ["Authorization", "Content-Type"],
  })
);

app.on("PUT", "*", (c, next) => {
  if (!c.env.ADMIN_TOKEN) {
    throw new HTTPException(500, { message: "ADMIN_TOKEN is not configured" });
  }
  return bearerAuth<AppEnv>({ token: c.env.ADMIN_TOKEN })(c, next);
});

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

async function readArrayBody(c: Context<AppEnv>): Promise<unknown[]> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Body must be JSON" });
  }
  if (!Array.isArray(body)) throw new HTTPException(400, { message: "Body must be an array" });
  return body;
}

function isTrip(value: unknown): value is Trip {
  if (typeof value !== "object" || value === null) return false;
  const { id } = value as { id?: unknown };
  return typeof id === "string" && ID_PATTERN.test(id);
}

app.get("/health", (c) => c.json({ ok: true }));

app.get("/trips", async (c) => c.json(await listTrips(c.env.DB)));

app.put("/trips", async (c) => {
  const trips = await readArrayBody(c);
  if (!trips.every(isTrip)) {
    throw new HTTPException(400, { message: "Every trip needs an id matching ID_PATTERN" });
  }
  await upsertTrips(c.env.DB, trips);
  return c.json({ ok: true });
});

app.get("/trips/:tripId/:type", async (c) => {
  const { tripId, type } = parseTripDataParams(c);
  if (!(await tripExists(c.env.DB, tripId))) {
    throw new HTTPException(404, { message: "Trip not found" });
  }
  return c.json(await getTripData(c.env.DB, tripId, type));
});

app.put("/trips/:tripId/:type", async (c) => {
  const { tripId, type } = parseTripDataParams(c);
  const data = await readArrayBody(c);
  if (!(await tripExists(c.env.DB, tripId))) {
    throw new HTTPException(404, { message: "Trip not found" });
  }
  await replaceTripData(c.env.DB, tripId, type, data);
  return c.json({ ok: true });
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    // bearerAuth attaches its own response (with WWW-Authenticate); keep it.
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
