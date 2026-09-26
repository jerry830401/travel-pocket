import { describe, it, expect, vi, afterEach } from "vitest";

// dataSource reads import.meta.env at module load, so each test stubs the env
// first and then imports a fresh copy of the module.
async function importDataSource(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import("./dataSource");
}

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const staticUrl = (path: string) => `${import.meta.env.BASE_URL}data/${path}`;

/** What a plain trip from the static JSON gets: the viewer's own, personal and never edited. */
const STATIC_ENTRY = { version: 0, role: "owner", ownerEmail: "", memberCount: 0, pendingCount: 0 };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("靜態模式（沒有 VITE_API_URL）", () => {
  it("不啟用 API", async () => {
    const ds = await importDataSource();
    expect(ds.apiEnabled).toBe(false);
  });

  it("loadTrips 讀取靜態 trips.json，且不可編輯", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([{ id: "t1" }]));
    const ds = await importDataSource();

    await expect(ds.loadTrips()).resolves.toEqual({
      data: [{ ...STATIC_ENTRY, id: "t1" }],
      editable: false,
      version: null,
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith(staticUrl("trips.json"));
  });

  it("loadTripData 讀取靜態 {tripId}/{type}.json", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));
    const ds = await importDataSource();

    await expect(ds.loadTripData("kyushu-2024", "itinerary")).resolves.toEqual({
      data: [],
      editable: false,
      version: null,
    });
    expect(fetchSpy).toHaveBeenCalledWith(staticUrl("kyushu-2024/itinerary.json"));
  });

  it("靜態 JSON 回應非 ok 時拋出 Error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(null, 404));
    const ds = await importDataSource();

    await expect(ds.loadTrips()).rejects.toThrow("404");
  });

  it("沒有帳號可讀，也不送出請求", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const ds = await importDataSource();

    await expect(ds.loadMe()).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("所有寫入都失敗，且不送出請求", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const ds = await importDataSource();

    const fields = { name: "x", startDate: "2026-01-01", endDate: "2026-01-02", coverImage: "" };
    await expect(ds.updateTrip("kyushu-2024", fields, 0)).rejects.toThrow();
    await expect(ds.saveTripData("kyushu-2024", "shops", [], 0)).rejects.toThrow();
    await expect(
      ds.createTrip({ name: "x", startDate: "2026-01-01", endDate: "2026-01-02", coverImage: "" })
    ).rejects.toThrow();
    await expect(ds.deleteTrip("kyushu-2024")).rejects.toThrow();
    await expect(ds.uploadCover("kyushu-2024", new Blob())).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("API 模式", () => {
  const apiEnv = { VITE_API_URL: "/api" };

  it("啟用 API", async () => {
    const ds = await importDataSource(apiEnv);
    expect(ds.apiEnabled).toBe(true);
  });

  it("從 API 讀到的資料可以編輯", async () => {
    const trips = [{ ...STATIC_ENTRY, id: "t1", version: 3, role: "member", memberCount: 2 }];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(trips));
    const ds = await importDataSource(apiEnv);

    await expect(ds.loadTrips()).resolves.toEqual({ data: trips, editable: true, version: null });
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith("/api/trips", { redirect: "manual" });
  });

  it("loadTripData 帶回 ETag 裡的版本", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([], 200, { ETag: '"7"' }));
    const ds = await importDataSource(apiEnv);

    await expect(ds.loadTripData("kyushu-2024", "shops")).resolves.toEqual({
      data: [],
      editable: true,
      version: 7,
    });
  });

  it("loadTripData 也讀得懂 Cloudflare 壓縮後的 weak ETag", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([], 200, { ETag: 'W/"7"' }));
    const ds = await importDataSource(apiEnv);

    await expect(ds.loadTripData("kyushu-2024", "shops")).resolves.toEqual({
      data: [],
      editable: true,
      version: 7,
    });
  });

  it("loadTripData 從 API 讀取，並去掉 VITE_API_URL 結尾的斜線", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));
    const ds = await importDataSource({ VITE_API_URL: "https://api.example.com/api/" });

    await ds.loadTripData("kyushu-2024", "shops");
    expect(fetchSpy).toHaveBeenCalledWith("https://api.example.com/api/trips/kyushu-2024/shops", {
      redirect: "manual",
    });
  });

  it("service worker 從快取回應時不可編輯", async () => {
    const cached = jsonResponse([{ id: "t1" }], 200, { "X-Travel-Pocket-Cache": "1" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(cached);
    const ds = await importDataSource(apiEnv);

    await expect(ds.loadTrips()).resolves.toEqual({
      data: [{ ...STATIC_ENTRY, id: "t1" }],
      editable: false,
      version: null,
    });
  });

  it("dev server 上 API 回應非 ok 時退回靜態 JSON，且不可編輯", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ error: "Internal Server Error" }, 500))
      .mockResolvedValueOnce(jsonResponse([{ id: "static" }]));
    const ds = await importDataSource(apiEnv);

    await expect(ds.loadTripData("kyushu-2024", "shops")).resolves.toEqual({
      data: [{ id: "static" }],
      editable: false,
      version: null,
    });
    expect(fetchSpy).toHaveBeenLastCalledWith(staticUrl("kyushu-2024/shops.json"));
  });

  it("dev server 上 API 連不上時退回靜態 JSON，且不可編輯", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse([{ id: "static" }]));
    const ds = await importDataSource(apiEnv);

    await expect(ds.loadTrips()).resolves.toEqual({
      data: [{ ...STATIC_ENTRY, id: "static" }],
      editable: false,
      version: null,
    });
    expect(fetchSpy).toHaveBeenLastCalledWith(staticUrl("trips.json"));
  });

  it("正式 build 不退回靜態 JSON，直接拋出錯誤", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubEnv("DEV", false);
    const ds = await importDataSource(apiEnv);

    await expect(ds.loadTrips()).rejects.toThrow("Failed to fetch");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("loadMe 回傳目前登入的帳號", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ email: "a@b.c" }));
    const ds = await importDataSource(apiEnv);

    await expect(ds.loadMe()).resolves.toEqual({ email: "a@b.c" });
    expect(fetchSpy).toHaveBeenCalledWith("/api/me", { redirect: "manual" });
  });

  it("loadMe 讀不到時回傳 null", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: "Sign in required" }, 401));
    const ds = await importDataSource(apiEnv);

    await expect(ds.loadMe()).resolves.toBeNull();
  });

  it("saveTripData 帶著讀到的版本送出 PUT，不帶 Authorization（身分來自 Access 的 cookie）", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ ok: true }, 200, { ETag: '"4"' }));
    const ds = await importDataSource(apiEnv);

    const data = [{ id: "day-1", day: 1, date: "2024-01-01", items: [] }];
    await expect(ds.saveTripData("kyushu-2024", "itinerary", data, 3)).resolves.toBe(4);

    expect(fetchSpy).toHaveBeenCalledWith("/api/trips/kyushu-2024/itinerary", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "If-Match": '"3"' },
      body: JSON.stringify(data),
      redirect: "manual",
    });
  });

  it("saveTripData 回傳 weak ETag 裡的新版本", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ ok: true }, 200, { ETag: 'W/"9"' }));
    const ds = await importDataSource(apiEnv);

    // 9, not the 4 it falls back to without a version it can read.
    await expect(ds.saveTripData("kyushu-2024", "shops", [], 3)).resolves.toBe(9);
  });

  it("別人先存過（412）時拋出 ConflictError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "Changed since it was read; reload and try again" }, 412)
    );
    const ds = await importDataSource(apiEnv);

    await expect(ds.saveTripData("kyushu-2024", "shops", [], 0)).rejects.toBeInstanceOf(
      ds.ConflictError
    );
  });

  it("updateTrip 帶著讀到的版本送出 PUT /trips/:tripId，回傳新版本的旅程", async () => {
    const fields = { name: "東京", startDate: "2026-10-01", endDate: "2026-10-05", coverImage: "" };
    const updated = { ...fields, id: "abc123", version: 2 };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(updated));
    const ds = await importDataSource(apiEnv);

    await expect(ds.updateTrip("abc123", fields, 1)).resolves.toEqual(updated);
    expect(fetchSpy).toHaveBeenCalledWith("/api/trips/abc123", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "If-Match": '"1"' },
      body: JSON.stringify(fields),
      redirect: "manual",
    });
  });

  it("createTrip 送出 POST /trips，回傳伺服器建立的旅程", async () => {
    const newTrip = { name: "東京", startDate: "2026-10-01", endDate: "2026-10-05", coverImage: "" };
    const created = { ...newTrip, id: "abc123", version: 0 };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(created, 201));
    const ds = await importDataSource(apiEnv);

    await expect(ds.createTrip(newTrip)).resolves.toEqual(created);
    expect(fetchSpy).toHaveBeenCalledWith("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTrip),
      redirect: "manual",
    });
  });

  it("deleteTrip 送出沒有 body 的 DELETE", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ ok: true }));
    const ds = await importDataSource(apiEnv);

    await ds.deleteTrip("kyushu-2024");
    expect(fetchSpy).toHaveBeenCalledWith("/api/trips/kyushu-2024", {
      method: "DELETE",
      redirect: "manual",
    });
  });

  it("uploadCover 以圖片本身為 body 送出 PUT，回傳旅程新的 coverImage 與版本", async () => {
    const upload = { coverImage: "/api/trips/kyushu-2024/cover?v=1", version: 1 };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(upload));
    const ds = await importDataSource(apiEnv);

    const image = new Blob(["jpeg"], { type: "image/jpeg" });
    await expect(ds.uploadCover("kyushu-2024", image)).resolves.toEqual(upload);
    expect(fetchSpy).toHaveBeenCalledWith("/api/trips/kyushu-2024/cover", {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: image,
      redirect: "manual",
    });
  });

  it("loadMembers 讀取旅程的成員", async () => {
    const members = { ownerEmail: "a@b.c", members: [], inviteCode: null };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(members));
    const ds = await importDataSource(apiEnv);

    await expect(ds.loadMembers("kyushu-2024")).resolves.toEqual(members);
    expect(fetchSpy).toHaveBeenCalledWith("/api/trips/kyushu-2024/members", { redirect: "manual" });
  });

  it("createInvite 送出 POST，回傳邀請碼", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ inviteCode: "c0de" }));
    const ds = await importDataSource(apiEnv);

    await expect(ds.createInvite("kyushu-2024")).resolves.toBe("c0de");
    expect(fetchSpy).toHaveBeenCalledWith("/api/trips/kyushu-2024/invite", {
      method: "POST",
      redirect: "manual",
    });
  });

  it("inviteLink 把邀請碼放在查詢參數，登入後才不會遺失", async () => {
    const ds = await importDataSource(apiEnv);
    expect(ds.inviteLink("c0de")).toBe(`${window.location.origin}${import.meta.env.BASE_URL}?join=c0de`);
  });

  it("approveMember 與 removeMember 以編碼過的 email 送出 PUT 與 DELETE", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ ok: true }));
    const ds = await importDataSource(apiEnv);

    await ds.approveMember("kyushu-2024", "bob+trip@example.com");
    expect(fetchSpy).toHaveBeenLastCalledWith("/api/trips/kyushu-2024/members/bob%2Btrip%40example.com", {
      method: "PUT",
      redirect: "manual",
    });
    await ds.removeMember("kyushu-2024", "bob@example.com");
    expect(fetchSpy).toHaveBeenLastCalledWith("/api/trips/kyushu-2024/members/bob%40example.com", {
      method: "DELETE",
      redirect: "manual",
    });
  });

  it("loadInvite 讀取邀請，找不到時回傳 null", async () => {
    const invite = { tripId: "t1", tripName: "京都", ownerEmail: "a@b.c", status: "none" };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(invite))
      .mockResolvedValueOnce(jsonResponse({ error: "Invite not found" }, 404));
    const ds = await importDataSource(apiEnv);

    await expect(ds.loadInvite("c0de")).resolves.toEqual(invite);
    await expect(ds.loadInvite("c0de")).resolves.toBeNull();
  });

  it("requestJoin 送出 POST，回傳申請後的邀請", async () => {
    const invite = { tripId: "t1", tripName: "京都", ownerEmail: "a@b.c", status: "pending" };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(invite));
    const ds = await importDataSource(apiEnv);

    await expect(ds.requestJoin("c0de")).resolves.toEqual(invite);
    expect(fetchSpy).toHaveBeenCalledWith("/api/invites/c0de", { method: "POST", redirect: "manual" });
  });

  it("isShared：有成員或自己是成員的旅程才算共享", async () => {
    const ds = await importDataSource(apiEnv);
    const own = { ...STATIC_ENTRY, id: "t1", name: "", startDate: "", endDate: "", coverImage: "", role: "owner" as const };
    expect(ds.isShared(own)).toBe(false);
    expect(ds.isShared({ ...own, pendingCount: 3 })).toBe(false);
    expect(ds.isShared({ ...own, memberCount: 1 })).toBe(true);
    expect(ds.isShared({ ...own, role: "member" })).toBe(true);
  });

  it("uploadCover 失敗時拋出伺服器的錯誤訊息", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: "Cover is too large" }, 413));
    const ds = await importDataSource(apiEnv);

    await expect(ds.uploadCover("kyushu-2024", new Blob())).rejects.toThrow("Cover is too large");
  });

  it("寫入回應非 ok 時拋出伺服器的錯誤訊息", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: "Trip not found" }, 404));
    const ds = await importDataSource(apiEnv);

    await expect(ds.saveTripData("nope", "shops", [], 0)).rejects.toThrow("Trip not found");
  });

  it("寫入回應非 ok 且 body 不是 JSON 時拋出 HTTP 狀態碼", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Bad Gateway", { status: 502 }));
    const ds = await importDataSource(apiEnv);

    await expect(ds.deleteTrip("kyushu-2024")).rejects.toThrow("HTTP 502");
  });
});

