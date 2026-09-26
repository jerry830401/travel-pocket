import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home";
import { ToastProvider } from "../contexts/ToastContext";
import * as dataSource from "../dataSource";
import type { Trip } from "../types";

// Home against a signed-in API: the data layer is mocked at its module
// boundary (the static-mode behavior is covered by Home.test.tsx).
vi.mock("../dataSource", () => ({
  apiEnabled: true,
  loadTrips: vi.fn(),
  saveTrips: vi.fn(),
  createTrip: vi.fn(),
  deleteTrip: vi.fn(),
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

const kyoto: Trip = { id: "srv-1", name: "京都", startDate: "2026-11-01", endDate: "2026-11-03", coverImage: "" };

function renderHome() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Home />
      </ToastProvider>
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

/** Home opens in view mode; the edit controls appear after 編輯. */
async function startEditing() {
  await userEvent.click(await screen.findByRole("button", { name: "編輯" }));
}

async function finish() {
  await userEvent.click(screen.getByRole("button", { name: "完成" }));
}

/** Adds 京都 through the modal (only to the draft). */
async function addKyoto() {
  await userEvent.click(screen.getByRole("button", { name: "新增旅程" }));
  await userEvent.type(field("旅行名稱"), " 京都 ");
  await userEvent.type(field("開始日期"), "2026-11-01");
  await userEvent.type(field("結束日期"), "2026-11-03");
  await userEvent.click(screen.getByRole("button", { name: "確定" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  ds.loadTrips.mockResolvedValue({ data: [tokyo, sendai], editable: true });
  ds.saveTrips.mockResolvedValue(undefined);
  ds.createTrip.mockResolvedValue(kyoto);
  ds.deleteTrip.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("設定", () => {
  it("header 只有設定入口，帳號與主題都在設定頁", async () => {
    vi.stubEnv("DEV", false);
    renderHome();
    await screen.findByText("東京春遊");
    expect(screen.getByRole("link", { name: "設定" })).toHaveAttribute("href", "/settings");
    expect(screen.queryByRole("button", { name: "登出" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "切換主題" })).not.toBeInTheDocument();
  });
});

describe("編輯模式", () => {
  it("預設為檢視，沒有編輯、刪除、新增按鈕", async () => {
    renderHome();

    // The switch sits next to the settings link in the header.
    const toggle = await screen.findByRole("button", { name: "編輯" });
    expect(toggle.parentElement).toContainElement(screen.getByRole("link", { name: "設定" }));
    expect(screen.queryByTitle("編輯")).not.toBeInTheDocument();
    expect(screen.queryByTitle("刪除")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "新增旅程" })).not.toBeInTheDocument();
  });

  it("按「編輯」顯示編輯控制項與取消、完成；沒有變更時完成不儲存", async () => {
    renderHome();

    await startEditing();
    expect(within(card("東京春遊")).getByTitle("編輯")).toBeInTheDocument();
    expect(within(card("東京春遊")).getByTitle("刪除")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新增旅程" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();

    await finish();
    expect(screen.queryByTitle("編輯")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "新增旅程" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "編輯" })).toBeInTheDocument();
    expect(ds.saveTrips).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("編輯中不能打開旅程，也不能進設定", async () => {
    renderHome();

    await startEditing();
    expect(card("東京春遊")).toHaveAttribute("aria-disabled", "true");
    const settings = screen.getByRole("link", { name: "設定" });
    expect(settings).toHaveAttribute("aria-disabled", "true");
    // fireEvent returns false when the click was prevented.
    expect(fireEvent.click(settings)).toBe(false);
  });
});

describe("沒有旅程", () => {
  it("顯示空白畫面與新增按鈕", async () => {
    ds.loadTrips.mockResolvedValue({ data: [], editable: true });
    renderHome();
    expect(await screen.findByText("還沒有旅行筆記")).toBeInTheDocument();
    await startEditing();
    expect(screen.getByRole("button", { name: "新增旅程" })).toBeInTheDocument();
  });
});

describe("新增旅程", () => {
  it("確定只加到畫面，完成時才建立並提示已儲存", async () => {
    renderHome();

    await startEditing();
    await addKyoto();
    expect(screen.getByText("京都")).toBeInTheDocument();
    expect(ds.createTrip).not.toHaveBeenCalled();

    await finish();
    expect(ds.createTrip).toHaveBeenCalledWith({
      name: "京都",
      startDate: "2026-11-01",
      endDate: "2026-11-03",
      coverImage: "",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("已儲存");
    const names = screen.getAllByText(/東京春遊|仙台夏祭|京都/).map((el) => el.textContent);
    expect(names).toEqual(["東京春遊", "仙台夏祭", "京都"]);
    expect(card("京都")).toHaveAttribute("href", "/trip/srv-1");
  });

  it("缺少名稱或日期時不加入", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    renderHome();

    await startEditing();
    await userEvent.click(screen.getByRole("button", { name: "新增旅程" }));
    await userEvent.type(field("旅行名稱"), "京都");
    await userEvent.click(screen.getByRole("button", { name: "確定" }));

    expect(alertSpy).toHaveBeenCalledWith("請填寫旅行名稱與日期");
    expect(screen.queryByText("京都")).not.toBeInTheDocument();
  });
});

describe("修改旅程", () => {
  it("完成時以整份清單更新", async () => {
    renderHome();

    await startEditing();
    await userEvent.click(within(card("東京春遊")).getByTitle("編輯"));
    await userEvent.clear(field("旅行名稱"));
    await userEvent.type(field("旅行名稱"), "東京秋遊");
    await userEvent.click(screen.getByRole("button", { name: "確定" }));
    expect(ds.saveTrips).not.toHaveBeenCalled();

    await finish();
    expect(ds.saveTrips).toHaveBeenCalledWith([
      expect.objectContaining({ id: "trip-tokyo", name: "東京秋遊" }),
      sendai,
    ]);
    expect(await screen.findByRole("status")).toHaveTextContent("已儲存");
  });

  it("新增後更新失敗，重試時不重複建立", async () => {
    ds.saveTrips.mockRejectedValueOnce(new Error("HTTP 500"));
    renderHome();

    await startEditing();
    await addKyoto();
    await userEvent.click(within(card("東京春遊")).getByTitle("編輯"));
    await userEvent.clear(field("旅行名稱"));
    await userEvent.type(field("旅行名稱"), "東京秋遊");
    await userEvent.click(screen.getByRole("button", { name: "確定" }));

    await finish();
    expect(await screen.findByRole("alert")).toHaveTextContent("儲存失敗：HTTP 500");
    expect(screen.getByRole("button", { name: "完成" })).toBeInTheDocument();

    await finish();
    await waitFor(() => expect(ds.saveTrips).toHaveBeenCalledTimes(2));
    expect(ds.createTrip).toHaveBeenCalledOnce();
    expect(ds.saveTrips).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "trip-tokyo", name: "東京秋遊" }),
      sendai,
      kyoto,
    ]);
  });
});

describe("刪除旅程", () => {
  it("確認後從畫面移除，完成時才刪除", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderHome();

    await screen.findByText("東京春遊");
    await startEditing();
    await userEvent.click(within(card("東京春遊")).getByTitle("刪除"));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("東京春遊"));
    expect(screen.queryByText("東京春遊")).not.toBeInTheDocument();
    expect(ds.deleteTrip).not.toHaveBeenCalled();

    await finish();
    expect(ds.deleteTrip).toHaveBeenCalledWith("trip-tokyo");
    expect(await screen.findByRole("status")).toHaveTextContent("已儲存");
    expect(ds.saveTrips).not.toHaveBeenCalled();
  });

  it("確認時選取消就不刪除", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderHome();

    await screen.findByText("東京春遊");
    await startEditing();
    await userEvent.click(within(card("東京春遊")).getByTitle("刪除"));

    expect(screen.getByText("東京春遊")).toBeInTheDocument();
  });

  it("刪除失敗時提示並留在編輯模式，按取消後旅程回來", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    ds.deleteTrip.mockRejectedValue(new Error("Trip not found"));
    renderHome();

    await screen.findByText("東京春遊");
    await startEditing();
    await userEvent.click(within(card("東京春遊")).getByTitle("刪除"));
    await finish();

    expect(await screen.findByRole("alert")).toHaveTextContent("儲存失敗：Trip not found");
    expect(screen.queryByText("東京春遊")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(window.confirm).toHaveBeenLastCalledWith("確定放棄這次的變更？");
    expect(screen.getByText("東京春遊")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "編輯" })).toBeInTheDocument();
  });
});

describe("無法編輯的資料", () => {
  it("顯示唯讀提示，且沒有編輯開關與編輯、刪除、新增按鈕", async () => {
    ds.loadTrips.mockResolvedValue({ data: [tokyo], editable: false });
    renderHome();

    expect(await screen.findByRole("status")).toHaveTextContent("暫時無法編輯");
    expect(screen.queryByRole("button", { name: "編輯" })).not.toBeInTheDocument();
    expect(screen.queryByTitle("編輯")).not.toBeInTheDocument();
    expect(screen.queryByTitle("刪除")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "新增旅程" })).not.toBeInTheDocument();
  });
});
