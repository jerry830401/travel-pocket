import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { ID_PATTERN } from "@travel-pocket/shared";
import type { InfoItem, ItineraryDay, NewTrip, Shop, Trip, TripEntry } from "@travel-pocket/shared";
import {
  ALICE,
  BOB,
  accessToken,
  api,
  foreignKey,
  insertTrips,
  replace,
  resetDatabase,
} from "./helpers";

const trips: Trip[] = [
  {
    id: "sendai-2026",
    name: "仙台",
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
        description: "報到",
      },
      {
        id: "item-2",
        title: "午餐",
        location: "仙台車站",
        category: "food",
        startTime: "12:00",
        endTime: "13:00",
        description: ["牛舌", "毛豆奶昔"],
      },
    ],
  },
  { id: "day-5a", day: "5A", date: "2026-03-05", items: [] },
];

const shops: Shop[] = [
  {
    id: "shop-2",
    name: "藤崎百貨",
    location: "一番町",
    tags: ["百貨", "伴手禮"],
    businessHours: "10:00-19:00",
  },
  {
    id: "shop-1",
    name: "喜久水庵",
    location: "仙台車站",
    tags: [],
    businessHours: "09:00-20:00",
  },
];

const info: InfoItem[] = [
  {
    id: "info-1",
    title: "緊急聯絡",
    icon: "phone",
    links: [{ label: "駐日代表處", url: "https://example.com/embassy" }],
  },
];

const newTrip: NewTrip = {
  name: "東京",
  startDate: "2026-10-01",
  endDate: "2026-10-05",
  coverImage: "https://example.com/tokyo.jpg",
};

async function json<T>(res: Response | Promise<Response>): Promise<T> {
  return (await res).json() as Promise<T>;
}

/** `trips` as GET /trips lists them, before any edit. */
const entries: TripEntry[] = trips.map((trip) => ({ ...trip, version: 0 }));

function seedTrips(as = ALICE) {
  return insertTrips(as, trips);
}

function putTrip(tripId: string, body: unknown, version: number | string, as = ALICE) {
  const ifMatch = typeof version === "number" ? `"${version}"` : version;
  return api(`/trips/${tripId}`, { method: "PUT", body, as, headers: { "If-Match": ifMatch } });
}

beforeEach(resetDatabase);

