import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { INVITE_CODE_PATTERN } from "@travel-pocket/shared";
import type { Invite, Shop, Trip, TripEntry, TripInvite, TripMembers } from "@travel-pocket/shared";
import { ALICE, BOB, CAROL, api, insertTrips, ownEntry, replace, resetDatabase } from "./helpers";

// Alice owns 仙台 and shares it; Bob and Carol ask to join through its invite code.

const sendai: Trip = {
  id: "sendai-2026",
  name: "仙台",
  startDate: "2026-03-01",
  endDate: "2026-03-08",
  coverImage: "",
};

const shops: Shop[] = [
  { id: "shop-1", name: "喜久水庵", location: "仙台車站", tags: [], businessHours: "09:00-20:00" },
];

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

async function json<T>(res: Response | Promise<Response>): Promise<T> {
  return (await res).json() as Promise<T>;
}

async function inviteCode(as = ALICE): Promise<string> {
  return (await json<TripInvite>(api("/trips/sendai-2026/invite", { method: "POST", as }))).inviteCode;
}

function requestToJoin(code: string, as: string) {
  return api(`/invites/${code}`, { method: "POST", as });
}

function approve(email: string, as = ALICE) {
  return api(`/trips/sendai-2026/members/${email}`, { method: "PUT", as });
}

function remove(email: string, as = ALICE) {
  return api(`/trips/sendai-2026/members/${email}`, { method: "DELETE", as });
}

function members(as = ALICE) {
  return json<TripMembers>(api("/trips/sendai-2026/members", { as }));
}

/** Bob asks to join and Alice approves. */
async function shareWithBob(): Promise<void> {
  await requestToJoin(await inviteCode(), BOB);
  expect((await approve(BOB)).status).toBe(200);
}

beforeEach(async () => {
  await resetDatabase();
  await insertTrips(ALICE, [sendai]);
  await replace("/trips/sendai-2026/shops", shops, ALICE);
});

describe("POST /trips/:tripId/invite", () => {
  it("creates the trip's invite code once and keeps returning it", async () => {
    const code = await inviteCode();
    expect(code).toMatch(INVITE_CODE_PATTERN);
    expect(await inviteCode()).toBe(code);
  });

  it("is only for the owner", async () => {
    expect((await api("/trips/sendai-2026/invite", { method: "POST", as: BOB })).status).toBe(404);
    await shareWithBob();
    expect((await api("/trips/sendai-2026/invite", { method: "POST", as: BOB })).status).toBe(403);
  });
});

describe("/invites/:code", () => {
  it("shows the invited trip to anyone signed in, without letting them in", async () => {
    const code = await inviteCode();
    const invite: Invite = { tripId: "sendai-2026", tripName: "仙台", ownerEmail: ALICE, status: "none" };
    expect(await json(api(`/invites/${code}`, { as: BOB }))).toStrictEqual(invite);
    expect(await json(api(`/invites/${code}`, { as: ALICE }))).toStrictEqual({ ...invite, status: "owner" });
    expect((await api("/trips/sendai-2026/shops", { as: BOB })).status).toBe(404);
  });

  it("turns into a request to join, once", async () => {
    const code = await inviteCode();
    expect((await json<Invite>(requestToJoin(code, BOB))).status).toBe("pending");
    expect((await json<Invite>(requestToJoin(code, BOB))).status).toBe("pending");
    expect((await json<Invite>(api(`/invites/${code}`, { as: BOB }))).status).toBe("pending");
    expect((await members()).members).toEqual([{ email: BOB, status: "pending" }]);
  });

  it("never makes the owner a member of their own trip", async () => {
    const code = await inviteCode();
    expect((await json<Invite>(requestToJoin(code, ALICE))).status).toBe("owner");
    expect((await members()).members).toEqual([]);
  });

  it("leaves a member as they are", async () => {
    const code = await inviteCode();
    await shareWithBob();
    expect((await json<Invite>(requestToJoin(code, BOB))).status).toBe("member");
  });

  it("answers 404 for an unknown code and 400 for one that is not a code", async () => {
    const unknown = "0".repeat(32);
    expect((await api(`/invites/${unknown}`, { as: BOB })).status).toBe(404);
    expect((await requestToJoin(unknown, BOB)).status).toBe(404);
    expect((await api("/invites/not-a-code", { as: BOB })).status).toBe(400);
  });

  it("requires signing in", async () => {
    const code = await inviteCode();
    expect((await api(`/invites/${code}`)).status).toBe(401);
    expect((await api(`/invites/${code}`, { method: "POST" })).status).toBe(401);
  });
});

describe("a pending request", () => {
  beforeEach(async () => {
    await requestToJoin(await inviteCode(), BOB);
  });

  it("gives no access to the trip yet", async () => {
    expect(await json(api("/trips", { as: BOB }))).toEqual([]);
    expect((await api("/trips/sendai-2026/shops", { as: BOB })).status).toBe(404);
    expect((await api("/trips/sendai-2026/members", { as: BOB })).status).toBe(404);
  });

  it("shows up for the owner only", async () => {
    const [entry] = await json<TripEntry[]>(api("/trips", { as: ALICE }));
    expect(entry).toStrictEqual({ ...ownEntry(sendai), pendingCount: 1 });
    expect(await members()).toStrictEqual({
      ownerEmail: ALICE,
      members: [{ email: BOB, status: "pending" }],
      inviteCode: expect.stringMatching(INVITE_CODE_PATTERN),
    });
  });

  it("can be turned down", async () => {
    expect((await remove(BOB)).status).toBe(200);
    expect((await members()).members).toEqual([]);
    expect((await approve(BOB)).status).toBe(404);
  });
});

