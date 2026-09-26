import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home";
import type { Trip } from "../types";

const mockTrips: Trip[] = [
  {
    id: "trip-tokyo",
    name: "東京春遊",
    startDate: "2024-03-10",
    endDate: "2024-03-16",
    coverImage: "/cover1.jpg",
  },
  {
    id: "trip-sendai",
    name: "仙台夏祭",
    startDate: "2024-08-05",
    endDate: "2024-08-10",
    coverImage: "/cover2.jpg",
  },
];

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe("Home", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTrips),
    } as Response);
  });

  it("顯示 Travel Pocket 標題", () => {
    render(<Home />, { wrapper: Wrapper });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Travel Pocket");
  });

  it("資料載入前顯示 skeleton 佔位符", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    render(<Home />, { wrapper: Wrapper });
    const skeletons = document.querySelectorAll(".skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("fetch 後渲染旅行卡片", async () => {
    render(<Home />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText("東京春遊")).toBeInTheDocument();
      expect(screen.getByText("仙台夏祭")).toBeInTheDocument();
    });
  });

  it("春季旅行顯示 ❄ 春 標籤", async () => {
    render(<Home />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText("❄ 春")).toBeInTheDocument());
  });

  it("夏季旅行顯示 ☀ 夏 標籤", async () => {
    render(<Home />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText("☀ 夏")).toBeInTheDocument());
  });

  it("旅行卡片連結指向正確路徑", async () => {
    render(<Home />, { wrapper: Wrapper });
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /東京春遊/ });
      expect(link).toHaveAttribute("href", "/trip/trip-tokyo");
    });
  });

  it("設定按鈕連結到設定頁", () => {
    render(<Home />, { wrapper: Wrapper });
    expect(screen.getByRole("link", { name: "設定" })).toHaveAttribute("href", "/settings");
  });
});
