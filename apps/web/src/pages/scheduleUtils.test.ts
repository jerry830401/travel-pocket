import { describe, it, expect } from "vitest";
import type { ItineraryItem } from "../types";
import { nowIndex, toMins } from "./scheduleUtils";

const item = (id: string, startTime: string, endTime = ""): ItineraryItem => ({
  id, title: id, location: "", category: "sightseeing", startTime, endTime,
});

describe("nowIndex", () => {
  const day = [item("a", "10:20", "10:32"), item("b", "12:03", "12:10"), item("c", "12:46", "13:58")];

  it("現在線放在第一個還沒開始的行程前面", () => {
    expect(nowIndex(day, toMins("11:05")!)).toBe(1);
    expect(nowIndex(day, toMins("12:03")!)).toBe(2);
  });

  it("還沒到第一站時放最前面，全部都開始了放最後面", () => {
    expect(nowIndex(day, toMins("08:00")!)).toBe(0);
    expect(nowIndex(day, toMins("20:00")!)).toBe(3);
  });

  it("只有結束時間的行程（抵達）用結束時間判斷", () => {
    const arrival = [item("a", "10:00", "10:30"), item("land", "", "13:00")];
    expect(nowIndex(arrival, toMins("12:00")!)).toBe(1);
  });

  it("沒有時間的行程跟著前一個行程", () => {
    const withUntimed = [item("a", "10:00"), item("note", ""), item("b", "12:00")];
    expect(nowIndex(withUntimed, toMins("11:00")!)).toBe(2);
  });
});