describe("GET /health", () => {
  it("responds ok without signing in", async () => {
    const res = await api("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("authentication", () => {
  it.each([
    ["GET", "/me"],
    ["GET", "/trips"],
    ["POST", "/trips"],
    ["PUT", "/trips/sendai-2026"],
    ["DELETE", "/trips/sendai-2026"],
    ["GET", "/trips/sendai-2026/shops"],
    ["PUT", "/trips/sendai-2026/shops"],
  ])("rejects %s %s without an Access JWT", async (method, path) => {
    const body = method === "GET" || method === "DELETE" ? undefined : [];
    expect((await api(path, { method, body })).status).toBe(401);
  });

  it.each([
    ["signed by an unknown key", () => accessToken(ALICE, {}, foreignKey)],
    ["for another application", () => accessToken(ALICE, { aud: ["other-aud"] })],
    ["from another issuer", () => accessToken(ALICE, { iss: "https://evil.cloudflareaccess.com" })],
    ["that has expired", () => accessToken(ALICE, { exp: Math.floor(Date.now() / 1000) - 60 })],
    ["without an email", () => accessToken(ALICE, { email: undefined })],
  ])("rejects a JWT %s", async (_, makeToken) => {
    expect((await api("/me", { token: await makeToken() })).status).toBe(401);
  });

  it("rejects a malformed JWT", async () => {
    expect((await api("/me", { token: "not-a-jwt" })).status).toBe(401);
  });

  it("checks sign-in before validating the request", async () => {
    expect((await api("/trips/bad.id/shops", { method: "PUT", body: "nope" })).status).toBe(401);
  });

  it("identifies the user by the email in the JWT, case-insensitively", async () => {
    expect(await json(api("/me", { as: "Alice@Example.com" }))).toEqual({ email: ALICE });
  });

  it("binds a new user on the first request, and only once", async () => {
    await api("/me", { as: ALICE });
    await api("/me", { as: "ALICE@example.com" });
    const { results } = await env.DB.prepare("SELECT email FROM users").all();
    expect(results).toEqual([{ email: ALICE }]);
  });
});

describe("DEV_USER_EMAIL", () => {
  it.each(["http://localhost:8787", "http://127.0.0.1:8787"])(
    "signs requests to %s in as the dev user",
    async (origin) => {
      expect(await json(api("/me", { origin }))).toEqual({ email: env.DEV_USER_EMAIL });
    }
  );

  it("never applies to other hosts", async () => {
    expect((await api("/me", { origin: "https://travel-pocket.example.workers.dev" })).status).toBe(401);
  });

  it("gives way to an Access JWT", async () => {
    const res = api("/me", { origin: "http://localhost:8787", as: ALICE });
    expect(await json(res)).toEqual({ email: ALICE });
  });
});

describe("GET /trips", () => {
  it("returns an empty array when there are no trips", async () => {
    const res = await api("/trips", { as: ALICE });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("lists trips in order with their versions, omitting absent optional fields", async () => {
    await seedTrips();
    const res = await api("/trips", { as: ALICE });
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
    expect(await res.json()).toStrictEqual(entries);
  });
});

describe("PUT /trips/:tripId", () => {
  const renamed: NewTrip = { ...newTrip, name: "仙台（改）" };

  it("replaces the trip's fields and returns it with a new version", async () => {
    await seedTrips();
    const res = await putTrip("sendai-2026", renamed, 0);
    expect(res.status).toBe(200);
    const updated = { ...renamed, id: "sendai-2026", version: 1 };
    expect(await res.json()).toStrictEqual(updated);
    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual([updated, entries[1]]);
  });

  it("does not touch the trip's data", async () => {
    await seedTrips();
    await replace("/trips/sendai-2026/itinerary", itinerary, ALICE);
    await replace("/trips/sendai-2026/shops", shops, ALICE);
    await replace("/trips/sendai-2026/info", info, ALICE);

    expect((await putTrip("sendai-2026", renamed, 0)).status).toBe(200);

    expect(await json(api("/trips/sendai-2026/itinerary", { as: ALICE }))).toStrictEqual(itinerary);
    expect(await json(api("/trips/sendai-2026/shops", { as: ALICE }))).toStrictEqual(shops);
    expect(await json(api("/trips/sendai-2026/info", { as: ALICE }))).toStrictEqual(info);
  });

  it("answers 412 and changes nothing when the trip changed since it was read", async () => {
    await seedTrips();
    expect((await putTrip("sendai-2026", renamed, 0)).status).toBe(200);
    const res = await putTrip("sendai-2026", { ...newTrip, name: "舊的" }, 0);
    expect(res.status).toBe(412);
    const [first] = await json<TripEntry[]>(api("/trips", { as: ALICE }));
    expect(first).toStrictEqual({ ...renamed, id: "sendai-2026", version: 1 });
  });

  it("answers 428 without If-Match, and 400 for one that is not a version", async () => {
    await seedTrips();
    const res = await api("/trips/sendai-2026", { method: "PUT", body: renamed, as: ALICE });
    expect(res.status).toBe(428);
    expect((await putTrip("sendai-2026", renamed, "*")).status).toBe(400);
    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual(entries);
  });

  it.each([
    ["a missing field", { ...renamed, name: undefined }],
    ["an array", [renamed]],
    ["invalid JSON", "{not json"],
  ])("rejects a body with %s", async (_, body) => {
    await seedTrips();
    expect((await putTrip("sendai-2026", body, 0)).status).toBe(400);
    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual(entries);
  });

  it("keeps its id whatever the body says", async () => {
    await seedTrips();
    await putTrip("sendai-2026", { ...renamed, id: "kyushu-2024" }, 0);
    const listed = await json<TripEntry[]>(api("/trips", { as: ALICE }));
    expect(listed.map((trip) => trip.id)).toEqual(["sendai-2026", "kyushu-2024"]);
    expect(listed[1]).toStrictEqual(entries[1]);
  });

  it("answers 404 for a trip that does not exist, and 400 for an invalid tripId", async () => {
    expect((await putTrip("nowhere", renamed, 0)).status).toBe(404);
    expect((await putTrip("bad.id", renamed, 0)).status).toBe(400);
  });

  it("is gone for the whole list", async () => {
    await seedTrips();
    const res = await api("/trips", { method: "PUT", body: trips, as: ALICE });
    expect(res.status).toBe(404);
  });
});

describe("POST /trips", () => {
  it("creates a trip under a server-assigned id, after the existing ones", async () => {
    await seedTrips();
    const res = await api("/trips", { method: "POST", body: newTrip, as: ALICE });
    expect(res.status).toBe(201);
    const created = await json<TripEntry>(res);
    expect(created).toStrictEqual({ ...newTrip, id: created.id, version: 0 });
    expect(created.id).toMatch(ID_PATTERN);
    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual([...entries, created]);
  });

  it("starts a first trip for a new user", async () => {
    const created = await json<TripEntry>(api("/trips", { method: "POST", body: newTrip, as: ALICE }));
    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual([created]);
    expect(await json(api(`/trips/${created.id}/shops`, { as: ALICE }))).toEqual([]);
  });

  it("ignores an id sent by the client", async () => {
    await seedTrips(BOB);
    const body = { ...newTrip, id: "sendai-2026" };
    const created = await json<TripEntry>(api("/trips", { method: "POST", body, as: ALICE }));
    expect(created.id).not.toBe("sendai-2026");
    expect(await json(api("/trips", { as: BOB }))).toStrictEqual(entries);
  });

  it("drops unknown fields, such as the old snapshot", async () => {
    const body = { ...newTrip, snapshot: "data/tokyo/snapshot.jpg" };
    const created = await json<TripEntry>(api("/trips", { method: "POST", body, as: ALICE }));
    expect(created).toStrictEqual({ ...newTrip, id: created.id, version: 0 });
    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual([created]);
  });

  it.each([
    ["a missing field", { ...newTrip, name: undefined }],
    ["a field of the wrong type", { ...newTrip, startDate: 20261001 }],
    ["an array", [newTrip]],
    ["invalid JSON", "{not json"],
  ])("rejects a body with %s", async (_, body) => {
    expect((await api("/trips", { method: "POST", body, as: ALICE })).status).toBe(400);
    expect(await json(api("/trips", { as: ALICE }))).toEqual([]);
  });
});

describe("DELETE /trips/:tripId", () => {
  async function countRows(table: string, tripId: string): Promise<number | null> {
    return env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE trip_id = ?`)
      .bind(tripId)
      .first<number>("n");
  }

  it("deletes the trip together with its itinerary, shops and info", async () => {
    await seedTrips();
    await replace("/trips/sendai-2026/itinerary", itinerary, ALICE);
    await replace("/trips/sendai-2026/shops", shops, ALICE);
    await replace("/trips/sendai-2026/info", info, ALICE);

    const res = await api("/trips/sendai-2026", { method: "DELETE", as: ALICE });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual([entries[1]]);
    expect((await api("/trips/sendai-2026/shops", { as: ALICE })).status).toBe(404);
    for (const table of ["itinerary_days", "itinerary_items", "shops", "info_items"]) {
      expect(await countRows(table, "sendai-2026")).toBe(0);
    }
  });

  it("keeps the user's other trips and their data", async () => {
    await seedTrips();
    await replace("/trips/kyushu-2024/shops", shops, ALICE);
    await api("/trips/sendai-2026", { method: "DELETE", as: ALICE });
    expect(await json(api("/trips/kyushu-2024/shops", { as: ALICE }))).toStrictEqual(shops);
  });

  it("answers 404 for another user's trip and leaves it alone", async () => {
    await seedTrips(ALICE);
    await replace("/trips/sendai-2026/shops", shops, ALICE);
    expect((await api("/trips/sendai-2026", { method: "DELETE", as: BOB })).status).toBe(404);
    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual(entries);
    expect(await json(api("/trips/sendai-2026/shops", { as: ALICE }))).toStrictEqual(shops);
  });

  it("answers 404 for a trip that does not exist", async () => {
    expect((await api("/trips/nowhere", { method: "DELETE", as: ALICE })).status).toBe(404);
  });

  it("returns 400 for an invalid tripId", async () => {
    expect((await api("/trips/bad.id", { method: "DELETE", as: ALICE })).status).toBe(400);
  });
});

describe("/trips/:tripId/:type", () => {
  it.each([
    ["itinerary", itinerary],
    ["shops", shops],
    ["info", info],
  ] as const)("round-trips %s, including JSON fields and order", async (type, data) => {
    await seedTrips();
    const put = await replace(`/trips/sendai-2026/${type}`, data, ALICE);
    expect(put.status).toBe(200);
    const res = await api(`/trips/sendai-2026/${type}`, { as: ALICE });
    expect(res.status).toBe(200);
    expect(await res.json()).toStrictEqual(data);
  });

  it("returns an empty array for a trip without data", async () => {
    await seedTrips();
    expect(await json(api("/trips/kyushu-2024/shops", { as: ALICE }))).toEqual([]);
  });

  it("stores numeric days as strings", async () => {
    await seedTrips();
    const body = [{ ...itinerary[0], day: 1 }];
    await replace("/trips/sendai-2026/itinerary", body, ALICE);
    const [day] = await json<ItineraryDay[]>(api("/trips/sendai-2026/itinerary", { as: ALICE }));
    expect(day.day).toBe("1");
  });

  it("replaces the previous data instead of merging", async () => {
    await seedTrips();
    await replace("/trips/sendai-2026/shops", shops, ALICE);
    await replace("/trips/sendai-2026/shops", [shops[1]], ALICE);
    expect(await json(api("/trips/sendai-2026/shops", { as: ALICE }))).toStrictEqual([shops[1]]);
  });

  it("keeps data of other trips untouched", async () => {
    await seedTrips();
    await replace("/trips/sendai-2026/shops", shops, ALICE);
    await replace("/trips/kyushu-2024/shops", [shops[0]], ALICE);
    expect(await json(api("/trips/sendai-2026/shops", { as: ALICE }))).toStrictEqual(shops);
  });

  it("drops the map links and thumbnails that older clients still send", async () => {
    await seedTrips();
    const oldItinerary = itinerary.map((day) => ({
      ...day,
      items: day.items.map((item) => ({
        ...item,
        googleMapLink: "https://maps.example/1",
        thumbnail: "https://example.com/thumb.jpg",
      })),
    }));
    const oldShops = shops.map((shop) => ({ ...shop, googleMapLink: "https://maps.example/shop" }));
    const putItinerary = await replace("/trips/sendai-2026/itinerary", oldItinerary, ALICE);
    expect(putItinerary.status).toBe(200);
    expect((await replace("/trips/sendai-2026/shops", oldShops, ALICE)).status).toBe(200);
    expect(await json(api("/trips/sendai-2026/itinerary", { as: ALICE }))).toStrictEqual(itinerary);
    expect(await json(api("/trips/sendai-2026/shops", { as: ALICE }))).toStrictEqual(shops);
  });

  it("handles a long itinerary in one request", async () => {
    await seedTrips();
    const days: ItineraryDay[] = Array.from({ length: 20 }, (_, d) => ({
      id: `day-${d}`,
      day: String(d + 1),
      date: `2026-04-${String(d + 1).padStart(2, "0")}`,
      items: Array.from({ length: 10 }, (_, i) => ({ ...itinerary[0].items[0], id: `item-${i}` })),
    }));
    const put = await replace("/trips/sendai-2026/itinerary", days, ALICE);
    expect(put.status).toBe(200);
    expect(await json(api("/trips/sendai-2026/itinerary", { as: ALICE }))).toStrictEqual(days);
  });

  it("returns 404 for a trip that does not exist", async () => {
    expect((await replace("/trips/nowhere/shops", shops, ALICE)).status).toBe(404);
    expect((await api("/trips/nowhere/shops", { as: ALICE })).status).toBe(404);
  });

  it("returns 400 for an invalid tripId", async () => {
    expect((await replace("/trips/bad.id/shops", shops, ALICE)).status).toBe(400);
    expect((await api("/trips/bad%20id/shops", { as: ALICE })).status).toBe(400);
  });

  it("returns 400 for an unknown type", async () => {
    await seedTrips();
    expect((await replace("/trips/sendai-2026/hotels", [], ALICE)).status).toBe(400);
    expect((await api("/trips/sendai-2026/hotels", { as: ALICE })).status).toBe(400);
  });

  it("returns 400 when the body is not an array", async () => {
    await seedTrips();
    const res = await replace("/trips/sendai-2026/shops", shops[0], ALICE);
    expect(res.status).toBe(400);
  });

  it("returns 400 and keeps the old data when an element is missing fields", async () => {
    await seedTrips();
    await replace("/trips/sendai-2026/shops", shops, ALICE);
    const res = await replace("/trips/sendai-2026/shops", [{ id: "shop-3" }], ALICE);
    expect(res.status).toBe(400);
    expect(await json(api("/trips/sendai-2026/shops", { as: ALICE }))).toStrictEqual(shops);
    // Nothing was written, so the version stays too.
    const get = await api("/trips/sendai-2026/shops", { as: ALICE });
    expect(get.headers.get("ETag")).toBe('"1"');
  });
});

describe("versions of a trip's data", () => {
  function put(type: string, body: unknown, ifMatch?: string) {
    const headers: Record<string, string> = ifMatch === undefined ? {} : { "If-Match": ifMatch };
    return api(`/trips/sendai-2026/${type}`, { method: "PUT", body, as: ALICE, headers });
  }

  beforeEach(() => seedTrips());

  it("answers GET with the version as ETag, starting at 0", async () => {
    const res = await api("/trips/sendai-2026/shops", { as: ALICE });
    expect(res.headers.get("ETag")).toBe('"0"');
  });

  it("bumps the version on every write and answers with the new ETag", async () => {
    const first = await put("shops", shops, '"0"');
    expect(first.status).toBe(200);
    expect(first.headers.get("ETag")).toBe('"1"');
    const second = await put("shops", [shops[0]], '"1"');
    expect(second.headers.get("ETag")).toBe('"2"');
    const get = await api("/trips/sendai-2026/shops", { as: ALICE });
    expect(get.headers.get("ETag")).toBe('"2"');
  });

  it("answers 412 and keeps the data when the version is stale", async () => {
    await put("shops", shops, '"0"');
    const res = await put("shops", [], '"0"');
    expect(res.status).toBe(412);
    expect(await json(api("/trips/sendai-2026/shops", { as: ALICE }))).toStrictEqual(shops);
    const get = await api("/trips/sendai-2026/shops", { as: ALICE });
    expect(get.headers.get("ETag")).toBe('"1"');
  });

  it("answers 412 for a version from the future", async () => {
    expect((await put("shops", shops, '"5"')).status).toBe(412);
    expect(await json(api("/trips/sendai-2026/shops", { as: ALICE }))).toEqual([]);
  });

  it("lets only one of two writes based on the same version through", async () => {
    const results = await Promise.all([put("shops", shops, '"0"'), put("shops", [shops[1]], '"0"')]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 412]);
    const winner = results[0].status === 200 ? shops : [shops[1]];
    expect(await json(api("/trips/sendai-2026/shops", { as: ALICE }))).toStrictEqual(winner);
  });

  it("keeps a separate version for each list and for the trip's fields", async () => {
    await put("shops", shops, '"0"');
    expect((await put("info", info, '"0"')).status).toBe(200);
    expect((await put("itinerary", itinerary, '"0"')).status).toBe(200);
    expect((await putTrip("sendai-2026", newTrip, 0)).status).toBe(200);
  });

  it("answers 428 without If-Match, and 400 for one that is not a version", async () => {
    expect((await put("shops", shops)).status).toBe(428);
    expect((await put("shops", shops, "*")).status).toBe(400);
    expect((await put("shops", shops, "W/\"0\"")).status).toBe(400);
    expect(await json(api("/trips/sendai-2026/shops", { as: ALICE }))).toEqual([]);
  });
});

describe("isolation between users", () => {
  beforeEach(async () => {
    await seedTrips(ALICE);
    await replace("/trips/sendai-2026/shops", shops, ALICE);
  });

  it("lists only the signed-in user's trips", async () => {
    expect(await json(api("/trips", { as: BOB }))).toEqual([]);
    const bobs = await json<TripEntry>(api("/trips", { method: "POST", body: newTrip, as: BOB }));
    expect(await json(api("/trips", { as: BOB }))).toStrictEqual([bobs]);
    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual(entries);
  });

  it("answers 404 for another user's trip data, and leaves it untouched", async () => {
    expect((await api("/trips/sendai-2026/shops", { as: BOB })).status).toBe(404);
    const put = await replace("/trips/sendai-2026/shops", [], BOB);
    expect(put.status).toBe(404);
    expect(await json(api("/trips/sendai-2026/shops", { as: ALICE }))).toStrictEqual(shops);
  });

  it("answers 404 for another user's trip fields, and leaves them untouched", async () => {
    const hijack = { ...newTrip, name: "Bob's now" };
    expect((await putTrip("sendai-2026", hijack, 0, BOB)).status).toBe(404);
    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual(entries);
    expect(await json(api("/trips", { as: BOB }))).toEqual([]);
  });
});

describe("CORS", () => {
  it("allows origins listed in CORS_ORIGINS", async () => {
    const res = await api("/health", { headers: { Origin: "http://localhost:5173" } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
  });

  it("does not allow other origins", async () => {
    const res = await api("/health", { headers: { Origin: "https://evil.example" } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("answers preflight requests without signing in", async () => {
    const res = await api("/trips", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, If-Match",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toMatch(/POST/);
    expect(res.headers.get("Access-Control-Allow-Methods")).toMatch(/PUT/);
    expect(res.headers.get("Access-Control-Allow-Methods")).toMatch(/DELETE/);
    expect(res.headers.get("Access-Control-Allow-Headers")).toMatch(/Content-Type/i);
    expect(res.headers.get("Access-Control-Allow-Headers")).toMatch(/If-Match/i);
  });

  it("lets allowed origins read the ETag", async () => {
    const res = await api("/health", { headers: { Origin: "http://localhost:5173" } });
    expect(res.headers.get("Access-Control-Expose-Headers")).toMatch(/ETag/i);
  });
});
