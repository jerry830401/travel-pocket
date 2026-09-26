import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Settings from "./Settings";
import { ThemeProvider } from "../contexts/ThemeContext";
import * as dataSource from "../dataSource";

// The account comes from the API; the data layer is mocked at its module boundary.
vi.mock("../dataSource", () => ({
  loadMe: vi.fn(),
  signOut: vi.fn(),
}));

const ds = vi.mocked(dataSource);

function renderSettings() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <Settings />
      </ThemeProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  ds.loadMe.mockResolvedValue({ email: "alice@example.com" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Settings", () => {
  it("顯示標題，返回連結指向首頁", () => {
    renderSettings();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("設定");
    expect(screen.getByRole("link", { name: "‹" })).toHaveAttribute("href", "/");
  });

  describe("外觀", () => {
    it("選取目前的偏好", () => {
      localStorage.setItem("theme", "dark");
      renderSettings();
      expect(screen.getByRole("radio", { name: "深色" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "淺色" })).not.toBeChecked();
      expect(screen.getByRole("radio", { name: "跟隨系統" })).not.toBeChecked();
    });

    it("沒有存過偏好時選取跟隨系統", () => {
      renderSettings();
      expect(screen.getByRole("radio", { name: "跟隨系統" })).toBeChecked();
    });

    it("選深色立即套用並記住，選淺色切回", async () => {
      renderSettings();

      await userEvent.click(screen.getByRole("radio", { name: "深色" }));
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(localStorage.getItem("theme")).toBe("dark");

      await userEvent.click(screen.getByRole("radio", { name: "淺色" }));
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(localStorage.getItem("theme")).toBe("light");
    });

    it("選跟隨系統時移除記住的主題", async () => {
      localStorage.setItem("theme", "dark");
      renderSettings();

      await userEvent.click(screen.getByRole("radio", { name: "跟隨系統" }));
      expect(localStorage.getItem("theme")).toBeNull();
      // The test setup's system scheme is light.
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  describe("帳號", () => {
    it("顯示登入的 email；dev server 沒有 Access，不顯示登出", async () => {
      renderSettings();
      expect(await screen.findByText("alice@example.com")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "登出" })).not.toBeInTheDocument();
    });

    it("正式 build 提供登出", async () => {
      vi.stubEnv("DEV", false);
      renderSettings();
      await userEvent.click(await screen.findByRole("button", { name: "登出" }));
      expect(ds.signOut).toHaveBeenCalledOnce();
    });

    it("讀不到帳號時不顯示帳號區塊", async () => {
      vi.stubEnv("DEV", false);
      ds.loadMe.mockResolvedValue(null);
      renderSettings();
      await act(async () => {}); // let loadMe resolve
      expect(ds.loadMe).toHaveBeenCalled();
      expect(screen.queryByRole("heading", { name: "帳號" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "登出" })).not.toBeInTheDocument();
    });
  });
});
