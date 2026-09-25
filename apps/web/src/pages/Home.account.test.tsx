import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home";
import { ThemeProvider } from "../contexts/ThemeContext";
import * as dataSource from "../dataSource";
import type { Trip } from "../types";

// Home against a signed-in API: the data layer is mocked at its module
// boundary (the static-mode behavior is covered by Home.test.tsx).
vi.mock("../dataSource", () => ({
  apiEnabled: true,
  loadTrips: vi.fn(),
  loadMe: vi.fn(),
  saveTrips: vi.fn(),
  createTrip: vi.fn(),
  deleteTrip: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const ds = vi.mocked(dataSource);

const tokyo: Trip = {
  id: "trip-tokyo",
  name: "東京春遊",
  startDate: "2024-03-10",
  endDate: "2024-03-16",
  coverImage: "/cover1.jpg",
};

const sendai: Trip = {
  id: "trip-sendai",
  name: "仙台夏祭",
  startDate: "2024-08-05",
  endDate: "2024-08-10",
  coverImage: "/cover2.jpg",
};

function renderHome() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <Home />
      </ThemeProvider>
    </MemoryRouter>
  );
}

/** The input next to a FieldInput label. */
function field(label: string): HTMLInputElement {
  return screen.getByText(label).parentElement!.querySelector("input")!;
}

function card(name: string): HTMLElement {
  return screen.getByText(name).closest("a")!;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  ds.loadMe.mockResolvedValue({ email: "alice@example.com" });
  ds.loadTrips.mockResolvedValue({ data: [tokyo, sendai], editable: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("帳號", () => {
  it("顯示登入的 email；dev server 沒有 Access，不顯示登出", async () => {
    renderHome();
    expect(await screen.findByText("alice@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "登出" })).not.toBeInTheDocument();
  });

  it("正式 build 提供登出", async () => {
    vi.stubEnv("DEV", false);
    renderHome();
    await userEvent.click(await screen.findByRole("button", { name: "登出" }));
    expect(ds.signOut).toHaveBeenCalledOnce();
  });

  it("讀不到帳號時不顯示帳號列", async () => {
    ds.loadMe.mockResolvedValue(null);
    renderHome();
    await screen.findByText("東京春遊");
    expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument();
  });
});

describe("沒有旅程", () => {
  it("顯示空白畫面與新增按鈕", async () => {
    ds.loadTrips.mockResolvedValue({ data: [], editable: true });
    renderHome();
    expect(await screen.findByText("還沒有旅行筆記")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新增旅程" })).toBeInTheDocument();
  });
});

describe("新增旅程", () => {
  it("送出後把伺服器建立的旅程加到清單最後", async () => {
    const created: Trip = { id: "srv-1", name: "京都", startDate: "2026-11-01", endDate: "2026-11-03", coverImage: "" };
    ds.createTrip.mockResolvedValue(created);
    renderHome();

    await userEvent.click(await screen.findByRole("button", { name: "新增旅程" }));
    await userEvent.type(field("旅行名稱"), " 京都 ");
    await userEvent.type(field("開始日期"), "2026-11-01");
    await userEvent.type(field("結束日期"), "2026-11-03");
    await userEvent.click(screen.getByRole("button", { name: "儲存" }));

    expect(ds.createTrip).toHaveBeenCalledWith({
      name: "京都",
      startDate: "2026-11-01",
      endDate: "2026-11-03",
      coverImage: "",
    });
    await waitFor(() => expect(screen.getByText("京都")).toBeInTheDocument());
    const names = screen.getAllByText(/東京春遊|仙台夏祭|京都/).map((el) => el.textContent);
    expect(names).toEqual(["東京春遊", "仙台夏祭", "京都"]);
  });

  it("缺少名稱或日期時不送出", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    renderHome();

    await userEvent.click(await screen.findByRole("button", { name: "新增旅程" }));
    await userEvent.type(field("旅行名稱"), "京都");
    await userEvent.click(screen.getByRole("button", { name: "儲存" }));

    expect(alertSpy).toHaveBeenCalledWith("請填寫旅行名稱與日期");
    expect(ds.createTrip).not.toHaveBeenCalled();
  });
});

describe("刪除旅程", () => {
  it("確認後刪除，並從清單移除", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    ds.deleteTrip.mockResolvedValue(undefined);
    renderHome();

    await screen.findByText("東京春遊");
    await userEvent.click(within(card("東京春遊")).getByTitle("刪除"));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("東京春遊"));
    expect(ds.deleteTrip).toHaveBeenCalledWith("trip-tokyo");
    await waitFor(() => expect(screen.queryByText("東京春遊")).not.toBeInTheDocument());
    expect(screen.getByText("仙台夏祭")).toBeInTheDocument();
  });

  it("取消時不刪除", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderHome();

    await screen.findByText("東京春遊");
    await userEvent.click(within(card("東京春遊")).getByTitle("刪除"));

    expect(ds.deleteTrip).not.toHaveBeenCalled();
    expect(screen.getByText("東京春遊")).toBeInTheDocument();
  });

  it("刪除失敗時保留旅程並提示", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    ds.deleteTrip.mockRejectedValue(new Error("Trip not found"));
    renderHome();

    await screen.findByText("東京春遊");
    await userEvent.click(within(card("東京春遊")).getByTitle("刪除"));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("刪除失敗：Trip not found"));
    expect(screen.getByText("東京春遊")).toBeInTheDocument();
  });
});

describe("無法編輯的資料", () => {
  it("顯示唯讀提示，且沒有編輯、刪除、新增按鈕", async () => {
    ds.loadTrips.mockResolvedValue({ data: [tokyo], editable: false });
    renderHome();

    expect(await screen.findByRole("status")).toHaveTextContent("暫時無法編輯");
    expect(screen.queryByTitle("編輯")).not.toBeInTheDocument();
    expect(screen.queryByTitle("刪除")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "新增旅程" })).not.toBeInTheDocument();
  });
});
