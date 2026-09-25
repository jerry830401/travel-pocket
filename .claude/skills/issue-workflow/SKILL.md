---
name: issue-workflow
description: 在這個 repo 評估需求、規劃或改任何檔案前使用。先查 GitHub issues，或使用者指定的 #編號。開新 issue、留言、編輯或關閉 issue 前一律先問使用者。使用者提到 issue 編號，或要求評估、規劃、實作、修正時觸發。
---

# Issue Workflow

這個 repo 的工作都照 GitHub issue 規劃來做。評估、規劃、改動前，先對照 issue；**任何寫入 issue 的動作都要先取得使用者同意。**

## 0. gh 指令

- repo 固定是 `jerry830401/travel-pocket`，指令一律加 `-R jerry830401/travel-pocket`。
- `gh` 可能不在 PATH 上。找不到時改用完整路徑：
  - PowerShell：`& "C:\Program Files\GitHub CLI\gh.exe"`
  - Bash：`"/c/Program Files/GitHub CLI/gh.exe"`
- gh 無法使用或沒登入時，要告訴使用者，**不可默默跳過這個流程**。

## 1. 評估／規劃前

1. 列出 open issues：
   ```
   gh issue list -R jerry830401/travel-pocket --state open --limit 50 --json number,title,labels
   ```
   需要時再查已關閉的 issue：`--state all --search "<關鍵字>"`。
2. 找到相關 issue 就讀完整內容，要看背景、工作項目、驗收條件、待決定、相依：
   ```
   gh issue view <N> -R jerry830401/travel-pocket --json title,state,body,comments
   ```
   不要用 `--comments`：在非互動環境下它只輸出留言，沒有留言時什麼都不會印。
3. 回覆時先列出相關 issue（`#N 標題`），並說明它們對這次評估的影響。
4. 評估結果和 issue 已定下的決策或「待決定」項目衝突時，要明確指出，不能直接推翻。

## 2. 改動前

- **使用者指定了 #N**：
  - 讀這張 issue 和它的留言。
  - 檢查「相依」列出的 issue 是否已關閉。前置 issue 還沒完成時，先提醒使用者。
  - 改動範圍以「工作項目」為準。超出範圍的事先回報，不順手做。
- **沒有指定**：從 open issues 找對應的 issue。
  - 找到 1 張：先說「這次改動對應 #N」，再開始。
  - 找到多張：問使用者是哪一張。
  - 找不到：進入第 3 步。**使用者回覆前不動手。**
- **指定的 issue 已關閉**：告訴使用者，並問要重新打開、開新 issue，還是不掛 issue 直接做。

## 3. 需要開 issue 時（一律先問）

1. 依這個 repo 的格式擬草稿：
   - 標題：`<範圍>：<描述>`。範圍例如 `monorepo`、`shared`、`api`、`web`、`deploy`、`docs`、`追蹤`。
   - 內文章節：`## 背景`、`## 工作項目`（checkbox，可再分 `###` 小節）、`## 驗收條件`，視需要加 `## 待決定`、`## 相依` 或 `## 相關`。補充說明用 `> [!NOTE]`、`> [!WARNING]`。
   - label：從現有 label 選（`gh label list -R jerry830401/travel-pocket`），例如 `enhancement`、`bug`、`documentation`。
   - 屬於後端導入的工作要註明 Part of #6。
2. 用 AskUserQuestion 附上草稿，提供這些選項：開新 issue、併入現有 #N、不開 issue 直接做、先不做。
3. **使用者明確同意前，不執行 `gh issue create`。** 內文先寫進 scratchpad 檔案，再用 `--body-file` 傳入。

其他寫入 issue 的動作也要先問：留言、修改內文或勾選 checkbox、關閉或重開、改 label。

## 4. 實作中與收尾

- 實作中發現 issue 範圍外的問題：停下來回報，不擴大範圍。
- commit message 加 `Refs #N`。
- PR 描述寫 `Closes #N`；追蹤 issue 底下的工作再加 `Part of #6`。
- 完成後逐條對照「驗收條件」回報結果。要勾選 checkbox 或留言，照第 3 步先問。
