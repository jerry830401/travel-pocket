// Imports the trip JSON from @travel-pocket/data into one account by writing
// SQL straight to D1 with `wrangler d1 execute`. It never goes through the API,
// so the API needs no admin access: wrangler's own access decides who can run
// it (the local .wrangler state, or your `wrangler login` for --remote).
//
//   pnpm -F @travel-pocket/api db:seed --owner you@example.com            # local D1
//   pnpm -F @travel-pocket/api db:seed --owner you@example.com --remote   # production D1
//
// The account is created if it does not exist yet. When any trip id already
// belongs to another account, nothing is written.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { DATA_TYPES } from "@travel-pocket/shared";
import type { Trip } from "@travel-pocket/shared";
import { conflictingTripsQuery, seedStatements, userIdQuery } from "../src/db/seed";
import type { SeedData } from "../src/db/seed";
import { toSqlText } from "../src/db/statements";
import type { Statement } from "../src/db/statements";
import { normalizeEmail } from "../src/email";

const DATABASE = "travel-pocket"; // database_name in wrangler.jsonc

const { values } = parseArgs({
  options: { owner: { type: "string" }, remote: { type: "boolean", default: false } },
});
const target = values.remote ? "--remote" : "--local";

const require = createRequire(import.meta.url);
const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wranglerBin = path.join(path.dirname(require.resolve("wrangler/package.json")), "bin/wrangler.js");
// Resolved through the package name, never a relative path into packages/.
const dataDir = path.dirname(require.resolve("@travel-pocket/data/trips.json"));

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf-8"));
}

function readSeedData(): SeedData {
  const trips = readJson("trips.json") as Trip[];
  const tripData: SeedData["tripData"] = {};
  for (const trip of trips) {
    const files: Record<string, unknown> = {};
    for (const type of DATA_TYPES) {
      const file = `${trip.id}/${type}.json`;
      if (fs.existsSync(path.join(dataDir, file))) files[type] = readJson(file);
    }
    tripData[trip.id] = files;
  }
  return { trips, tripData };
}

// Runs node on wrangler's entry point directly: no shell, so SQL passed as an
// argument needs no quoting on any platform. stdout is captured (wrangler lists
// every statement's result) and only shown when the command fails.
function d1Execute(args: string[]): string {
  try {
    return execFileSync(process.execPath, [wranglerBin, "d1", "execute", DATABASE, target, ...args], {
      cwd: apiDir,
      encoding: "utf-8",
      stdio: ["inherit", "pipe", "inherit"],
    });
  } catch (err) {
    const { stdout } = err as { stdout?: string };
    if (stdout) console.error(stdout);
    throw new Error(`wrangler d1 execute ${target} failed (output above).`);
  }
}

/** Runs a query whose rows are `{ id }` and returns the ids. */
function queryIds(statement: Statement): string[] {
  const output = d1Execute(["--command", toSqlText(statement), "--json"]);
  const [{ results }] = JSON.parse(output) as [{ results: { id: string }[] }];
  return results.map((row) => row.id);
}

function main(): void {
  if (!values.owner) throw new Error("Missing --owner <email>: the account to import into.");
  const email = normalizeEmail(values.owner);
  const data = readSeedData();

  const taken = queryIds(conflictingTripsQuery(email, data.trips.map((trip) => trip.id)));
  if (taken.length > 0) {
    throw new Error(
      `Trip ids already used by another account: ${taken.join(", ")}. Nothing was written.`
    );
  }
  const [existingId] = queryIds(userIdQuery(email));

  const sql = seedStatements(existingId ?? crypto.randomUUID(), email, data)
    .map(toSqlText)
    .join("\n");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "travel-pocket-seed-"));
  const file = path.join(tmpDir, "seed.sql");
  try {
    fs.writeFileSync(file, `${sql}\n`);
    // --yes: running the script is the confirmation (remote imports ask first).
    d1Execute(["--file", file, "--yes"]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  console.log(
    `Seeded ${data.trips.length} trips into ${email} (${existingId ? "existing" : "new"} account, ${target.slice(2)} D1)`
  );
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
