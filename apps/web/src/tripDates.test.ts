import { describe, it, expect } from "vitest";
import { dateRange, daysBetween, season, todayStr, tripDays, tripStatus } from "./tripDates";

describe("todayStr", () => {
  it("用裝置的當地日期組成 YYYY-MM-DD", () => {
    expect(todayStr(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("daysBetween / tripDays", () => {
  it("算兩個日期之間相差幾天，旅程天數頭尾都算", () => {
    expect(daysBetween("2026-03-14", "2026-03-21")).toBe(7);
    expect(tripDays("2026-03-14", "2026-03-21")).toBe(8);
    expect(tripDays("2026-12-30", "2027-01-02")).toBe(4);
  });
});

describe("tripStatus", () => {
  it("出發前是 upcoming，帶還有幾天", () => {
    expect(tripStatus("2026-12-20", "2026-12-27", "2026-10-01")).toEqual({ kind: "upcoming", daysLeft: 80 });
  });

  it("旅行期間是 ongoing，帶第幾天和總天數，頭尾兩天都算", () => {
    expect(tripStatus("2024-09-27", "2024-10-04", "2024-09-27")).toEqual({ kind: "ongoing", day: 1, total: 8 });
    expect(tripStatus("2024-09-27", "2024-10-04", "2024-09-28")).toEqual({ kind: "ongoing", day: 2, total: 8 });
    expect(tripStatus("2024-09-27", "2024-10-04", "2024-10-04")).toEqual({ kind: "ongoing", day: 8, total: 8 });
  });

  it("結束後是 ended", () => {
    expect(tripStatus("2024-09-27", "2024-10-04", "2024-10-05")).toEqual({ kind: "ended" });
  });
});

describe("dateRange", () => {
  it("同一年時結束日省略年份", () => {
    expect(dateRange("2026-12-20", "2026-12-27")).toBe("2026-12-20 → 12-27");
  });

  it("跨年時結束日保留年份", () => {
    expect(dateRange("2026-12-30", "2027-01-02")).toBe("2026-12-30 → 2027-01-02");
  });
});

describe("season", () => {
  it("依出發月份給季節", () => {
    expect(season("2026-03-14")).toBe("春");
    expect(season("2026-06-01")).toBe("夏");
    expect(season("2024-09-27")).toBe("秋");
    expect(season("2026-12-20")).toBe("冬");
    expect(season("2026-02-01")).toBe("冬");
  });
});
