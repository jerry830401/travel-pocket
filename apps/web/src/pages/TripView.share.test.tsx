import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { MemoryRouter, Routes, Route, useOutletContext } from "react-router-dom";
import { ToastProvider } from "../contexts/ToastContext";
import * as dataSource from "../dataSource";
import type { TripEntry } from "../types";
import TripView, { type TripOutletContext } from "./TripView";

// TripView against a signed-in API (the static mode is covered by TripView.test.tsx).
vi.mock("../dataSource", async (importOriginal) => {
  const { isShared } = await importOriginal<typeof import("../dataSource")>();
  return {
    apiEnabled: true,
    isShared,
    loadTrips: vi.fn(),
    loadMembers: vi.fn(),
    inviteLink: (code: string) => `https://travel.example/?join=${code}`,
  };
});

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const ds = vi.mocked(dataSource);

const trip: TripEntry = {
  id: "trip-kyushu",
  name: "九州之旅",
  startDate: "2024-04-01",
  endDate: "2024-04-07",
  coverImage: "",
  version: 0,
  role: "owner",
  ownerEmail: "alice@example.com",
  memberCount: 0,
  pendingCount: 0,
};

/** A tab page in edit mode, which locks the navigation. */
const LockingChild = () => {
  const { setNavLocked } = useOutletContext<TripOutletContext>();
  useEffect(() => {
    setNavLocked(true);
    return () => setNavLocked(false);
  }, [setNavLocked]);
  return <div>editing child</div>;
};

function renderTrip(child = <div>child content</div>) {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/trip/trip-kyushu/schedule"]}>
        <Routes>
          <Route path="/trip/:tripId" element={<TripView />}>
            <Route path="schedule" element={child} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  ds.loadTrips.mockResolvedValue({ data: [trip], editable: true, version: null });
  ds.loadMembers.mockResolvedValue({ ownerEmail: "alice@example.com", members: [], inviteCode: null });
});

describe("TripView 的成員按鈕", () => {
  it("打開成員面板", async () => {
    renderTrip();

    await userEvent.click(await screen.findByRole("button", { name: "成員" }));
    expect(screen.getByRole("dialog", { name: "成員" })).toBeInTheDocument();
    expect(ds.loadMembers).toHaveBeenCalledWith("trip-kyushu");
    expect(await screen.findByRole("button", { name: "建立邀請連結" })).toBeInTheDocument();
  });

  it("資料無法編輯（離線快取）時不顯示", async () => {
    ds.loadTrips.mockResolvedValue({ data: [trip], editable: false, version: null });
    renderTrip();

    await screen.findByText("九州之旅");
    expect(screen.queryByRole("button", { name: "成員" })).not.toBeInTheDocument();
  });

  it("編輯中不顯示", async () => {
    renderTrip(<LockingChild />);

    await screen.findByText("editing child");
    expect(screen.queryByRole("button", { name: "成員" })).not.toBeInTheDocument();
  });
});
