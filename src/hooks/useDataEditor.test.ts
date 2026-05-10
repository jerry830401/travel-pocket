import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveData } from "./useDataEditor";

describe("saveData", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("dev mode 下送出 POST 到正確 URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
    } as Response);

    await saveData("kyushu-2024/itinerary", [{ id: "day-1" }]);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/data/kyushu-2024/itinerary",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ id: "day-1" }]),
      })
    );
  });

  it("response 非 ok 時拋出包含伺服器錯誤訊息的 Error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "File not writable" }),
    } as Response);

    await expect(saveData("trips", {})).rejects.toThrow("File not writable");
  });

  it("response 非 ok 且 json 解析失敗時拋出預設錯誤", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    } as Response);

    await expect(saveData("trips", {})).rejects.toThrow("Unknown error");
  });

  it("正確序列化傳入的資料為 JSON body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
    } as Response);

    const data = { name: "測試", value: 42 };
    await saveData("test/path", data);

    const callArgs = fetchSpy.mock.calls[0];
    expect(callArgs[1]).toMatchObject({ body: JSON.stringify(data) });
  });
});
