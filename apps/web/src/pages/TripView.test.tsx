import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { MemoryRouter, Routes, Route, useOutletContext } from "react-router-dom";
import TripView, { type TripOutletContext } from "./TripView";
import type { Trip } from "../types";

const mockTrips: Trip[] = [
  {
    id: "trip-kyushu",
    name: "九州之旅",
    startDate: "2024-04-01",
    endDate: "2024-04-07",
    coverImage: "/cover.jpg",
  },
];

const MockChild = () => <div>child content</div>;

/** A tab page that puts a button into the header, like the pages' EditControls. */
const SlotChild = () => {
  const { editSlot } = useOutletContext<TripOutletContext>();
  return editSlot ? createPortal(<button>slot button</button>, editSlot) : null;
};

/** A tab page in edit mode: it locks the navigation and puts an add button in the bottom bar. */
const LockingChild = () => {
  const { setNavLocked, actionSlot } = useOutletContext<TripOutletContext>();
  useEffect(() => {
    setNavLocked(true);
    return () => setNavLocked(false);
  }, [setNavLocked]);
  return (
    <>
      <div>editing child</div>
      {actionSlot && createPortal(<button>add button</button>, actionSlot)}
    </>
  );
};

function renderAt(path: string, child = <MockChild />) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/trip/:tripId" element={<TripView />}>
          <Route path="schedule" element={child} />
          <Route path="shops" element={child} />
          <Route path="info" element={child} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("TripView", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTrips),
    } as Response);
  });

  it("fetch 前顯示 skeleton 佔位符", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    renderAt("/trip/trip-kyushu/schedule");
    expect(document.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
  });

  it("fetch 後顯示旅行名稱", async () => {
    renderAt("/trip/trip-kyushu/schedule");
    await waitFor(() => expect(screen.getByText("九州之旅")).toBeInTheDocument());
  });

  it("fetch 後顯示旅行日期區間", async () => {
    renderAt("/trip/trip-kyushu/schedule");
    await waitFor(() =>
      expect(screen.getByText("2024-04-01 → 2024-04-07")).toBeInTheDocument()
    );
  });

  it("找不到 trip 時顯示錯誤訊息", async () => {
    renderAt("/trip/nonexistent/schedule");
    await waitFor(() =>
      expect(screen.getByText("找不到這趟旅行")).toBeInTheDocument()
    );
  });

  it("fetch 失敗時顯示錯誤訊息", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network"));
    renderAt("/trip/trip-kyushu/schedule");
    await waitFor(() =>
      expect(screen.getByText("找不到這趟旅行")).toBeInTheDocument()
    );
  });

  it("顯示三個底部導覽 tab", async () => {
    renderAt("/trip/trip-kyushu/schedule");
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "日程" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "購物" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "資訊" })).toBeInTheDocument();
    });
  });

  it("各 tab 連結指向正確路徑", async () => {
    renderAt("/trip/trip-kyushu/schedule");
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "日程" })).toHaveAttribute(
        "href",
        "/trip/trip-kyushu/schedule"
      );
      expect(screen.getByRole("link", { name: "購物" })).toHaveAttribute(
        "href",
        "/trip/trip-kyushu/shops"
      );
      expect(screen.getByRole("link", { name: "資訊" })).toHaveAttribute(
        "href",
        "/trip/trip-kyushu/info"
      );
    });
  });

  it("返回按鈕連結到首頁", async () => {
    renderAt("/trip/trip-kyushu/schedule");
    await waitFor(() => {
      const back = screen.getByRole("link", { name: "‹" });
      expect(back).toHaveAttribute("href", "/");
    });
  });

  it("分頁可把按鈕放進 header", async () => {
    renderAt("/trip/trip-kyushu/schedule", <SlotChild />);
    const slotButton = await screen.findByRole("button", { name: "slot button" });
    expect(screen.getByRole("banner")).toContainElement(slotButton);
  });

  it("分頁在編輯模式時停用返回，底部分頁換成分頁的新增按鈕", async () => {
    renderAt("/trip/trip-kyushu/schedule", <LockingChild />);
    await screen.findByText("editing child");

    const back = screen.getByRole("link", { name: "‹" });
    expect(back).toHaveAttribute("aria-disabled", "true");
    // fireEvent returns false when the click was prevented.
    expect(fireEvent.click(back)).toBe(false);

    for (const name of ["日程", "購物", "資訊"]) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "add button" })).toBeInTheDocument();
  });

  it("header 沒有主題與設定按鈕（在首頁的設定頁）", async () => {
    renderAt("/trip/trip-kyushu/schedule");
    const banner = await screen.findByRole("banner");
    expect(within(banner).queryByRole("button")).not.toBeInTheDocument();
    expect(within(banner).queryByRole("link", { name: "設定" })).not.toBeInTheDocument();
  });
});
