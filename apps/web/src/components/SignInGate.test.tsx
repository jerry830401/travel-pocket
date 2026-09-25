import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInGate } from "./SignInGate";
import * as dataSource from "../dataSource";

const state = vi.hoisted(() => ({ apiEnabled: true }));

vi.mock("../dataSource", () => ({
  get apiEnabled() {
    return state.apiEnabled;
  },
  onSignedOut: vi.fn(),
  goToSignIn: vi.fn(),
}));

const ds = vi.mocked(dataSource);

/** Renders the gate and returns the listener it registered with onSignedOut. */
function renderGate(): () => void {
  let listener: (() => void) | undefined;
  ds.onSignedOut.mockImplementation((l) => {
    listener = l;
    return () => {};
  });
  render(
    <SignInGate>
      <p>app content</p>
    </SignInGate>
  );
  return () => act(() => listener?.());
}

beforeEach(() => {
  vi.clearAllMocks();
  state.apiEnabled = true;
});

describe("SignInGate", () => {
  it("顯示 app，直到 API 回報未登入", () => {
    renderGate();
    expect(screen.getByText("app content")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "前往登入" })).not.toBeInTheDocument();
  });

  it("未登入時改顯示登入提示，不會自動跳轉", () => {
    const signOut = renderGate();
    signOut();

    expect(screen.queryByText("app content")).not.toBeInTheDocument();
    expect(screen.getByText(/請先登入/)).toBeInTheDocument();
    expect(ds.goToSignIn).not.toHaveBeenCalled();
  });

  it("按下「前往登入」才前往登入頁", async () => {
    const signOut = renderGate();
    signOut();

    await userEvent.click(screen.getByRole("button", { name: "前往登入" }));
    expect(ds.goToSignIn).toHaveBeenCalledOnce();
  });

  it("沒有 API 時（靜態模式）不需要登入", () => {
    state.apiEnabled = false;
    renderGate();
    expect(ds.onSignedOut).not.toHaveBeenCalled();
    expect(screen.getByText("app content")).toBeInTheDocument();
  });
});
