import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_COVER_BYTES } from "@travel-pocket/shared";
import type { CoverUpload, Trip, TripEntry } from "@travel-pocket/shared";
import { ALICE, BOB, api, insertTrips, resetDatabase } from "./helpers";

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

const entries: TripEntry[] = trips.map((trip) => ({ ...trip, version: 0 }));

// Just the signatures the API looks at, followed by some payload.
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 4, 5]);
const webp = new TextEncoder().encode("RIFF\x10\x00\x00\x00WEBPVP8 ");
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');

function upload(tripId: string, body: Uint8Array, as = ALICE, type = "image/jpeg") {
  return api(`/trips/${tripId}/cover`, { method: "PUT", body, as, headers: { "Content-Type": type } });
}

async function listTrips(as = ALICE): Promise<TripEntry[]> {
  return (await api("/trips", { as })).json();
}

function putTrip(trip: TripEntry, as = ALICE) {
  const { id, version, ...fields } = trip;
  return api(`/trips/${id}`, { method: "PUT", body: fields, as, headers: { "If-Match": `"${version}"` } });
}

function countCovers(tripId: string): Promise<number | null> {
  return env.DB.prepare("SELECT COUNT(*) AS n FROM trip_covers WHERE trip_id = ?")
    .bind(tripId)
    .first<number>("n");
}

beforeEach(async () => {
  await resetDatabase();
  await insertTrips(ALICE, trips);
});

describe("PUT /trips/:tripId/cover", () => {
  it("stores the image, points the trip at it and bumps the trip's version", async () => {
    const res = await upload("sendai-2026", jpeg);
    expect(res.status).toBe(200);
    const { coverImage, version } = await res.json<CoverUpload>();
    expect(coverImage).toMatch(/^\/api\/trips\/sendai-2026\/cover\?v=\d+$/);
    expect(version).toBe(1);
    expect(await listTrips()).toStrictEqual([{ ...entries[0], coverImage, version }, entries[1]]);
  });

  it("makes an edit based on the version before the upload stale", async () => {
    await upload("sendai-2026", jpeg);
    expect((await putTrip({ ...entries[0], name: "舊的" })).status).toBe(412);
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
    expect(await listTrips()).toStrictEqual(entries);
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
  let uploaded: TripEntry;

  beforeEach(async () => {
    const { coverImage, version } = await (await upload("sendai-2026", jpeg)).json<CoverUpload>();
    uploaded = { ...entries[0], coverImage, version };
  });

  it("keeps the cover while the trip still points at it", async () => {
    expect((await putTrip({ ...uploaded, name: "仙台（改）" })).status).toBe(200);
    expect((await api("/trips/sendai-2026/cover", { as: ALICE })).status).toBe(200);
  });

  it.each([
    ["removed", ""],
    ["replaced by another image", "/data/sendai-2026/snapshot.jpg"],
  ])("drops the cover once it is %s", async (_, next) => {
    expect((await putTrip({ ...uploaded, coverImage: next })).status).toBe(200);
    expect(await countCovers("sendai-2026")).toBe(0);
    expect((await api("/trips/sendai-2026/cover", { as: ALICE })).status).toBe(404);
  });

  it("keeps the cover when a stale edit is refused", async () => {
    expect((await putTrip({ ...entries[0], coverImage: "" })).status).toBe(412);
    expect(await countCovers("sendai-2026")).toBe(1);
  });

  it("leaves the covers of other trips alone", async () => {
    await upload("kyushu-2024", png, ALICE, "image/png");
    expect((await putTrip({ ...entries[1], version: 1, coverImage: "" })).status).toBe(200);
    expect(await countCovers("sendai-2026")).toBe(1);
  });

  it("leaves other users' covers alone", async () => {
    const bobs: Trip = { ...trips[0], id: "bob-trip" };
    await insertTrips(BOB, [bobs]);
    expect((await putTrip({ ...bobs, version: 0 }, BOB)).status).toBe(200);
    expect(await countCovers("sendai-2026")).toBe(1);
  });

  it("deletes the cover with its trip", async () => {
    expect((await api("/trips/sendai-2026", { method: "DELETE", as: ALICE })).status).toBe(200);
    expect(await countCovers("sendai-2026")).toBe(0);
  });
});
