import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { ID_PATTERN } from "@travel-pocket/shared";
import type { InfoItem, ItineraryDay, NewTrip, Shop, Trip } from "@travel-pocket/shared";
import { ALICE, BOB, accessToken, api, foreignKey, resetDatabase } from "./helpers";

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

async function seedTrips(as = ALICE) {
  expect((await api("/trips", { method: "PUT", body: trips, as })).status).toBe(200);
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
    ["PUT", "/trips"],
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
    expect((await api("/me", { origin: "https://travel-pocket.example.workers.dev" })).status).toBe(
      401
    );
  });

  it("gives way to an Access JWT", async () => {
    const res = api("/me", { origin: "http://localhost:8787", as: ALICE });
    expect(await json(res)).toEqual({ email: ALICE });
  });
});

describe("/trips", () => {
  it("returns an empty array when there are no trips", async () => {
    const res = await api("/trips", { as: ALICE });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("round-trips trips in order, omitting absent optional fields", async () => {
    await seedTrips();
    const res = await api("/trips", { as: ALICE });
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
    expect(await res.json()).toStrictEqual(trips);
  });

  it("upserts: updates existing trips and follows the new order", async () => {
    await seedTrips();
    const updated = [{ ...trips[1], name: "九州 2024" }, trips[0]];
    expect((await api("/trips", { method: "PUT", body: updated, as: ALICE })).status).toBe(200);
    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual(updated);
  });

  it("does not cascade-delete a trip's data", async () => {
    await seedTrips();
    await api("/trips/sendai-2026/itinerary", { method: "PUT", body: itinerary, as: ALICE });
    await api("/trips/sendai-2026/shops", { method: "PUT", body: shops, as: ALICE });
    await api("/trips/sendai-2026/info", { method: "PUT", body: info, as: ALICE });

    const renamed = [{ ...trips[0], name: "仙台（改）" }];
    expect((await api("/trips", { method: "PUT", body: renamed, as: ALICE })).status).toBe(200);

    expect(await json(api("/trips/sendai-2026/itinerary", { as: ALICE }))).toStrictEqual(itinerary);
    expect(await json(api("/trips/sendai-2026/shops", { as: ALICE }))).toStrictEqual(shops);
    expect(await json(api("/trips/sendai-2026/info", { as: ALICE }))).toStrictEqual(info);
  });

  it("rejects a trip whose id does not match ID_PATTERN", async () => {
    const body = [{ ...trips[0], id: "bad id" }];
    expect((await api("/trips", { method: "PUT", body, as: ALICE })).status).toBe(400);
  });

  it("rejects a body that is not an array", async () => {
    expect((await api("/trips", { method: "PUT", body: trips[0], as: ALICE })).status).toBe(400);
    expect((await api("/trips", { method: "PUT", body: "{not json", as: ALICE })).status).toBe(400);
  });
});

describe("POST /trips", () => {
  it("creates a trip under a server-assigned id, after the existing ones", async () => {
    await seedTrips();
    const res = await api("/trips", { method: "POST", body: newTrip, as: ALICE });
    expect(res.status).toBe(201);
    const created = await json<Trip>(res);
    expect(created).toStrictEqual({ ...newTrip, id: created.id });
    expect(created.id).toMatch(ID_PATTERN);
    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual([...trips, created]);
  });

  it("starts a first trip for a new user", async () => {
    const created = await json<Trip>(api("/trips", { method: "POST", body: newTrip, as: ALICE }));
    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual([created]);
    expect(await json(api(`/trips/${created.id}/shops`, { as: ALICE }))).toEqual([]);
  });

  it("ignores an id sent by the client", async () => {
    await seedTrips(BOB);
    const body = { ...newTrip, id: "sendai-2026" };
    const created = await json<Trip>(api("/trips", { method: "POST", body, as: ALICE }));
    expect(created.id).not.toBe("sendai-2026");
    expect(await json(api("/trips", { as: BOB }))).toStrictEqual(trips);
  });

  it("drops unknown fields, such as the old snapshot", async () => {
    const body = { ...newTrip, snapshot: "data/tokyo/snapshot.jpg" };
    const created = await json<Trip>(api("/trips", { method: "POST", body, as: ALICE }));
    expect(created).toStrictEqual({ ...newTrip, id: created.id });
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
    await api("/trips/sendai-2026/itinerary", { method: "PUT", body: itinerary, as: ALICE });
    await api("/trips/sendai-2026/shops", { method: "PUT", body: shops, as: ALICE });
    await api("/trips/sendai-2026/info", { method: "PUT", body: info, as: ALICE });

    const res = await api("/trips/sendai-2026", { method: "DELETE", as: ALICE });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual([trips[1]]);
    expect((await api("/trips/sendai-2026/shops", { as: ALICE })).status).toBe(404);
    for (const table of ["itinerary_days", "itinerary_items", "shops", "info_items"]) {
      expect(await countRows(table, "sendai-2026")).toBe(0);
    }
  });

  it("keeps the user's other trips and their data", async () => {
    await seedTrips();
    await api("/trips/kyushu-2024/shops", { method: "PUT", body: shops, as: ALICE });
    await api("/trips/sendai-2026", { method: "DELETE", as: ALICE });
    expect(await json(api("/trips/kyushu-2024/shops", { as: ALICE }))).toStrictEqual(shops);
  });

  it("answers 404 for another user's trip and leaves it alone", async () => {
    await seedTrips(ALICE);
    await api("/trips/sendai-2026/shops", { method: "PUT", body: shops, as: ALICE });
    expect((await api("/trips/sendai-2026", { method: "DELETE", as: BOB })).status).toBe(404);
    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual(trips);
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
    const put = await api(`/trips/sendai-2026/${type}`, { method: "PUT", body: data, as: ALICE });
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
    await api("/trips/sendai-2026/itinerary", { method: "PUT", body, as: ALICE });
    const [day] = await json<ItineraryDay[]>(api("/trips/sendai-2026/itinerary", { as: ALICE }));
    expect(day.day).toBe("1");
  });

  it("replaces the previous data instead of merging", async () => {
    await seedTrips();
    await api("/trips/sendai-2026/shops", { method: "PUT", body: shops, as: ALICE });
    await api("/trips/sendai-2026/shops", { method: "PUT", body: [shops[1]], as: ALICE });
    expect(await json(api("/trips/sendai-2026/shops", { as: ALICE }))).toStrictEqual([shops[1]]);
  });

  it("keeps data of other trips untouched", async () => {
    await seedTrips();
    await api("/trips/sendai-2026/shops", { method: "PUT", body: shops, as: ALICE });
    await api("/trips/kyushu-2024/shops", { method: "PUT", body: [shops[0]], as: ALICE });
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
    const putItinerary = await api("/trips/sendai-2026/itinerary", { method: "PUT", body: oldItinerary, as: ALICE });
    expect(putItinerary.status).toBe(200);
    expect((await api("/trips/sendai-2026/shops", { method: "PUT", body: oldShops, as: ALICE })).status).toBe(200);
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
    const put = await api("/trips/sendai-2026/itinerary", { method: "PUT", body: days, as: ALICE });
    expect(put.status).toBe(200);
    expect(await json(api("/trips/sendai-2026/itinerary", { as: ALICE }))).toStrictEqual(days);
  });

  it("returns 404 for a trip that does not exist", async () => {
    expect((await api("/trips/nowhere/shops", { method: "PUT", body: shops, as: ALICE })).status).toBe(
      404
    );
    expect((await api("/trips/nowhere/shops", { as: ALICE })).status).toBe(404);
  });

  it("returns 400 for an invalid tripId", async () => {
    expect((await api("/trips/bad.id/shops", { method: "PUT", body: shops, as: ALICE })).status).toBe(
      400
    );
    expect((await api("/trips/bad%20id/shops", { as: ALICE })).status).toBe(400);
  });

  it("returns 400 for an unknown type", async () => {
    await seedTrips();
    expect((await api("/trips/sendai-2026/hotels", { method: "PUT", body: [], as: ALICE })).status).toBe(
      400
    );
    expect((await api("/trips/sendai-2026/hotels", { as: ALICE })).status).toBe(400);
  });

  it("returns 400 when the body is not an array", async () => {
    await seedTrips();
    const res = await api("/trips/sendai-2026/shops", { method: "PUT", body: shops[0], as: ALICE });
    expect(res.status).toBe(400);
  });

  it("returns 400 and keeps the old data when an element is missing fields", async () => {
    await seedTrips();
    await api("/trips/sendai-2026/shops", { method: "PUT", body: shops, as: ALICE });
    const res = await api("/trips/sendai-2026/shops", {
      method: "PUT",
      body: [{ id: "shop-3" }],
      as: ALICE,
    });
    expect(res.status).toBe(400);
    expect(await json(api("/trips/sendai-2026/shops", { as: ALICE }))).toStrictEqual(shops);
  });
});

describe("isolation between users", () => {
  beforeEach(async () => {
    await seedTrips(ALICE);
    await api("/trips/sendai-2026/shops", { method: "PUT", body: shops, as: ALICE });
  });

  it("lists only the signed-in user's trips", async () => {
    expect(await json(api("/trips", { as: BOB }))).toEqual([]);
    const bobs = await json<Trip>(api("/trips", { method: "POST", body: newTrip, as: BOB }));
    expect(await json(api("/trips", { as: BOB }))).toStrictEqual([bobs]);
    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual(trips);
  });

  it("answers 404 for another user's trip data, and leaves it untouched", async () => {
    expect((await api("/trips/sendai-2026/shops", { as: BOB })).status).toBe(404);
    const put = await api("/trips/sendai-2026/shops", { method: "PUT", body: [], as: BOB });
    expect(put.status).toBe(404);
    expect(await json(api("/trips/sendai-2026/shops", { as: ALICE }))).toStrictEqual(shops);
  });

  it("refuses an upsert that reuses another user's trip id", async () => {
    const hijack = [{ ...trips[0], name: "Bob's now" }];
    expect((await api("/trips", { method: "PUT", body: hijack, as: BOB })).status).toBe(409);
    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual(trips);
    expect(await json(api("/trips", { as: BOB }))).toEqual([]);
  });

  it("writes nothing when any id in the upsert is taken", async () => {
    const mixed = [{ ...trips[0], id: "bob-trip" }, trips[1]];
    expect((await api("/trips", { method: "PUT", body: mixed, as: BOB })).status).toBe(409);
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
        "Access-Control-Request-Headers": "Content-Type",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toMatch(/POST/);
    expect(res.headers.get("Access-Control-Allow-Methods")).toMatch(/PUT/);
    expect(res.headers.get("Access-Control-Allow-Methods")).toMatch(/DELETE/);
    expect(res.headers.get("Access-Control-Allow-Headers")).toMatch(/Content-Type/i);
  });
});
