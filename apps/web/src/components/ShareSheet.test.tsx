import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "../contexts/ToastContext";
import * as dataSource from "../dataSource";
import type { TripEntry, TripMembers } from "../types";
import { ShareSheet } from "./ShareSheet";

// The sheet against a signed-in API: the data layer is mocked at its module boundary.
vi.mock("../dataSource", () => ({
  loadMembers: vi.fn(),
  createInvite: vi.fn(),
  inviteLink: (code: string) => `https://travel.example/?join=${code}`,
  approveMember: vi.fn(),
  removeMember: vi.fn(),
  loadMe: vi.fn(),
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

const trip: TripEntry = {
  id: "trip-sendai",
  name: "仙台",
  startDate: "2026-03-01",
  endDate: "2026-03-08",
  coverImage: "",
  version: 0,
  role: "owner",
  ownerEmail: "alice@example.com",
  memberCount: 1,
  pendingCount: 1,
};

const ownerView: TripMembers = {
  ownerEmail: "alice@example.com",
  members: [
    { email: "bob@example.com", status: "member" },
    { email: "carol@example.com", status: "pending" },
  ],
  inviteCode: "c0de",
};

const memberView: TripMembers = {
  ownerEmail: "alice@example.com",
  members: [{ email: "bob@example.com", status: "member" }],
  inviteCode: null,
};

function renderSheet(entry: TripEntry = trip, onLeft = vi.fn()) {
  render(
    <ToastProvider>
      <ShareSheet trip={entry} open onClose={vi.fn()} onLeft={onLeft} />
    </ToastProvider>
  );
  return { onLeft };
}

function row(email: string): HTMLElement {
  return screen.getByText(email).closest("li")!;
}

beforeEach(() => {
  vi.clearAllMocks();
  ds.loadMembers.mockResolvedValue(ownerView);
  ds.approveMember.mockResolvedValue(undefined);
  ds.removeMember.mockResolvedValue(undefined);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("擁有者", () => {
  it("看到邀請連結、申請與成員", async () => {
    renderSheet();

    expect(await screen.findByRole("textbox", { name: "邀請連結" })).toHaveValue("https://travel.example/?join=c0de");
    expect(within(row("carol@example.com")).getByRole("button", { name: "同意" })).toBeInTheDocument();
    expect(within(row("bob@example.com")).getByRole("button", { name: "移除" })).toBeInTheDocument();
    expect(within(row("alice@example.com")).getByText("擁有者（你）")).toBeInTheDocument();
  });

  it("沒有邀請碼時先建立", async () => {
    ds.loadMembers.mockResolvedValue({ ...ownerView, inviteCode: null });
    ds.createInvite.mockResolvedValue("n3w");
    renderSheet();

    await userEvent.click(await screen.findByRole("button", { name: "建立邀請連結" }));
    expect(ds.createInvite).toHaveBeenCalledWith("trip-sendai");
    expect(screen.getByRole("textbox", { name: "邀請連結" })).toHaveValue("https://travel.example/?join=n3w");
  });

  it("複製連結", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    renderSheet();

    await user.click(await screen.findByRole("button", { name: "複製連結" }));
    expect(writeText).toHaveBeenCalledWith("https://travel.example/?join=c0de");
    expect(await screen.findByRole("status")).toHaveTextContent("已複製邀請連結");
  });

  it("同意申請後重新載入成員", async () => {
    renderSheet();

    await userEvent.click(await screen.findByRole("button", { name: "同意" }));
    expect(ds.approveMember).toHaveBeenCalledWith("trip-sendai", "carol@example.com");
    await waitFor(() => expect(ds.loadMembers).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("status")).toHaveTextContent("carol@example.com 已加入");
  });

  it("確認後拒絕申請、移除成員", async () => {
    renderSheet();

    await userEvent.click(await screen.findByRole("button", { name: "拒絕" }));
    expect(window.confirm).toHaveBeenLastCalledWith(expect.stringContaining("拒絕 carol@example.com"));
    expect(ds.removeMember).toHaveBeenLastCalledWith("trip-sendai", "carol@example.com");

    await userEvent.click(screen.getByRole("button", { name: "移除" }));
    expect(ds.removeMember).toHaveBeenLastCalledWith("trip-sendai", "bob@example.com");
  });

  it("確認時選取消就不移除", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    renderSheet();

    await userEvent.click(await screen.findByRole("button", { name: "移除" }));
    expect(ds.removeMember).not.toHaveBeenCalled();
  });

  it("失敗時提示原因", async () => {
    ds.approveMember.mockRejectedValue(new Error("No such request to join"));
    renderSheet();

    await userEvent.click(await screen.findByRole("button", { name: "同意" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("操作失敗：No such request to join");
  });
});

describe("成員", () => {
  const joined: TripEntry = { ...trip, role: "member", pendingCount: 0 };

  beforeEach(() => {
    ds.loadMembers.mockResolvedValue(memberView);
    ds.loadMe.mockResolvedValue({ email: "bob@example.com" });
  });

  it("只看到成員，不能邀請或移除別人", async () => {
    renderSheet(joined);

    expect(await screen.findByText("bob@example.com")).toBeInTheDocument();
    expect(within(row("alice@example.com")).getByText("擁有者")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "邀請連結" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "建立邀請連結" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "移除" })).not.toBeInTheDocument();
  });

  it("確認後退出旅程", async () => {
    const { onLeft } = renderSheet(joined);

    await userEvent.click(await screen.findByRole("button", { name: "退出旅程" }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("確定退出「仙台」"));
    expect(ds.removeMember).toHaveBeenCalledWith("trip-sendai", "bob@example.com");
    await waitFor(() => expect(onLeft).toHaveBeenCalledOnce());
  });
});

it("成員載入失敗時可以重試", async () => {
  ds.loadMembers.mockRejectedValueOnce(new Error("HTTP 500"));
  renderSheet();

  await userEvent.click(await screen.findByRole("button", { name: "重試" }));
  expect(await screen.findByRole("textbox", { name: "邀請連結" })).toBeInTheDocument();
});
