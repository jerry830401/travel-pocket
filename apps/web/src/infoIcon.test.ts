import { describe, it, expect } from "vitest";
import { infoIconName } from "./infoIcon";

describe("infoIconName", () => {
  it("認得的名稱不分大小寫、可加 - 或 _，對應到線條圖示", () => {
    expect(infoIconName("Plane")).toBe("plane");
    expect(infoIconName("landmark")).toBe("landmark");
    expect(infoIconName("Shopping-Bag")).toBe("bag");
    expect(infoIconName("credit_card")).toBe("card");
  });

  it("emoji 或不認得的文字回傳 null，照原樣顯示", () => {
    expect(infoIconName("🛂")).toBeNull();
    expect(infoIconName("Passport")).toBeNull();
    expect(infoIconName("")).toBeNull();
  });
});
