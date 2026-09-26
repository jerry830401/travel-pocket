import { test, expect } from "@playwright/test";

test.describe("首頁", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("顯示 Travel Pocket 標題", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Travel Pocket" })).toBeVisible();
  });

  test("載入並顯示旅行卡片", async ({ page }) => {
    // 等待至少一張卡片出現
    await expect(page.locator('a[href*="trip"]').first()).toBeVisible({ timeout: 8000 });
  });

  test("顯示旅行名稱", async ({ page }) => {
    await expect(page.getByText("仙台")).toBeVisible({ timeout: 8000 });
  });

  test("設定按鈕可見，點擊進入設定頁", async ({ page }) => {
    await page.getByRole("link", { name: "設定" }).click();
    await expect(page).toHaveURL(/#\/settings$/);
    await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
  });
});

test.describe("設定頁", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/settings");
  });

  test("選深色後 html 加上 dark class，重新整理後保留", async ({ page }) => {
    await page.getByText("深色", { exact: true }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("radio", { name: "深色" })).toBeChecked();
  });

  test("深色時選淺色，移除 dark class", async ({ page }) => {
    await page.getByText("深色", { exact: true }).click();
    await page.getByText("淺色", { exact: true }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("選跟隨系統時跟著系統深淺色", async ({ page }) => {
    await page.getByText("淺色", { exact: true }).click();
    await page.getByText("跟隨系統", { exact: true }).click();
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("返回按鈕回首頁", async ({ page }) => {
    await page.getByRole("link", { name: "‹" }).click();
    await expect(page.getByRole("heading", { name: "Travel Pocket" })).toBeVisible();
  });
});
