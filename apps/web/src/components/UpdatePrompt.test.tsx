import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRegisterSW } from "virtual:pwa-register/react";
import { UpdatePrompt } from "./UpdatePrompt";

function setup(needRefresh: boolean) {
  const setNeedRefresh = vi.fn();
  const updateServiceWorker = vi.fn();
  vi.mocked(useRegisterSW).mockReturnValue({
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
    offlineReady: [false, vi.fn()],
  } as ReturnType<typeof useRegisterSW>);
  return { setNeedRefresh, updateServiceWorker };
}

describe("UpdatePrompt", () => {
  beforeEach(() => {
    vi.mocked(useRegisterSW).mockReset();
  });

  it("needRefresh=false 時不渲染任何內容", () => {
    setup(false);
    const { container } = render(<UpdatePrompt />);
    expect(container.firstChild).toBeNull();
  });

  it("needRefresh=true 時顯示更新提示文字", () => {
    setup(true);
    render(<UpdatePrompt />);
    expect(screen.getByText(/發現新版本/)).toBeInTheDocument();
  });

  it("點擊「立即更新」呼叫 updateServiceWorker(true)", async () => {
    const user = userEvent.setup();
    const { updateServiceWorker } = setup(true);
    render(<UpdatePrompt />);
    await user.click(screen.getByRole("button", { name: "立即更新" }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it("點擊關閉按鈕呼叫 setNeedRefresh(false)", async () => {
    const user = userEvent.setup();
    const { setNeedRefresh } = setup(true);
    render(<UpdatePrompt />);
    await user.click(screen.getByRole("button", { name: "關閉" }));
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
  });
});
