import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../contexts/ToastContext";
import * as dataSource from "../dataSource";
import type { Invite } from "../types";
import Join from "./Join";

vi.mock("../dataSource", () => ({ loadInvite: vi.fn(), requestJoin: vi.fn() }));

const ds = vi.mocked(dataSource);

const CODE = "0123456789abcdef0123456789abcdef";

const invite: Invite = {
  tripId: "trip-sendai",
  tripName: "仙台",
  ownerEmail: "alice@example.com",
  status: "none",
};

function renderJoin(code = CODE) {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/join/${code}`]}>
        <Routes>
          <Route path="/join/:code" element={<Join />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("加入旅程", () => {
  it("顯示旅程與擁有者，申請後等擁有者同意", async () => {
    ds.loadInvite.mockResolvedValue(invite);
    ds.requestJoin.mockResolvedValue({ ...invite, status: "pending" });
    renderJoin();

    expect(await screen.findByRole("heading", { name: "仙台" })).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(ds.loadInvite).toHaveBeenCalledWith(CODE);

    await userEvent.click(screen.getByRole("button", { name: "申請加入" }));
    expect(ds.requestJoin).toHaveBeenCalledWith(CODE);
    expect(await screen.findByRole("status")).toHaveTextContent("已送出申請");
    expect(screen.queryByRole("button", { name: "申請加入" })).not.toBeInTheDocument();
  });

  it("已經申請過時直接顯示等待中", async () => {
    ds.loadInvite.mockResolvedValue({ ...invite, status: "pending" });
    renderJoin();

    expect(await screen.findByRole("status")).toHaveTextContent("已送出申請");
  });

  it.each([
    ["member", "你已經是這趟旅程的成員"],
    ["owner", "這是你的旅程"],
  ] as const)("%s 直接打開旅程", async (status, text) => {
    ds.loadInvite.mockResolvedValue({ ...invite, status });
    renderJoin();

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打開旅程" })).toHaveAttribute("href", "/trip/trip-sendai");
  });

  it("找不到的邀請碼顯示無效", async () => {
    ds.loadInvite.mockResolvedValue(null);
    renderJoin();

    expect(await screen.findByText(/邀請連結無效/)).toBeInTheDocument();
  });

  it("格式不對的邀請碼不送出請求", async () => {
    renderJoin("not-a-code");

    expect(await screen.findByText(/邀請連結無效/)).toBeInTheDocument();
    expect(ds.loadInvite).not.toHaveBeenCalled();
  });

  it("讀不到時可以重試", async () => {
    ds.loadInvite.mockRejectedValueOnce(new Error("HTTP 500")).mockResolvedValueOnce(invite);
    renderJoin();

    await userEvent.click(await screen.findByRole("button", { name: "重試" }));
    expect(await screen.findByRole("heading", { name: "仙台" })).toBeInTheDocument();
  });

  it("申請失敗時提示原因", async () => {
    ds.loadInvite.mockResolvedValue(invite);
    ds.requestJoin.mockRejectedValue(new Error("Invite not found"));
    renderJoin();

    await userEvent.click(await screen.findByRole("button", { name: "申請加入" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("申請失敗：Invite not found");
  });
});
