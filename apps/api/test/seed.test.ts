import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { InfoItem, ItineraryDay, Shop, Trip, TripEntry } from "@travel-pocket/shared";
import { conflictingTripsQuery, seedStatements, userIdQuery } from "../src/db/seed";
import type { SeedData } from "../src/db/seed";
import { toSqlText } from "../src/db/statements";
import type { Statement } from "../src/db/statements";
import { ALICE, BOB, api, insertTrips, replace, resetDatabase } from "./helpers";

// Values with quotes and newlines, to prove toSqlText's literals survive them.
const trips: Trip[] = [
  {
    id: "sendai-2026",
    name: "Alice's 仙台",
    startDate: "2026-03-01",
    endDate: "2026-03-08",
    coverImage: "https://example.com/sendai.jpg",
  },
  {
    id: "kyushu-2024",
    name: "九州",
    startDate: "2024-05-01",
    endDate: "2024-05-03",
    coverImage: "https://example.com/kyushu.jpg",
  },
];

const itinerary: ItineraryDay[] = [
  {
    id: "day-1",
    day: "1",
    date: "2026-03-01",
    items: [
      {
        id: "item-1",
        title: "出發",
        location: "桃園機場",
        category: "transport",
        startTime: "08:00",
        endTime: "10:00",
        description: "第一行\n第二行 'quoted'",
      },
    ],
  },
];

const shops: Shop[] = [
  {
    id: "shop-1",
    name: "O'Reilly's",
    location: "一番町",
    tags: ["百貨"],
    businessHours: "10:00-19:00",
  },
];

const info: InfoItem[] = [
  { id: "info-1", title: "緊急聯絡", icon: "phone", links: [{ label: "代表處", url: "https://example.com" }] },
];

const entries: TripEntry[] = trips.map((trip) => ({ ...trip, version: 0 }));

const data: SeedData = {
  trips,
  tripData: { "sendai-2026": { itinerary, shops, info }, "kyushu-2024": { shops: [] } },
};

// Runs statements the way `wrangler d1 execute --file` does: as plain SQL
// text, one statement per line.
async function execAsText(statements: Statement[]): Promise<void> {
  const lines = statements.map(toSqlText);
  for (const line of lines) expect(line).not.toContain("\n");
  await env.DB.exec(lines.join("\n"));
}

async function ids(statement: Statement): Promise<string[]> {
  const { results } = await env.DB.prepare(toSqlText(statement)).all<{ id: string }>();
  return results.map((row) => row.id);
}

async function json<T>(res: Promise<Response>): Promise<T> {
  return (await res).json() as Promise<T>;
}

beforeEach(resetDatabase);

describe("toSqlText", () => {
  it("inlines parameters as literals on one line", () => {
    const statement = { sql: "SELECT ?1,\n  ?2, ?3,\n?1", params: ["it's", null, 42] };
    expect(toSqlText(statement)).toBe("SELECT 'it''s', NULL, 42, 'it''s';");
  });

  it("inlines bytes as a BLOB literal", async () => {
    const bytes = new Uint8Array([0x00, 0x0f, 0xff]).buffer;
    const sql = toSqlText({ sql: "SELECT hex(?1) AS h", params: [bytes] });
    expect(sql).toBe("SELECT hex(X'000fff') AS h;");
    expect(await env.DB.prepare(sql.slice(0, -1)).first("h")).toBe("000FFF");
  });

  it("refuses a statement with a missing parameter", () => {
    expect(() => toSqlText({ sql: "SELECT ?2", params: ["only one"] })).toThrow();
  });
});

describe("seedStatements", () => {
  it("imports everything into a new account the user later signs in to", async () => {
    await execAsText(seedStatements(crypto.randomUUID(), ALICE, data));

    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual(entries);
    expect(await json(api("/trips/sendai-2026/itinerary", { as: ALICE }))).toStrictEqual(itinerary);
    expect(await json(api("/trips/sendai-2026/shops", { as: ALICE }))).toStrictEqual(shops);
    expect(await json(api("/trips/sendai-2026/info", { as: ALICE }))).toStrictEqual(info);
    expect(await json(api("/trips/kyushu-2024/shops", { as: ALICE }))).toEqual([]);
  });

  it("imports into an existing account under its id", async () => {
    await api("/me", { as: ALICE });
    const [aliceId] = await ids(userIdQuery(ALICE));
    await execAsText(seedStatements(aliceId, ALICE, data));
    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual(entries);
  });

  it("replaces instead of duplicating when run again", async () => {
    const ownerId = crypto.randomUUID();
    await execAsText(seedStatements(ownerId, ALICE, data));
    await execAsText(seedStatements(ownerId, ALICE, data));
    const again = trips.map((trip) => ({ ...trip, version: 1 }));
    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual(again);
    expect(await json(api("/trips/sendai-2026/shops", { as: ALICE }))).toStrictEqual(shops);
  });

  it("gives what it replaces a new version, so older copies cannot overwrite it", async () => {
    const ownerId = crypto.randomUUID();
    await execAsText(seedStatements(ownerId, ALICE, data));
    const read = await api("/trips/sendai-2026/shops", { as: ALICE });
    const etag = read.headers.get("ETag") ?? "";
    await execAsText(seedStatements(ownerId, ALICE, data));
    const headers = { "If-Match": etag };
    const res = await api("/trips/sendai-2026/shops", { method: "PUT", body: [], as: ALICE, headers });
    expect(res.status).toBe(412);
    expect((await replace("/trips/sendai-2026/shops", [], ALICE)).status).toBe(200);
  });

  it("keeps the imported trips away from other users", async () => {
    await execAsText(seedStatements(crypto.randomUUID(), ALICE, data));
    expect(await json(api("/trips", { as: BOB }))).toEqual([]);
    expect((await api("/trips/sendai-2026/shops", { as: BOB })).status).toBe(404);
  });
});

describe("conflictingTripsQuery", () => {
  const tripIds = trips.map((trip) => trip.id);

  it("finds ids that belong to another account", async () => {
    await insertTrips(BOB, [trips[1]]);
    expect(await ids(conflictingTripsQuery(ALICE, tripIds))).toEqual(["kyushu-2024"]);
    expect(await ids(conflictingTripsQuery("new@example.com", tripIds))).toEqual(["kyushu-2024"]);
  });

  it("does not count the account's own trips", async () => {
    await insertTrips(ALICE, trips);
    expect(await ids(conflictingTripsQuery(ALICE, tripIds))).toEqual([]);
  });

  it("finds nothing in an empty database", async () => {
    expect(await ids(conflictingTripsQuery(ALICE, tripIds))).toEqual([]);
  });
});
