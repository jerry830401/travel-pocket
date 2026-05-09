import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home";
import { ThemeProvider } from "../contexts/ThemeContext";
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
  <MemoryRouter>
    <ThemeProvider>{children}</ThemeProvider>
  </MemoryRouter>
);

describe("Home", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: () => Promise.resolve(mockTrips),
    } as Response);
  });

  it("顯示 Travel Pocket 標題", () => {
    render(<Home />, { wrapper: Wrapper });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Travel Pocket");
  });

  it("資料載入前顯示載入中文字", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    render(<Home />, { wrapper: Wrapper });
    expect(screen.getByText("載入中...")).toBeInTheDocument();
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

  it("主題切換按鈕可切換深色模式", async () => {
    const user = userEvent.setup();
    render(<Home />, { wrapper: Wrapper });
    const btn = screen.getByRole("button", { name: "切換主題" });
    await user.click(btn);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
