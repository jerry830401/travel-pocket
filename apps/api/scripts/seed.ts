// Imports the trip JSON from @travel-pocket/data through the API: PUT /trips
// first, then PUT /trips/:tripId/:type for each data file of each trip.
//
//   pnpm -F @travel-pocket/api db:seed --token dev-token
//   pnpm -F @travel-pocket/api db:seed --url https://<worker>.workers.dev/api --token <ADMIN_TOKEN>
//
// --url falls back to API_URL, then http://localhost:8787/api.
// --token falls back to ADMIN_TOKEN.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import { DATA_TYPES } from "@travel-pocket/shared";
import type { Trip } from "@travel-pocket/shared";

const { values } = parseArgs({
  options: { url: { type: "string" }, token: { type: "string" } },
});
const apiUrl = (values.url ?? process.env.API_URL ?? "http://localhost:8787/api").replace(/\/+$/, "");
const token = values.token ?? process.env.ADMIN_TOKEN;

// Resolved through the package name, never a relative path into packages/.
const dataDir = path.dirname(
  createRequire(import.meta.url).resolve("@travel-pocket/data/trips.json")
);

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf-8"));
}

async function put(pathname: string, body: unknown): Promise<void> {
  const res = await fetch(`${apiUrl}${pathname}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${pathname} → ${res.status} ${await res.text()}`);
  console.log(`PUT ${pathname} → ${res.status}`);
}

async function main(): Promise<void> {
  if (!token) throw new Error("Missing token: pass --token <ADMIN_TOKEN> or set ADMIN_TOKEN.");

  const trips = readJson("trips.json") as Trip[];
  await put("/trips", trips);
  for (const trip of trips) {
    for (const type of DATA_TYPES) {
      const file = `${trip.id}/${type}.json`;
      if (!fs.existsSync(path.join(dataDir, file))) continue;
      await put(`/trips/${trip.id}/${type}`, readJson(file));
    }
  }
  console.log(`Seeded ${trips.length} trips into ${apiUrl}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
