import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import TripView from "./TripView";
import { ThemeProvider } from "../contexts/ThemeContext";
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

function renderAt(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/trip/:tripId" element={<TripView />}>
            <Route path="schedule" element={<MockChild />} />
            <Route path="shops" element={<MockChild />} />
            <Route path="info" element={<MockChild />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("TripView", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
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

  it("主題切換按鈕可切換深色模式", async () => {
    const user = userEvent.setup();
    renderAt("/trip/trip-kyushu/schedule");
    await waitFor(() => screen.getByRole("button", { name: "切換主題" }));
    await user.click(screen.getByRole("button", { name: "切換主題" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
