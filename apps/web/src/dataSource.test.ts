import { describe, it, expect, vi, afterEach } from "vitest";

// dataSource reads import.meta.env at module load, so each test stubs the env
// first and then imports a fresh copy of the module.
async function importDataSource(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import("./dataSource");
}

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response;
}

const staticUrl = (path: string) => `${import.meta.env.BASE_URL}data/${path}`;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("靜態模式（沒有 VITE_API_URL）", () => {
  it("不啟用 API 也不開放編輯", async () => {
    const ds = await importDataSource();
    expect(ds.apiEnabled).toBe(false);
    expect(ds.isDevMode).toBe(false);
  });

  it("loadTrips 讀取靜態 trips.json", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([{ id: "t1" }]));
    const ds = await importDataSource();

    await expect(ds.loadTrips()).resolves.toEqual([{ id: "t1" }]);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith(staticUrl("trips.json"));
  });

  it("loadTripData 讀取靜態 {tripId}/{type}.json", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));
    const ds = await importDataSource();

    await ds.loadTripData("kyushu-2024", "itinerary");
    expect(fetchSpy).toHaveBeenCalledWith(staticUrl("kyushu-2024/itinerary.json"));
  });

  it("靜態 JSON 回應非 ok 時拋出 Error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(null, 404));
    const ds = await importDataSource();

    await expect(ds.loadTrips()).rejects.toThrow("404");
  });

  it("儲存時不送出任何請求", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const ds = await importDataSource();

    await ds.saveTrips([]);
    await ds.saveTripData("kyushu-2024", "shops", []);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("API 模式", () => {
  const apiEnv = { VITE_API_URL: "/api", VITE_ADMIN_TOKEN: "dev-token" };

  it("dev server 上啟用 API 並開放編輯", async () => {
    const ds = await importDataSource(apiEnv);
    expect(ds.apiEnabled).toBe(true);
    expect(ds.isDevMode).toBe(true);
  });

  it("正式 build 讀 API 但不開放編輯", async () => {
    vi.stubEnv("DEV", false);
    const ds = await importDataSource(apiEnv);
    expect(ds.apiEnabled).toBe(true);
    expect(ds.isDevMode).toBe(false);
  });

  it("loadTrips 從 API 讀取", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([{ id: "t1" }]));
    const ds = await importDataSource(apiEnv);

    await expect(ds.loadTrips()).resolves.toEqual([{ id: "t1" }]);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith("/api/trips");
  });

  it("loadTripData 從 API 讀取，並去掉 VITE_API_URL 結尾的斜線", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));
    const ds = await importDataSource({ ...apiEnv, VITE_API_URL: "https://api.example.com/api/" });

    await ds.loadTripData("kyushu-2024", "shops");
    expect(fetchSpy).toHaveBeenCalledWith("https://api.example.com/api/trips/kyushu-2024/shops");
  });

  it("API 回應非 ok 時退回靜態 JSON", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ error: "Internal Server Error" }, 500))
      .mockResolvedValueOnce(jsonResponse([{ id: "static" }]));
    const ds = await importDataSource(apiEnv);

    await expect(ds.loadTripData("kyushu-2024", "shops")).resolves.toEqual([{ id: "static" }]);
    expect(fetchSpy).toHaveBeenLastCalledWith(staticUrl("kyushu-2024/shops.json"));
  });

  it("API 連不上時退回靜態 JSON", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse([{ id: "static" }]));
    const ds = await importDataSource(apiEnv);

    await expect(ds.loadTrips()).resolves.toEqual([{ id: "static" }]);
    expect(fetchSpy).toHaveBeenLastCalledWith(staticUrl("trips.json"));
  });

  it("saveTripData 送出帶 Bearer token 的 PUT", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ ok: true }));
    const ds = await importDataSource(apiEnv);

    const data = [{ id: "day-1", day: 1, date: "2024-01-01", items: [] }];
    await ds.saveTripData("kyushu-2024", "itinerary", data);

    expect(fetchSpy).toHaveBeenCalledWith("/api/trips/kyushu-2024/itinerary", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer dev-token" },
      body: JSON.stringify(data),
    });
  });

  it("saveTrips 送出 PUT /trips", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ ok: true }));
    const ds = await importDataSource(apiEnv);

    await ds.saveTrips([]);
    expect(fetchSpy).toHaveBeenCalledWith("/api/trips", expect.objectContaining({ method: "PUT" }));
  });

  it("儲存回應非 ok 時拋出伺服器的錯誤訊息", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: "Trip not found" }, 404));
    const ds = await importDataSource(apiEnv);

    await expect(ds.saveTripData("nope", "shops", [])).rejects.toThrow("Trip not found");
  });

  it("儲存回應非 ok 且 body 不是 JSON 時拋出 HTTP 狀態碼", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    } as Response);
    const ds = await importDataSource(apiEnv);

    await expect(ds.saveTrips([])).rejects.toThrow("HTTP 401");
  });

  it("正式 build 儲存時不送出任何請求", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.stubEnv("DEV", false);
    const ds = await importDataSource(apiEnv);

    await ds.saveTrips([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
