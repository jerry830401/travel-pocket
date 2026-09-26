import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../contexts/ThemeContext";
import type { ItineraryDay, ItineraryItem, Trip } from "../types";
import { toMins, gapLabel, dateBig, weekday, sortItems } from "./scheduleUtils";

/* ── Pure-function tests ─────────────────────────────────────── */

describe("toMins", () => {
  it("將 HH:MM 字串轉成分鐘數", () => {
    expect(toMins("09:30")).toBe(570);
    expect(toMins("00:00")).toBe(0);
    expect(toMins("23:59")).toBe(1439);
  });

  it("整點無分鐘", () => {
    expect(toMins("10:00")).toBe(600);
  });

  it("undefined 回傳 null", () => {
    expect(toMins(undefined)).toBeNull();
  });

  it("空字串回傳 null", () => {
    expect(toMins("")).toBeNull();
  });
});

describe("gapLabel", () => {
  it("小時 + 分鐘格式", () => {
    expect(gapLabel(90)).toBe("1h 30m");
  });

  it("只有小時", () => {
    expect(gapLabel(120)).toBe("2h");
  });

  it("只有分鐘", () => {
    expect(gapLabel(45)).toBe("45m");
  });

  it("負數或零回傳 null", () => {
    expect(gapLabel(0)).toBeNull();
    expect(gapLabel(-10)).toBeNull();
  });

  it("null 回傳 null", () => {
    expect(gapLabel(null)).toBeNull();
  });
});

describe("dateBig", () => {
  it("將 YYYY-MM-DD 轉成 MM / DD 格式", () => {
    expect(dateBig("2024-03-10")).toBe("03 / 10");
    expect(dateBig("2024-12-01")).toBe("12 / 01");
  });
});

describe("weekday", () => {
  it("回傳英文星期縮寫", () => {
    // 2024-03-10 是 SUN
    expect(weekday("2024-03-10")).toBe("SUN");
    // 2024-03-11 是 MON
    expect(weekday("2024-03-11")).toBe("MON");
    // 2024-03-15 是 FRI
    expect(weekday("2024-03-15")).toBe("FRI");
  });
});

describe("sortItems", () => {
  const item = (id: string, startTime: string, endTime = ""): ItineraryItem => ({
    id, title: id, location: "", category: "other", startTime, endTime,
  });
  const ids = (items: ItineraryItem[]) => items.map((i) => i.id);

  it("依開始時間排序", () => {
    expect(ids(sortItems([item("c", "15:00"), item("a", "08:00"), item("b", "10:30")])))
      .toEqual(["a", "b", "c"]);
  });

  it("沒有開始時間時用結束時間", () => {
    expect(ids(sortItems([item("arrive", "", "11:50"), item("depart", "10:00"), item("spa", "13:20")])))
      .toEqual(["depart", "arrive", "spa"]);
  });

  it("都沒有時間的跟著前一個項目移動", () => {
    expect(ids(sortItems([item("late", "18:00"), item("note", ""), item("early", "09:00")])))
      .toEqual(["early", "late", "note"]);
  });

  it("排在最前面、都沒有時間的留在最前面", () => {
    expect(ids(sortItems([item("note", ""), item("late", "18:00"), item("early", "09:00")])))
      .toEqual(["note", "early", "late"]);
  });

  it("時間相同時維持原本順序", () => {
    expect(ids(sortItems([item("b", "10:00"), item("a", "10:00"), item("c", "09:00")])))
      .toEqual(["c", "b", "a"]);
  });

  it("不改動傳入的陣列", () => {
    const items = [item("b", "10:00"), item("a", "09:00")];
    sortItems(items);
    expect(ids(items)).toEqual(["b", "a"]);
  });
});

/* ── Component tests ─────────────────────────────────────────── */

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

import { useOutletContext } from "react-router-dom";
import Schedule from "./Schedule";
import { mapSearchUrl } from "../mapSearchUrl";

