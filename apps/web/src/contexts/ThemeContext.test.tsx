import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme, type ThemePreference } from "./ThemeContext";

// 暴露 hook 狀態的輔助元件
const ThemeConsumer = () => {
  const { theme, preference, setPreference } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="preference">{preference}</span>
      {(["light", "dark", "system"] as ThemePreference[]).map((p) => (
        <button key={p} onClick={() => setPreference(p)}>{p}</button>
      ))}
    </div>
  );
};

function renderTheme() {
  return render(
    <ThemeProvider>
      <ThemeConsumer />
    </ThemeProvider>
  );
}

/** Replaces the system color scheme; the returned function switches it. */
function mockSystem(dark: boolean) {
  let matches = dark;
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    get matches() { return matches; },
    media: query,
    onchange: null,
    addEventListener: (_: string, l: (e: MediaQueryListEvent) => void) => listeners.add(l),
    removeEventListener: (_: string, l: (e: MediaQueryListEvent) => void) => listeners.delete(l),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList);
  return (next: boolean) => {
    matches = next;
    act(() => listeners.forEach((l) => l({ matches: next } as MediaQueryListEvent)));
  };
}

describe("ThemeContext", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("沒有存過偏好時跟隨系統，系統非深色為 light", () => {
    renderTheme();
    expect(screen.getByTestId("preference")).toHaveTextContent("system");
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
  });

  it("跟隨系統且系統為深色時為 dark", () => {
    mockSystem(true);
    renderTheme();
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("localStorage 儲存 dark 時初始為 dark，html 含 dark class", () => {
    localStorage.setItem("theme", "dark");
    renderTheme();
    expect(screen.getByTestId("preference")).toHaveTextContent("dark");
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("localStorage 儲存 light 時不受系統深色影響", () => {
    mockSystem(true);
    localStorage.setItem("theme", "light");
    renderTheme();
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
  });

  it("localStorage 的值無效時當作跟隨系統", () => {
    localStorage.setItem("theme", "blue");
    renderTheme();
    expect(screen.getByTestId("preference")).toHaveTextContent("system");
  });

  it("選 dark 後套用並存入 localStorage，選 light 切回", async () => {
    const user = userEvent.setup();
    renderTheme();

    await user.click(screen.getByRole("button", { name: "dark" }));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");

    await user.click(screen.getByRole("button", { name: "light" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("選跟隨系統後移除 localStorage，依系統決定主題", async () => {
    mockSystem(true);
    localStorage.setItem("theme", "light");
    const user = userEvent.setup();
    renderTheme();

    await user.click(screen.getByRole("button", { name: "system" }));
    expect(localStorage.getItem("theme")).toBeNull();
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("跟隨系統時，系統切換深淺色會跟著變", () => {
    const setSystem = mockSystem(false);
    renderTheme();

    setSystem(true);
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    setSystem(false);
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("選了淺色時，系統切換深色不影響", () => {
    const setSystem = mockSystem(false);
    localStorage.setItem("theme", "light");
    renderTheme();

    setSystem(true);
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
  });
});
