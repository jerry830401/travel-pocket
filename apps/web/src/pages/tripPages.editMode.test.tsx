import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useOutletContext } from "react-router-dom";
import { ThemeProvider } from "../contexts/ThemeContext";
import { ToastProvider } from "../contexts/ToastContext";
import * as dataSource from "../dataSource";
import type { DataType, ItineraryDay, Trip, TripDataMap } from "../types";
import Schedule from "./Schedule";
import Shops from "./Shops";
import Info from "./Info";

// The trip pages against a signed-in API: the data layer is mocked at its
// module boundary (the static-mode behavior is covered by each page's test).
vi.mock("../dataSource", async (importOriginal) => {
  const { ConflictError } = await importOriginal<typeof import("../dataSource")>();
  return { apiEnabled: true, ConflictError, loadTripData: vi.fn(), saveTripData: vi.fn() };
});

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useOutletContext: vi.fn() };
});

const ds = vi.mocked(dataSource);

const trip: Trip = {
  id: "trip-test",
  name: "測試之旅",
  startDate: "2024-03-10",
  endDate: "2024-03-11",
  coverImage: "/cover.jpg",
};

const DATA: TripDataMap = {
  itinerary: [
    {
      id: "day-1",
      day: 1,
      date: "2024-03-10",
      items: [
        { id: "item-1", title: "太宰府", location: "太宰府天滿宮", category: "sightseeing", startTime: "10:00", endTime: "12:00" },
      ],
    },
  ],
  shops: [
    { id: "shop-1", name: "Bic Camera", location: "博多站", tags: ["家電"], businessHours: "10:00 - 21:00" },
  ],
  info: [
    { id: "info-1", title: "交通", icon: "🚆", links: [{ label: "JR 九州", url: "https://www.jrkyushu.co.jp/" }] },
  ],
};

/** Every list was read at version 4. */
function loaded(editable: boolean, data: TripDataMap = DATA) {
  return <T extends DataType>(_tripId: string, type: T) =>
    Promise.resolve({ data: data[type], editable, version: 4 });
}

// `removed` is the text that goes away when the first 刪除 on the page is used.
const pages = [
  { name: "日程", Page: Schedule, type: "itinerary", addLabel: "新增行程", removed: "太宰府" },
  { name: "購物", Page: Shops, type: "shops", addLabel: "新增店家", removed: "Bic Camera" },
  { name: "資訊", Page: Info, type: "info", addLabel: "新增類別", removed: "交通" },
] as const;

// Stand in for TripView's slots: the header, where each page portals its
// EditControls, and the bottom bar, where it portals its add buttons.
let editSlot: HTMLElement;
let actionSlot: HTMLElement;
const setNavLocked = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  editSlot = document.body.appendChild(document.createElement("div"));
  actionSlot = document.body.appendChild(document.createElement("div"));
  vi.mocked(useOutletContext).mockReturnValue({ trip, editSlot, actionSlot, setNavLocked });
  ds.loadTripData.mockImplementation(loaded(true));
  ds.saveTripData.mockImplementation(async (_tripId, _type, _data, version) => version + 1);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  editSlot.remove();
  actionSlot.remove();
  vi.restoreAllMocks();
});

function renderWithProviders(Page: React.ComponentType) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter>
          <Page />
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}

