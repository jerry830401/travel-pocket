import { describe, it, expect, afterEach } from "vitest";
import { routeJoinLink } from "./joinLink";

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("routeJoinLink", () => {
  it("把 ?join= 的邀請碼搬到加入頁的 hash 路由，並從查詢參數拿掉", () => {
    window.history.replaceState(null, "", "/?join=c0de&x=1#/");
    routeJoinLink();

    expect(window.location.search).toBe("?x=1");
    expect(window.location.hash).toBe("#/join/c0de");
  });

  it("沒有邀請碼時不動網址", () => {
    window.history.replaceState(null, "", "/?x=1#/trip/t1");
    routeJoinLink();

    expect(window.location.search).toBe("?x=1");
    expect(window.location.hash).toBe("#/trip/t1");
  });
});