const mockTrip: Trip = {
  id: "trip-test",
  name: "測試之旅",
  startDate: "2024-03-10",
  endDate: "2024-03-15",
  coverImage: "/cover.jpg",
};

const mockDays: ItineraryDay[] = [
  {
    id: "day-1",
    day: 1,
    date: "2024-03-10",
    items: [
      {
        id: "item-1",
        title: "搭飛機出發",
        location: "桃園機場",
        category: "sightseeing",
        startTime: "08:00",
        endTime: "12:00",
      },
      {
        id: "item-2",
        title: "抵達飯店",
        location: "福岡市區",
        category: "accommodation",
        startTime: "15:00",
        endTime: "16:00",
      },
    ],
  },
  {
    id: "day-2",
    day: 2,
    date: "2024-03-11",
    items: [],
  },
];

function renderSchedule() {
  vi.mocked(useOutletContext).mockReturnValue({ trip: mockTrip });
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <Schedule />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("Schedule component", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDays),
    } as Response);
  });

  it("fetch 前顯示 skeleton 佔位符", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    renderSchedule();
    expect(document.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
  });

  it("fetch 後顯示 Day 按鈕列表", async () => {
    renderSchedule();
    await waitFor(() => {
      expect(screen.getByText("Day 1")).toBeInTheDocument();
      expect(screen.getByText("Day 2")).toBeInTheDocument();
    });
  });

  it("fetch 後顯示行程項目標題", async () => {
    renderSchedule();
    await waitFor(() => {
      expect(screen.getByText("搭飛機出發")).toBeInTheDocument();
      expect(screen.getByText("抵達飯店")).toBeInTheDocument();
    });
  });

  it("fetch 後顯示行程項目地點", async () => {
    renderSchedule();
    await waitFor(() => {
      expect(screen.getByText("桃園機場")).toBeInTheDocument();
    });
  });

  it("fetch 後顯示行程項目時間", async () => {
    renderSchedule();
    await waitFor(() => {
      expect(screen.getByText("08:00")).toBeInTheDocument();
    });
  });

  it("點擊 Day 2 切換到第二天，顯示 Day 2 日期並隱藏 Day 1 行程", async () => {
    const user = userEvent.setup();
    renderSchedule();
    await waitFor(() => screen.getByText("Day 2"));
    await user.click(screen.getByText("Day 2"));
    // 切換後日期標題變為 Day 2 的日期（03 / 11），Day 1 的行程不再出現
    await waitFor(() =>
      expect(screen.getByText("03 / 11")).toBeInTheDocument()
    );
    expect(screen.queryByText("搭飛機出發")).not.toBeInTheDocument();
  });

  it("fetch 失敗時顯示錯誤訊息與重試按鈕", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network"));
    renderSchedule();
    await waitFor(() =>
      expect(screen.getByText("行程載入失敗")).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "重試" })).toBeInTheDocument();
  });

  it("兩個相鄰行程之間顯示間隔時間", async () => {
    renderSchedule();
    // item-1 ends 12:00, item-2 starts 15:00 → gap 3h
    await waitFor(() => expect(screen.getByText("3h")).toBeInTheDocument());
  });

  it("行程依時間顯示，不照存的順序，間隔時間也照顯示的順序算", async () => {
    const [day1, day2] = mockDays;
    const reversed = [{ ...day1, items: [...day1.items].reverse() }, day2];
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(reversed),
    } as Response);
    renderSchedule();

    const first = await screen.findByText("搭飛機出發");
    expect(first.compareDocumentPosition(screen.getByText("抵達飯店")))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText("3h")).toBeInTheDocument();
  });

  it("點開行程後，地點按鈕用地點查詢 Google Map", async () => {
    const user = userEvent.setup();
    renderSchedule();
    await user.click(await screen.findByText("搭飛機出發"));
    expect(screen.getByRole("link", { name: /桃園機場/ })).toHaveAttribute(
      "href",
      mapSearchUrl("桃園機場")
    );
  });
});
