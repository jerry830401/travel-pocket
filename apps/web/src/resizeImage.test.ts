import { describe, it, expect } from "vitest";
import { fitWithin } from "./resizeImage";

// resizeImage itself needs a real canvas, which jsdom lacks; pages mock it.
describe("fitWithin", () => {
  it("把橫式照片的長邊縮到上限，保留比例", () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it("直式照片看高度", () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("小圖不放大", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});