describe.each(pages)("$name 編輯模式", ({ Page, type, addLabel, removed }) => {
  function renderPage() {
    return renderWithProviders(Page);
  }

  function expectNoEditControls() {
    expect(screen.queryByTitle("編輯")).not.toBeInTheDocument();
    expect(screen.queryByTitle("刪除")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: addLabel })).not.toBeInTheDocument();
  }

  async function startEditing() {
    await userEvent.click(await screen.findByRole("button", { name: "編輯" }));
  }

  async function deleteFirst() {
    await userEvent.click(screen.getAllByTitle("刪除")[0]);
  }

  it("預設為檢視，沒有編輯控制項", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "編輯" })).toBeInTheDocument();
    expectNoEditControls();
  });

  it("開關渲染在 header 的插槽裡", async () => {
    renderPage();
    expect(editSlot).toContainElement(await screen.findByRole("button", { name: "編輯" }));
  });

  it("按「編輯」顯示編輯控制項與取消、完成，並鎖住導覽；沒有變更時完成不儲存", async () => {
    renderPage();

    await startEditing();
    expect(screen.getAllByTitle("編輯").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("刪除").length).toBeGreaterThan(0);
    expect(actionSlot).toContainElement(screen.getByRole("button", { name: addLabel }));
    expect(editSlot).toContainElement(screen.getByRole("button", { name: "取消" }));
    expect(setNavLocked).toHaveBeenLastCalledWith(true);

    await userEvent.click(screen.getByRole("button", { name: "完成" }));
    expectNoEditControls();
    expect(screen.getByRole("button", { name: "編輯" })).toBeInTheDocument();
    expect(setNavLocked).toHaveBeenLastCalledWith(false);
    expect(ds.saveTripData).not.toHaveBeenCalled();
  });

  it("變更只改畫面，完成時才儲存並提示已儲存", async () => {
    renderPage();

    await startEditing();
    await deleteFirst();
    expect(screen.queryByText(removed)).not.toBeInTheDocument();
    expect(ds.saveTripData).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "完成" }));
    expect(ds.saveTripData).toHaveBeenCalledWith(trip.id, type, expect.any(Array), 4);
    expect(await screen.findByRole("status")).toHaveTextContent("已儲存");
    expectNoEditControls();
  });

  it("再次儲存時帶上次儲存後的版本", async () => {
    // Two of everything, so there is something left to delete the second time.
    ds.loadTripData.mockImplementation(async (_tripId, t) => {
      const rows = DATA[t] as { id: string }[];
      const data = [...rows, ...rows.map((row) => ({ ...row, id: `${row.id}-2` }))];
      return { data: data as TripDataMap[typeof t], editable: true, version: 4 };
    });
    renderPage();

    await startEditing();
    await deleteFirst();
    await userEvent.click(screen.getByRole("button", { name: "完成" }));
    await screen.findByRole("status");
    await startEditing();
    await deleteFirst();
    await userEvent.click(screen.getByRole("button", { name: "完成" }));

    expect(ds.saveTripData).toHaveBeenCalledTimes(2);
    expect(ds.saveTripData).toHaveBeenLastCalledWith(trip.id, type, expect.any(Array), 5);
  });

  it("別人先存過時提示、離開編輯模式並載入最新資料", async () => {
    ds.saveTripData.mockRejectedValueOnce(new dataSource.ConflictError());
    renderPage();

    await startEditing();
    await deleteFirst();
    await userEvent.click(screen.getByRole("button", { name: "完成" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("別人剛修改過，已載入最新版本");
    expect(await screen.findByText(removed)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "編輯" })).toBeInTheDocument();
    expect(ds.loadTripData).toHaveBeenCalledTimes(2);
  });

  it("儲存失敗時提示原因，留在編輯模式且保留變更", async () => {
    ds.saveTripData.mockRejectedValue(new Error("HTTP 500"));
    renderPage();

    await startEditing();
    await deleteFirst();
    await userEvent.click(screen.getByRole("button", { name: "完成" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("儲存失敗：HTTP 500");
    expect(screen.getByRole("button", { name: "完成" })).toBeInTheDocument();
    expect(screen.queryByText(removed)).not.toBeInTheDocument();
  });

  it("儲存中隱藏編輯控制項，完成按鈕顯示儲存中並停用", async () => {
    let resolveSave!: (version: number) => void;
    ds.saveTripData.mockReturnValue(new Promise<number>((resolve) => { resolveSave = resolve; }));
    renderPage();

    await startEditing();
    await deleteFirst();
    await userEvent.click(screen.getByRole("button", { name: "完成" }));

    expect(screen.getByRole("button", { name: "儲存中…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
    expectNoEditControls();

    await act(async () => resolveSave(5));
    expect(await screen.findByRole("status")).toHaveTextContent("已儲存");
  });

  it("取消時確認後丟棄變更", async () => {
    renderPage();

    await startEditing();
    await deleteFirst();
    await userEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(window.confirm).toHaveBeenLastCalledWith("確定放棄這次的變更？");
    expect(screen.getByText(removed)).toBeInTheDocument();
    expectNoEditControls();
    expect(ds.saveTripData).not.toHaveBeenCalled();
  });

  it("資料無法編輯時顯示唯讀提示，沒有編輯開關", async () => {
    ds.loadTripData.mockImplementation(loaded(false));
    renderPage();

    expect(await screen.findByRole("status")).toHaveTextContent("暫時無法編輯");
    expect(screen.queryByRole("button", { name: "編輯" })).not.toBeInTheDocument();
    expectNoEditControls();
  });
});

describe("日程：取消草稿中新增的日", () => {
  it("正選著新增的日時取消，改顯示範圍內的最後一天", async () => {
    renderWithProviders(Schedule);

    await userEvent.click(await screen.findByRole("button", { name: "編輯" }));
    expect(actionSlot).toContainElement(screen.getByRole("button", { name: "新增日" }));
    await userEvent.click(screen.getByRole("button", { name: "新增日" }));
    // The modal fills in the next date and day number.
    await userEvent.click(screen.getByRole("button", { name: "確定" }));
    expect(screen.getByRole("button", { name: /Day 2/ })).toBeInTheDocument();
    expect(screen.queryByText("太宰府")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("button", { name: /Day 2/ })).not.toBeInTheDocument();
    expect(screen.getByText("太宰府")).toBeInTheDocument();
    expect(screen.queryByText("無行程資料")).not.toBeInTheDocument();
  });
});

describe("日程：編輯日", () => {
  // day-1 (03-10, with 太宰府) and an empty day-2 (03-11), read at version 4.
  const twoDays: ItineraryDay[] = [
    DATA.itinerary[0],
    { id: "day-2", day: 2, date: "2024-03-11", items: [] },
  ];

  beforeEach(() => {
    ds.loadTripData.mockImplementation(loaded(true, { ...DATA, itinerary: twoDays }));
  });

  /** Changes the selected day in the 編輯日 modal and confirms it. */
  async function editDay(date: string, day: string) {
    await userEvent.click(screen.getAllByTitle("編輯")[0]);
    const dialog = screen.getByRole("dialog", { name: "編輯日" });
    fireEvent.change(within(dialog).getByDisplayValue(/^2024-/), { target: { value: date } });
    const dayInput = within(dialog).getByPlaceholderText("1 或 8A");
    await userEvent.clear(dayInput);
    await userEvent.type(dayInput, day);
    await userEvent.click(within(dialog).getByRole("button", { name: "確定" }));
  }

  it("檢視模式沒有編輯日的按鈕", async () => {
    renderWithProviders(Schedule);
    expect(await screen.findByRole("button", { name: "編輯" })).toBeInTheDocument();
    expect(screen.queryByTitle("編輯")).not.toBeInTheDocument();
  });

  it("表單帶入目前的值，改日期後重新排序、仍選著這天且保留行程，完成才儲存", async () => {
    renderWithProviders(Schedule);
    await userEvent.click(await screen.findByRole("button", { name: "編輯" }));

    await userEvent.click(screen.getAllByTitle("編輯")[0]);
    const dialog = screen.getByRole("dialog", { name: "編輯日" });
    expect(within(dialog).getByDisplayValue("2024-03-10")).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("1")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "取消" }));

    await editDay("2024-03-12", "3");

    // Day 1 moved after Day 2 and is still the one shown, with its item.
    const tags = screen.getAllByRole("button", { name: /^Day / });
    expect(tags.map((t) => t.textContent)).toEqual(["Day 203-11", "Day 303-12"]);
    expect(screen.getByText(/DAY 3/)).toBeInTheDocument();
    expect(screen.getByText("太宰府")).toBeInTheDocument();
    expect(ds.saveTripData).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "完成" }));
    expect(ds.saveTripData).toHaveBeenCalledWith(trip.id, "itinerary", [
      twoDays[1],
      { ...twoDays[0], day: 3, date: "2024-03-12" },
    ], 4);
  });

  it("取消時還原被編輯的日", async () => {
    renderWithProviders(Schedule);
    await userEvent.click(await screen.findByRole("button", { name: "編輯" }));

    await editDay("2024-03-12", "3");
    await userEvent.click(screen.getByRole("button", { name: "取消" }));

    const tags = screen.getAllByRole("button", { name: /^Day / });
    expect(tags.map((t) => t.textContent)).toEqual(["Day 103-10", "Day 203-11"]);
    expect(ds.saveTripData).not.toHaveBeenCalled();
  });
});
