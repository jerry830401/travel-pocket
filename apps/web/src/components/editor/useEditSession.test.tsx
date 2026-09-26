import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, screen } from "@testing-library/react";
import { ToastProvider } from "../../contexts/ToastContext";
import { ConflictError } from "../../dataSource";
import { useEditSession, type EditSessionOptions, type SaveDraft } from "./useEditSession";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function setup(save: SaveDraft<string[]>, options?: EditSessionOptions) {
  const hook = renderHook(() => useEditSession<string[]>([], save, options), {
    wrapper: ToastProvider,
  });
  act(() => hook.result.current.load(["a", "b"]));
  return hook;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useEditSession", () => {
  it("編輯中的變更只改草稿，完成時才儲存並提示「已儲存」", async () => {
    const save = vi.fn<SaveDraft<string[]>>(async (draft) => draft);
    const { result } = setup(save);

    act(() => result.current.start());
    act(() => result.current.setData(["a"]));
    expect(result.current.data).toEqual(["a"]);
    expect(save).not.toHaveBeenCalled();

    await act(() => result.current.finish());
    expect(save).toHaveBeenCalledWith(["a"], ["a", "b"], expect.any(Function));
    expect(result.current.editing).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent("已儲存");
  });

  it("沒有變更時完成不會儲存", async () => {
    const save = vi.fn<SaveDraft<string[]>>(async (draft) => draft);
    const { result } = setup(save);

    act(() => result.current.start());
    await act(() => result.current.finish());
    expect(save).not.toHaveBeenCalled();
    expect(result.current.editing).toBe(false);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("儲存失敗時提示原因，留在編輯模式並保留草稿", async () => {
    const save = vi.fn<SaveDraft<string[]>>(async () => { throw new Error("HTTP 500"); });
    const { result } = setup(save);

    act(() => result.current.start());
    act(() => result.current.setData(["a"]));
    await act(() => result.current.finish());

    expect(screen.getByRole("alert")).toHaveTextContent("儲存失敗：HTTP 500");
    expect(result.current.editing).toBe(true);
    expect(result.current.data).toEqual(["a"]);
  });

  it("失敗前回報的進度會保留，重試時從那裡繼續", async () => {
    const save = vi.fn<SaveDraft<string[]>>()
      .mockImplementationOnce(async (_draft, _saved, progress) => {
        progress(["a"], ["a", "c"]);
        throw new Error("HTTP 500");
      })
      .mockImplementationOnce(async (draft) => draft);
    const { result } = setup(save);

    act(() => result.current.start());
    act(() => result.current.setData(["a", "c"]));
    await act(() => result.current.finish());
    await act(() => result.current.finish());

    expect(save).toHaveBeenLastCalledWith(["a", "c"], ["a"], expect.any(Function));
    expect(result.current.editing).toBe(false);
  });

  it("別人先存過時丟掉草稿、離開編輯模式並重新載入", async () => {
    const save = vi.fn<SaveDraft<string[]>>(async () => { throw new ConflictError(); });
    const reload = vi.fn();
    const { result } = setup(save, { reload });

    act(() => result.current.start());
    act(() => result.current.setData(["a"]));
    await act(() => result.current.finish());

    expect(screen.getByRole("alert")).toHaveTextContent("別人剛修改過，已載入最新版本");
    expect(result.current.editing).toBe(false);
    expect(result.current.data).toEqual(["a", "b"]);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("衝突前已存好的進度不會被丟掉", async () => {
    const save = vi.fn<SaveDraft<string[]>>(async (_draft, _saved, progress) => {
      progress(["a"], ["a", "c"]);
      throw new ConflictError();
    });
    const { result } = setup(save, { reload: vi.fn() });

    act(() => result.current.start());
    act(() => result.current.setData(["a", "c"]));
    await act(() => result.current.finish());

    expect(result.current.data).toEqual(["a"]);
  });

  it("取消時確認後丟棄草稿", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { result } = setup(vi.fn());

    act(() => result.current.start());
    act(() => result.current.setData(["a"]));
    act(() => result.current.cancel());

    expect(confirmSpy).toHaveBeenCalledWith("確定放棄這次的變更？");
    expect(result.current.data).toEqual(["a", "b"]);
    expect(result.current.editing).toBe(false);
  });

  it("取消確認選否時繼續編輯", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = setup(vi.fn());

    act(() => result.current.start());
    act(() => result.current.setData(["a"]));
    act(() => result.current.cancel());

    expect(result.current.data).toEqual(["a"]);
    expect(result.current.editing).toBe(true);
  });

  it("沒有變更時取消不確認", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const { result } = setup(vi.fn());

    act(() => result.current.start());
    act(() => result.current.cancel());

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(result.current.editing).toBe(false);
  });

  it("編輯中鎖住導覽，結束後解鎖", () => {
    const lockNav = vi.fn();
    const { result } = setup(vi.fn(), { lockNav });

    act(() => result.current.start());
    expect(lockNav).toHaveBeenLastCalledWith(true);
    act(() => result.current.cancel());
    expect(lockNav).toHaveBeenLastCalledWith(false);
  });
});
