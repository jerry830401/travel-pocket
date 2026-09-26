import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_COVER_BYTES } from "@travel-pocket/shared";
import type { CoverUpload, Trip } from "@travel-pocket/shared";
import { ALICE, BOB, api, resetDatabase } from "./helpers";

const trips: Trip[] = [
  { id: "sendai-2026", name: "仙台", startDate: "2026-03-01", endDate: "2026-03-08", coverImage: "" },
  {
    id: "kyushu-2024",
    name: "九州",
    startDate: "2024-05-01",
    endDate: "2024-05-03",
    coverImage: "/data/kyushu-2024/snapshot.jpg",
  },
];

// Just the signatures the API looks at, followed by some payload.
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 4, 5]);
const webp = new TextEncoder().encode("RIFF\x10\x00\x00\x00WEBPVP8 ");
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');

function upload(tripId: string, body: Uint8Array, as = ALICE, type = "image/jpeg") {
  return api(`/trips/${tripId}/cover`, { method: "PUT", body, as, headers: { "Content-Type": type } });
}

async function listTrips(as = ALICE): Promise<Trip[]> {
  return (await api("/trips", { as })).json();
}

function countCovers(tripId: string): Promise<number | null> {
  return env.DB.prepare("SELECT COUNT(*) AS n FROM trip_covers WHERE trip_id = ?")
    .bind(tripId)
    .first<number>("n");
}

beforeEach(async () => {
  await resetDatabase();
  expect((await api("/trips", { method: "PUT", body: trips, as: ALICE })).status).toBe(200);
});

describe("PUT /trips/:tripId/cover", () => {
  it("stores the image and points the trip at it", async () => {
    const res = await upload("sendai-2026", jpeg);
    expect(res.status).toBe(200);
    const { coverImage } = await res.json<CoverUpload>();
    expect(coverImage).toMatch(/^\/api\/trips\/sendai-2026\/cover\?v=\d+$/);
    expect(await listTrips()).toStrictEqual([{ ...trips[0], coverImage }, trips[1]]);
  });

  it("replaces the previous cover", async () => {
    await upload("sendai-2026", jpeg);
    await upload("sendai-2026", png, ALICE, "image/png");
    const res = await api("/trips/sendai-2026/cover", { as: ALICE });
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(png);
    expect(await countCovers("sendai-2026")).toBe(1);
  });

  it.each([
    ["an SVG", svg],
    ["text", new TextEncoder().encode("hello")],
    ["an empty body", new Uint8Array()],
  ])("rejects %s with 400", async (_, body) => {
    expect((await upload("sendai-2026", body, ALICE, "image/svg+xml")).status).toBe(400);
    expect(await countCovers("sendai-2026")).toBe(0);
  });

  it("rejects an image over MAX_COVER_BYTES with 413", async () => {
    const body = new Uint8Array(MAX_COVER_BYTES + 1);
    body.set(jpeg);
    expect((await upload("sendai-2026", body)).status).toBe(413);
    expect(await countCovers("sendai-2026")).toBe(0);
  });

  it("answers 404 for another user's trip and leaves it alone", async () => {
    expect((await upload("sendai-2026", jpeg, BOB)).status).toBe(404);
    expect(await countCovers("sendai-2026")).toBe(0);
    expect(await listTrips()).toStrictEqual(trips);
  });

  it("answers 404 for a trip that does not exist", async () => {
    expect((await upload("nowhere", jpeg)).status).toBe(404);
  });

  it("returns 400 for an invalid tripId", async () => {
    expect((await upload("bad.id", jpeg)).status).toBe(400);
  });

  it("requires signing in", async () => {
    const res = await api("/trips/sendai-2026/cover", { method: "PUT", body: jpeg });
    expect(res.status).toBe(401);
  });
});

describe("GET /trips/:tripId/cover", () => {
  it("serves the image with long-lived, private caching", async () => {
    await upload("sendai-2026", jpeg);
    const res = await api("/trips/sendai-2026/cover", { as: ALICE });
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(jpeg);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it.each([
    ["image/png", png],
    ["image/webp", webp],
  ])("serves %s by what the bytes are, not by the header sent", async (type, body) => {
    await upload("sendai-2026", body, ALICE, "image/jpeg");
    const res = await api("/trips/sendai-2026/cover", { as: ALICE });
    expect(res.headers.get("Content-Type")).toBe(type);
  });

  it("answers 404 for a trip without a cover", async () => {
    expect((await api("/trips/sendai-2026/cover", { as: ALICE })).status).toBe(404);
  });

  it("answers 404 for another user's trip", async () => {
    await upload("sendai-2026", jpeg);
    expect((await api("/trips/sendai-2026/cover", { as: BOB })).status).toBe(404);
  });

  it("requires signing in", async () => {
    expect((await api("/trips/sendai-2026/cover")).status).toBe(401);
  });
});

describe("keeping covers in step with their trips", () => {
  let coverImage: string;

  beforeEach(async () => {
    ({ coverImage } = await (await upload("sendai-2026", jpeg)).json<CoverUpload>());
  });

  it("keeps the cover while the trip still points at it", async () => {
    const renamed = [{ ...trips[0], name: "仙台（改）", coverImage }, trips[1]];
    expect((await api("/trips", { method: "PUT", body: renamed, as: ALICE })).status).toBe(200);
    expect((await api("/trips/sendai-2026/cover", { as: ALICE })).status).toBe(200);
  });

  it.each([
    ["removed", ""],
    ["replaced by another image", "/data/sendai-2026/snapshot.jpg"],
  ])("drops the cover once it is %s", async (_, next) => {
    const body = [{ ...trips[0], coverImage: next }, trips[1]];
    expect((await api("/trips", { method: "PUT", body, as: ALICE })).status).toBe(200);
    expect(await countCovers("sendai-2026")).toBe(0);
    expect((await api("/trips/sendai-2026/cover", { as: ALICE })).status).toBe(404);
  });

  it("leaves other users' covers alone", async () => {
    const bobs: Trip = { ...trips[0], id: "bob-trip" };
    expect((await api("/trips", { method: "PUT", body: [bobs], as: BOB })).status).toBe(200);
    expect(await countCovers("sendai-2026")).toBe(1);
  });

  it("deletes the cover with its trip", async () => {
    expect((await api("/trips/sendai-2026", { method: "DELETE", as: ALICE })).status).toBe(200);
    expect(await countCovers("sendai-2026")).toBe(0);
  });
});
