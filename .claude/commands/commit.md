# Commit Skill

在建立 git commit 前，依序執行以下三道關卡。**任何一關失敗即中止，不得建立 commit。**

## 步驟

### 1. ESLint 檢查
```
pnpm lint
```
- 若有 error：列出所有錯誤並說明修正方向，**中止流程**。
- Warning 可繼續，但需告知使用者。

### 2. 單元測試
```
pnpm test
```
- 若有失敗：顯示失敗的測試名稱與錯誤訊息，**中止流程**。
- 全部通過才繼續。

### 3. E2E 測試
```
pnpm test:e2e
```
- 若有失敗：顯示失敗的測試名稱與錯誤訊息，**中止流程**。
- 全部通過才繼續。

### 4. 建立 Commit（三關全過後才執行）

1. 執行 `git status` 確認哪些檔案要提交。
2. 詢問使用者確認暫存範圍（或直接暫存使用者指定的檔案）。
3. 根據 diff 內容，以**繁體中文**撰寫 commit message，格式：
   ```
   <type>: <簡短描述>
   
   <可選的詳細說明>
   
   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
   ```
   type 使用：`feat` / `fix` / `refactor` / `test` / `ci` / `docs` / `chore`
4. 執行 `git commit`。

## 中止時的訊息範本
> ❌ **[關卡名稱] 未通過，已中止 commit。**
> 請修正以下問題後再執行 `/commit`：
> [問題列表]
