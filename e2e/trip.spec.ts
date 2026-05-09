import { test, expect } from "@playwright/test";

test.describe("旅行詳情", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // 等待卡片載入後點入第一個
    await page.locator('a[href*="trip"]').first().waitFor({ timeout: 8000 });
    await page.locator('a[href*="trip"]').first().click();
  });

  test("進入後顯示底部日程標籤", async ({ page }) => {
    await expect(page.getByRole("link", { name: "日程" })).toBeVisible();
  });

  test("預設顯示日程頁（URL 含 /schedule）", async ({ page }) => {
    await expect(page).toHaveURL(/schedule/);
  });

  test("切換至購物標籤", async ({ page }) => {
    await page.getByRole("link", { name: "購物" }).click();
    await expect(page).toHaveURL(/shops/);
  });

  test("切換至資訊標籤", async ({ page }) => {
    await page.getByRole("link", { name: "資訊" }).click();
    await expect(page).toHaveURL(/info/);
  });

  test("點擊返回按鈕回首頁", async ({ page }) => {
    await page.getByRole("link", { name: "‹" }).click();
    await expect(page.getByRole("heading", { name: "Travel Pocket" })).toBeVisible();
  });

  test("顯示旅行名稱與日期", async ({ page }) => {
    // header 應有旅行名稱與 → 分隔的日期範圍
    await expect(page.locator("header")).toContainText("→");
  });
});