describe("a member", () => {
  beforeEach(shareWithBob);

  it("sees the trip as shared, after their own trips", async () => {
    const bobs: Trip = { ...sendai, id: "bob-trip", name: "Bob 的旅程" };
    await insertTrips(BOB, [bobs]);
    expect(await json(api("/trips", { as: BOB }))).toStrictEqual([
      ownEntry(bobs, BOB),
      { ...ownEntry(sendai), role: "member", memberCount: 1 },
    ]);
    expect(await json(api("/trips", { as: ALICE }))).toStrictEqual([
      { ...ownEntry(sendai), memberCount: 1 },
    ]);
  });

  it("reads and edits the trip's data, fields and cover", async () => {
    expect(await json(api("/trips/sendai-2026/shops", { as: BOB }))).toStrictEqual(shops);
    expect((await replace("/trips/sendai-2026/shops", [], BOB)).status).toBe(200);
    expect(await json(api("/trips/sendai-2026/shops", { as: ALICE }))).toEqual([]);

    const renamed = { name: "仙台（Bob 改）", startDate: "2026-03-01", endDate: "2026-03-09", coverImage: "" };
    const res = await api("/trips/sendai-2026", {
      method: "PUT",
      body: renamed,
      as: BOB,
      headers: { "If-Match": '"0"' },
    });
    expect(await json(res)).toStrictEqual({
      ...ownEntry(sendai),
      ...renamed,
      version: 1,
      role: "member",
      memberCount: 1,
    });

    const cover = { method: "PUT", body: jpeg, as: BOB, headers: { "Content-Type": "image/jpeg" } };
    expect((await api("/trips/sendai-2026/cover", cover)).status).toBe(200);
    expect((await api("/trips/sendai-2026/cover", { as: ALICE })).status).toBe(200);
    expect((await api("/trips/sendai-2026/cover", { as: BOB })).status).toBe(200);
  });

  it("sees the approved members, but not requests or the invite code", async () => {
    await requestToJoin(await inviteCode(), CAROL);
    expect(await members(BOB)).toStrictEqual({
      ownerEmail: ALICE,
      members: [{ email: BOB, status: "member" }],
      inviteCode: null,
    });
    expect((await members()).members).toEqual([
      { email: BOB, status: "member" },
      { email: CAROL, status: "pending" },
    ]);
  });

  it("cannot delete the trip, approve anyone or remove someone else", async () => {
    await requestToJoin(await inviteCode(), CAROL);
    expect((await api("/trips/sendai-2026", { method: "DELETE", as: BOB })).status).toBe(403);
    expect((await approve(CAROL, BOB)).status).toBe(403);
    expect((await remove(CAROL, BOB)).status).toBe(403);
    expect((await members()).members).toHaveLength(2);
    expect(await json(api("/trips", { as: ALICE }))).toHaveLength(1);
  });

  it("can leave, and loses access", async () => {
    expect((await remove(BOB, BOB)).status).toBe(200);
    expect(await json(api("/trips", { as: BOB }))).toEqual([]);
    expect((await api("/trips/sendai-2026/shops", { as: BOB })).status).toBe(404);
    expect((await remove(BOB, BOB)).status).toBe(404);
  });

  it("loses access when the owner removes them", async () => {
    expect((await remove("Bob@Example.com")).status).toBe(200);
    expect(await json(api("/trips", { as: BOB }))).toEqual([]);
    expect((await api("/trips/sendai-2026/shops", { as: BOB })).status).toBe(404);
  });

  it("goes with the trip when the owner deletes it", async () => {
    expect((await api("/trips/sendai-2026", { method: "DELETE", as: ALICE })).status).toBe(200);
    expect(await json(api("/trips", { as: BOB }))).toEqual([]);
    const { results } = await env.DB.prepare("SELECT * FROM trip_members").all();
    expect(results).toEqual([]);
  });
});

describe("the owner", () => {
  it("cannot leave their own trip", async () => {
    expect((await remove(ALICE)).status).toBe(400);
  });

  it("gets 404 for someone who never asked", async () => {
    expect((await approve(CAROL)).status).toBe(404);
    expect((await remove(CAROL)).status).toBe(404);
  });
});

describe("someone the trip is not shared with", () => {
  it("gets 404 everywhere, like for a trip that does not exist", async () => {
    await shareWithBob();
    expect((await api("/trips/sendai-2026/members", { as: CAROL })).status).toBe(404);
    expect((await remove(BOB, CAROL)).status).toBe(404);
    expect((await approve(CAROL, CAROL)).status).toBe(404);
    expect((await api("/trips/sendai-2026", { method: "DELETE", as: CAROL })).status).toBe(404);
    expect((await api("/trips/sendai-2026/cover", { as: CAROL })).status).toBe(404);
  });
});