// Cloudflare Access answers a signed-out request with a redirect to its login
// page, which fetch(…, { redirect: "manual" }) exposes as an opaque redirect.
const accessLoginRedirect = () =>
  ({ type: "opaqueredirect", ok: false, status: 0, headers: new Headers() }) as Response;

describe("未登入", () => {
  const apiEnv = { VITE_API_URL: "/api" };

  it.each([
    ["Access 導向登入頁", accessLoginRedirect],
    ["API 回 401", () => jsonResponse({ error: "Sign in required" }, 401)],
  ])("%s時讀取拋出 SignInRequiredError 並通知", async (_, response) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response());
    const ds = await importDataSource(apiEnv);
    const listener = vi.fn();
    ds.onSignedOut(listener);

    await expect(ds.loadTrips()).rejects.toBeInstanceOf(ds.SignInRequiredError);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("dev server 上也不會退回靜態 JSON 蓋過未登入", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(accessLoginRedirect());
    const ds = await importDataSource(apiEnv);

    await expect(ds.loadTripData("kyushu-2024", "shops")).rejects.toBeInstanceOf(
      ds.SignInRequiredError
    );
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("寫入時拋出「請先登入」並通知", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(accessLoginRedirect());
    const ds = await importDataSource(apiEnv);
    const listener = vi.fn();
    ds.onSignedOut(listener);

    await expect(ds.saveTripData("kyushu-2024", "shops", [], 0)).rejects.toThrow("請先登入");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("loadMe 回傳 null 並通知", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(accessLoginRedirect());
    const ds = await importDataSource(apiEnv);
    const listener = vi.fn();
    ds.onSignedOut(listener);

    await expect(ds.loadMe()).resolves.toBeNull();
    expect(listener).toHaveBeenCalledOnce();
  });

  it("取消訂閱後不再通知", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(accessLoginRedirect());
    const ds = await importDataSource(apiEnv);
    const listener = vi.fn();
    const unsubscribe = ds.onSignedOut(listener);
    unsubscribe();

    await expect(ds.loadTrips()).rejects.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("signOut", () => {
  // jsdom cannot navigate, so only the cache clearing is checked here.
  it("清除 service worker 的 API 快取", async () => {
    const deleteCache = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("caches", { delete: deleteCache });
    const ds = await importDataSource({ VITE_API_URL: "/api" });

    await ds.signOut();
    expect(deleteCache).toHaveBeenCalledWith("trip-api");
  });
});
