import { describe, it, expect } from "vitest";
import { mapSearchUrl } from "./mapSearchUrl";

describe("mapSearchUrl", () => {
  it("產生 Google Map 查詢網址", () => {
    expect(mapSearchUrl("博多")).toBe(
      "https://www.google.com/maps/search/?api=1&query=%E5%8D%9A%E5%A4%9A"
    );
  });

  it("編碼空白與符號", () => {
    expect(mapSearchUrl("parco 仙台店 8F & B1")).toBe(
      "https://www.google.com/maps/search/?api=1&query=parco%20%E4%BB%99%E5%8F%B0%E5%BA%97%208F%20%26%20B1"
    );
  });
});
