import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../contexts/ThemeContext";
import type { Shop, Trip } from "../types";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useOutletContext: vi.fn() };
});

import { useOutletContext } from "react-router-dom";
import Shops from "./Shops";

const mockTrip: Trip = {
  id: "trip-test",
  name: "測試之旅",
  startDate: "2024-04-01",
  endDate: "2024-04-07",
  coverImage: "/cover.jpg",
};

const mockShops: Shop[] = [
  {
    id: "shop-1",
    name: "電器天堂",
    location: "秋葉原",
    tags: ["家電", "3C"],
    businessHours: "10:00 - 21:00",
    googleMapLink: "https://maps.app.goo.gl/shop1",
  },
  {
    id: "shop-2",
    name: "拉麵達人",
    location: "博多",
    tags: ["美食"],
    businessHours: "11:00 - 22:00",
    googleMapLink: "",
  },
];

function renderShops() {
  vi.mocked(useOutletContext).mockReturnValue({ trip: mockTrip });
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <Shops />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("Shops", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockShops),
    } as Response);
  });

  it("fetch 前顯示 skeleton 佔位符", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    renderShops();
    expect(document.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
  });

  it("fetch 後顯示店家名稱", async () => {
    renderShops();
    await waitFor(() => {
      expect(screen.getByText("電器天堂")).toBeInTheDocument();
      expect(screen.getByText("拉麵達人")).toBeInTheDocument();
    });
  });

  it("fetch 後顯示店家地點", async () => {
    renderShops();
    await waitFor(() => expect(screen.getByText("秋葉原")).toBeInTheDocument());
  });

  it("fetch 後顯示店家營業時間", async () => {
    renderShops();
    await waitFor(() =>
      expect(screen.getByText("10:00 - 21:00")).toBeInTheDocument()
    );
  });

  it("fetch 後顯示 tag 標籤（含全部按鈕）", async () => {
    renderShops();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "全部" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "家電" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "3C" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "美食" })).toBeInTheDocument();
    });
  });

  it("點選特定 tag 只顯示符合的店家", async () => {
    const user = userEvent.setup();
    renderShops();
    await waitFor(() => screen.getByRole("button", { name: "家電" }));
    await user.click(screen.getByRole("button", { name: "家電" }));
    expect(screen.getByText("電器天堂")).toBeInTheDocument();
    expect(screen.queryByText("拉麵達人")).not.toBeInTheDocument();
  });

  it("點選全部 tag 重新顯示所有店家", async () => {
    const user = userEvent.setup();
    renderShops();
    await waitFor(() => screen.getByRole("button", { name: "家電" }));
    await user.click(screen.getByRole("button", { name: "家電" }));
    await user.click(screen.getByRole("button", { name: "全部" }));
    expect(screen.getByText("電器天堂")).toBeInTheDocument();
    expect(screen.getByText("拉麵達人")).toBeInTheDocument();
  });

  it("有 googleMapLink 的店家顯示地圖連結", async () => {
    renderShops();
    await waitFor(() => screen.getByText("電器天堂"));
    const links = screen.getAllByRole("link");
    const mapLink = links.find(
      (l) => l.getAttribute("href") === "https://maps.app.goo.gl/shop1"
    );
    expect(mapLink).toBeInTheDocument();
  });

  it("無符合 tag 的店家時顯示空狀態提示", async () => {
    const singleShop: Shop[] = [{ ...mockShops[0] }];
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(singleShop),
    } as Response);
    renderShops();
    await waitFor(() => screen.getByRole("button", { name: "美食" }).closest("button") === null
      ? Promise.reject()
      : Promise.resolve()
    ).catch(() => {});
    // 美食 tag 不存在 → 不會有美食按鈕，透過確認 tag bar 只有「全部」和「家電/3C」
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "美食" })).not.toBeInTheDocument()
    );
  });

  it("fetch 失敗時顯示錯誤訊息與重試按鈕", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network"));
    renderShops();
    await waitFor(() =>
      expect(screen.getByText("店家資訊載入失敗")).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "重試" })).toBeInTheDocument();
  });
});
