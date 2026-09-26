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

    await expect(ds.loadTrips()).resolves.toEqual({ data: [{ id: "t1" }], editable: false });
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith(staticUrl("trips.json"));
  });

  it("loadTripData 讀取靜態 {tripId}/{type}.json", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));
    const ds = await importDataSource();

    await expect(ds.loadTripData("kyushu-2024", "itinerary")).resolves.toEqual({
      data: [],
      editable: false,
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

    await expect(ds.saveTrips([])).rejects.toThrow();
    await expect(ds.saveTripData("kyushu-2024", "shops", [])).rejects.toThrow();
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
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([{ id: "t1" }]));
    const ds = await importDataSource(apiEnv);

    await expect(ds.loadTrips()).resolves.toEqual({ data: [{ id: "t1" }], editable: true });
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith("/api/trips", { redirect: "manual" });
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

    await expect(ds.loadTrips()).resolves.toEqual({ data: [{ id: "t1" }], editable: false });
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
    });
    expect(fetchSpy).toHaveBeenLastCalledWith(staticUrl("kyushu-2024/shops.json"));
  });

  it("dev server 上 API 連不上時退回靜態 JSON，且不可編輯", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse([{ id: "static" }]));
    const ds = await importDataSource(apiEnv);

    await expect(ds.loadTrips()).resolves.toEqual({ data: [{ id: "static" }], editable: false });
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

  it("saveTripData 送出 PUT，不帶 Authorization（身分來自 Access 的 cookie）", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ ok: true }));
    const ds = await importDataSource(apiEnv);

    const data = [{ id: "day-1", day: 1, date: "2024-01-01", items: [] }];
    await ds.saveTripData("kyushu-2024", "itinerary", data);

    expect(fetchSpy).toHaveBeenCalledWith("/api/trips/kyushu-2024/itinerary", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      redirect: "manual",
    });
  });

  it("saveTrips 送出 PUT /trips", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ ok: true }));
    const ds = await importDataSource(apiEnv);

    await ds.saveTrips([]);
    expect(fetchSpy).toHaveBeenCalledWith("/api/trips", expect.objectContaining({ method: "PUT" }));
  });

  it("createTrip 送出 POST /trips，回傳伺服器建立的旅程", async () => {
    const newTrip = { name: "東京", startDate: "2026-10-01", endDate: "2026-10-05", coverImage: "" };
    const created = { ...newTrip, id: "abc123" };
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

  it("uploadCover 以圖片本身為 body 送出 PUT，回傳旅程新的 coverImage", async () => {
    const coverImage = "/api/trips/kyushu-2024/cover?v=1";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ coverImage }));
    const ds = await importDataSource(apiEnv);

    const image = new Blob(["jpeg"], { type: "image/jpeg" });
    await expect(ds.uploadCover("kyushu-2024", image)).resolves.toBe(coverImage);
    expect(fetchSpy).toHaveBeenCalledWith("/api/trips/kyushu-2024/cover", {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: image,
      redirect: "manual",
    });
  });

  it("uploadCover 失敗時拋出伺服器的錯誤訊息", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: "Cover is too large" }, 413));
    const ds = await importDataSource(apiEnv);

    await expect(ds.uploadCover("kyushu-2024", new Blob())).rejects.toThrow("Cover is too large");
  });

  it("寫入回應非 ok 時拋出伺服器的錯誤訊息", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: "Trip not found" }, 404));
    const ds = await importDataSource(apiEnv);

    await expect(ds.saveTripData("nope", "shops", [])).rejects.toThrow("Trip not found");
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

    await expect(ds.saveTrips([])).rejects.toThrow("請先登入");
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
