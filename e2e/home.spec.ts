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

  test("主題切換按鈕可見", async ({ page }) => {
    await expect(page.getByRole("button", { name: "切換主題" })).toBeVisible();
  });

  test("點擊主題切換後 html 加上 dark class", async ({ page }) => {
    await page.getByRole("button", { name: "切換主題" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("深色模式下再點擊切回 light，移除 dark class", async ({ page }) => {
    const btn = page.getByRole("button", { name: "切換主題" });
    await btn.click(); // → dark
    await btn.click(); // → light
    const classList = await page.locator("html").getAttribute("class");
    expect(classList ?? "").not.toContain("dark");
  });
});
