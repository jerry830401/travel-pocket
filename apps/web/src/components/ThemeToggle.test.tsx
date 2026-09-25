import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./ThemeToggle";
import { ThemeProvider } from "../contexts/ThemeContext";

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("light 模式顯示 ☾", () => {
    render(<ThemeToggle />, { wrapper: Wrapper });
    expect(screen.getByRole("button", { name: "Toggle dark mode" })).toHaveTextContent("☾");
  });

  it("dark 模式顯示 ☀", () => {
    localStorage.setItem("theme", "dark");
    render(<ThemeToggle />, { wrapper: Wrapper });
    expect(screen.getByRole("button", { name: "Toggle dark mode" })).toHaveTextContent("☀");
  });

  it("點擊後由 ☾ 切換為 ☀", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />, { wrapper: Wrapper });
    const btn = screen.getByRole("button", { name: "Toggle dark mode" });
    await user.click(btn);
    expect(btn).toHaveTextContent("☀");
  });

  it("接受自訂 className", () => {
    render(<ThemeToggle className="my-btn" />, { wrapper: Wrapper });
    expect(screen.getByRole("button", { name: "Toggle dark mode" })).toHaveClass("my-btn");
  });
});
