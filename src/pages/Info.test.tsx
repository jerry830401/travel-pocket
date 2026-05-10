import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../contexts/ThemeContext";
import type { InfoItem, Trip } from "../types";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useOutletContext: vi.fn() };
});

import { useOutletContext } from "react-router-dom";
import Info from "./Info";

const mockTrip: Trip = {
  id: "trip-test",
  name: "測試之旅",
  startDate: "2024-04-01",
  endDate: "2024-04-07",
  coverImage: "/cover.jpg",
};

const mockItems: InfoItem[] = [
  {
    id: "info-1",
    title: "入境資訊",
    icon: "🛂",
    links: [
      { label: "簽證申請", url: "https://example.com/visa" },
      { label: "入境表格", url: "https://example.com/form" },
    ],
  },
  {
    id: "info-2",
    title: "交通票券",
    icon: "🚆",
    links: [
      { label: "JR Pass 購買", url: "https://example.com/jr" },
    ],
  },
];

function renderInfo() {
  vi.mocked(useOutletContext).mockReturnValue({ trip: mockTrip });
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <Info />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("Info", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockItems),
    } as Response);
  });

  it("fetch 前顯示載入中提示", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    renderInfo();
    expect(screen.getByText("載入資訊中...")).toBeInTheDocument();
  });

  it("fetch 後顯示 InfoItem 標題", async () => {
    renderInfo();
    await waitFor(() => {
      expect(screen.getByText("入境資訊")).toBeInTheDocument();
      expect(screen.getByText("交通票券")).toBeInTheDocument();
    });
  });

  it("fetch 後顯示 InfoItem 圖示", async () => {
    renderInfo();
    await waitFor(() => {
      expect(screen.getByText("🛂")).toBeInTheDocument();
      expect(screen.getByText("🚆")).toBeInTheDocument();
    });
  });

  it("fetch 後顯示 InfoLink 標籤", async () => {
    renderInfo();
    await waitFor(() => {
      expect(screen.getByText("簽證申請")).toBeInTheDocument();
      expect(screen.getByText("入境表格")).toBeInTheDocument();
      expect(screen.getByText("JR Pass 購買")).toBeInTheDocument();
    });
  });

  it("InfoLink 連結指向正確 URL", async () => {
    renderInfo();
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /簽證申請/ });
      expect(link).toHaveAttribute("href", "https://example.com/visa");
      expect(link).toHaveAttribute("target", "_blank");
    });
  });

  it("InfoLink 連結有 rel=noopener", async () => {
    renderInfo();
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /簽證申請/ });
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  it("顯示頁面標題「小筆記」", async () => {
    renderInfo();
    await waitFor(() =>
      expect(screen.getByText("小筆記")).toBeInTheDocument()
    );
  });

  it("空資料時不顯示任何 InfoItem", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response);
    renderInfo();
    await waitFor(() =>
      expect(screen.queryByText("入境資訊")).not.toBeInTheDocument()
    );
  });
});
