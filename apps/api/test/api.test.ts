import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { InfoItem, ItineraryDay, Shop, Trip } from "@travel-pocket/shared";

const BASE = "https://api.test/api";
const AUTH = { Authorization: "Bearer test-token" }; // matches vitest.config.ts

function get(path: string, init?: RequestInit): Promise<Response> {
  return exports.default.fetch(`${BASE}${path}`, init);
}

function put(path: string, body: unknown, headers: Record<string, string> = AUTH) {
  return exports.default.fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const trips: Trip[] = [
  {
    id: "sendai-2026",
    name: "仙台",
    startDate: "2026-03-01",
    endDate: "2026-03-08",
    coverImage: "https://example.com/sendai.jpg",
    snapshot: "data/sendai-2026/snapshot.jpg",
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
        googleMapLink: "https://maps.example/1",
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
        thumbnail: "https://example.com/thumb.jpg",
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
    googleMapLink: "https://maps.example/shop-2",
  },
  {
    id: "shop-1",
    name: "喜久水庵",
    location: "仙台車站",
    tags: [],
    businessHours: "09:00-20:00",
    googleMapLink: "https://maps.example/shop-1",
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

async function seedTrips() {
  expect((await put("/trips", trips)).status).toBe(200);
}

beforeEach(async () => {
  // Storage is isolated per test file, not per test; start every test empty.
  await env.DB.prepare("DELETE FROM trips").run();
});

describe("GET /health", () => {
  it("responds ok", async () => {
    const res = await get("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("/trips", () => {
  it("returns an empty array when there are no trips", async () => {
    const res = await get("/trips");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("round-trips trips in order, omitting absent optional fields", async () => {
    await seedTrips();
    const res = await get("/trips");
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
    expect(await res.json()).toStrictEqual(trips);
  });

  it("upserts: updates existing trips and follows the new order", async () => {
    await seedTrips();
    const updated = [{ ...trips[1], name: "九州 2024" }, trips[0]];
    expect((await put("/trips", updated)).status).toBe(200);
    expect(await (await get("/trips")).json()).toStrictEqual(updated);
  });

  it("does not cascade-delete a trip's data", async () => {
    await seedTrips();
    await put("/trips/sendai-2026/itinerary", itinerary);
    await put("/trips/sendai-2026/shops", shops);
    await put("/trips/sendai-2026/info", info);

    expect((await put("/trips", [{ ...trips[0], name: "仙台（改）" }])).status).toBe(200);

    expect(await (await get("/trips/sendai-2026/itinerary")).json()).toStrictEqual(itinerary);
    expect(await (await get("/trips/sendai-2026/shops")).json()).toStrictEqual(shops);
    expect(await (await get("/trips/sendai-2026/info")).json()).toStrictEqual(info);
  });

  it("rejects a trip whose id does not match ID_PATTERN", async () => {
    const res = await put("/trips", [{ ...trips[0], id: "bad id" }]);
    expect(res.status).toBe(400);
  });

  it("rejects a body that is not an array", async () => {
    expect((await put("/trips", trips[0])).status).toBe(400);
    expect((await put("/trips", "{not json")).status).toBe(400);
  });
});

describe("/trips/:tripId/:type", () => {
  it.each([
    ["itinerary", itinerary],
    ["shops", shops],
    ["info", info],
  ] as const)("round-trips %s, including JSON fields and order", async (type, data) => {
    await seedTrips();
    expect((await put(`/trips/sendai-2026/${type}`, data)).status).toBe(200);
    const res = await get(`/trips/sendai-2026/${type}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toStrictEqual(data);
  });

  it("returns an empty array for a trip without data", async () => {
    await seedTrips();
    expect(await (await get("/trips/kyushu-2024/shops")).json()).toEqual([]);
  });

  it("stores numeric days as strings", async () => {
    await seedTrips();
    await put("/trips/sendai-2026/itinerary", [{ ...itinerary[0], day: 1 }]);
    const [day] = (await (await get("/trips/sendai-2026/itinerary")).json()) as ItineraryDay[];
    expect(day.day).toBe("1");
  });

  it("replaces the previous data instead of merging", async () => {
    await seedTrips();
    await put("/trips/sendai-2026/shops", shops);
    await put("/trips/sendai-2026/shops", [shops[1]]);
    expect(await (await get("/trips/sendai-2026/shops")).json()).toStrictEqual([shops[1]]);
  });

  it("keeps data of other trips untouched", async () => {
    await seedTrips();
    await put("/trips/sendai-2026/shops", shops);
    await put("/trips/kyushu-2024/shops", [shops[0]]);
    expect(await (await get("/trips/sendai-2026/shops")).json()).toStrictEqual(shops);
  });

  it("handles a long itinerary in one request", async () => {
    await seedTrips();
    const days: ItineraryDay[] = Array.from({ length: 20 }, (_, d) => ({
      id: `day-${d}`,
      day: String(d + 1),
      date: `2026-04-${String(d + 1).padStart(2, "0")}`,
      items: Array.from({ length: 10 }, (_, i) => ({ ...itinerary[0].items[0], id: `item-${i}` })),
    }));
    expect((await put("/trips/sendai-2026/itinerary", days)).status).toBe(200);
    expect(await (await get("/trips/sendai-2026/itinerary")).json()).toStrictEqual(days);
  });

  it("returns 404 for a trip that does not exist", async () => {
    expect((await put("/trips/nowhere/shops", shops)).status).toBe(404);
    expect((await get("/trips/nowhere/shops")).status).toBe(404);
  });

  it("returns 400 for an invalid tripId", async () => {
    expect((await put("/trips/bad.id/shops", shops)).status).toBe(400);
    expect((await get("/trips/bad%20id/shops")).status).toBe(400);
  });

  it("returns 400 for an unknown type", async () => {
    await seedTrips();
    expect((await put("/trips/sendai-2026/hotels", [])).status).toBe(400);
    expect((await get("/trips/sendai-2026/hotels")).status).toBe(400);
  });

  it("returns 400 when the body is not an array", async () => {
    await seedTrips();
    expect((await put("/trips/sendai-2026/shops", shops[0])).status).toBe(400);
  });

  it("returns 400 and keeps the old data when an element is missing fields", async () => {
    await seedTrips();
    await put("/trips/sendai-2026/shops", shops);
    const res = await put("/trips/sendai-2026/shops", [{ id: "shop-3" }]);
    expect(res.status).toBe(400);
    expect(await (await get("/trips/sendai-2026/shops")).json()).toStrictEqual(shops);
  });
});

describe("authorization", () => {
  it.each([
    ["no token", {}],
    ["a wrong token", { Authorization: "Bearer nope" }],
  ])("rejects PUT with %s", async (_, headers) => {
    await seedTrips();
    expect((await put("/trips", trips, headers)).status).toBe(401);
    expect((await put("/trips/sendai-2026/shops", shops, headers)).status).toBe(401);
    expect(await (await get("/trips/sendai-2026/shops")).json()).toEqual([]);
  });

  it("checks the token before validating the request", async () => {
    expect((await put("/trips/bad.id/shops", "nope", {})).status).toBe(401);
  });

  it("does not require a token for GET", async () => {
    expect((await get("/trips")).status).toBe(200);
  });
});

describe("CORS", () => {
  it("allows origins listed in CORS_ORIGINS", async () => {
    const res = await get("/trips", { headers: { Origin: "http://localhost:5173" } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
  });

  it("does not allow other origins", async () => {
    const res = await get("/trips", { headers: { Origin: "https://evil.example" } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("answers preflight requests for authorized PUTs", async () => {
    const res = await get("/trips", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "Authorization, Content-Type",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("PUT");
    expect(res.headers.get("Access-Control-Allow-Headers")).toMatch(/Authorization/i);
  });
});
