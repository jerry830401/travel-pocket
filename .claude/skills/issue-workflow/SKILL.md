---
name: issue-workflow
description: 在這個 repo 評估需求、規劃或改任何檔案前使用。先查 GitHub issues，或使用者指定的 #編號。改動一律照「討論 → 更新 issue → 實作」，每個改動都要有 issue。開新 issue、留言、編輯或關閉 issue 前一律先問使用者；只有勾選已完成且驗證過的 checkbox 可以直接做。使用者提到 issue 編號，或要求評估、規劃、實作、修正時觸發。
---

# Issue Workflow

這個 repo 的工作都照 GitHub issue 規劃來做。改動一律照這個順序：

1. **討論**：先跟使用者討論好做法（第 3 步）。
2. **更新 issue**：把同意的做法寫進 issue（第 4 步）。
3. **實作**：issue 更新完才動手（第 5 步）。

**每個改動都要有 issue，改錯字、改文件也一樣。** 寫入 issue 的動作都要先取得使用者同意，只有勾選已完成且驗證過的 checkbox 例外（見第 5 步）。

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

## 2. 找對應的 issue

- **使用者指定了 #N**：
  - 讀這張 issue 和它的留言。
  - 檢查「相依」列出的 issue 是否已關閉。前置 issue 還沒完成時，先提醒使用者。
  - 改動範圍以「工作項目」為準。超出範圍的事放到第 3 步討論，不順手做。
- **沒有指定**：從 open issues 找對應的 issue。
  - 找到 1 張：先說「這次改動對應 #N」。
  - 找到多張：問使用者是哪一張。
  - 找不到：第 3 步討論時一起擬新 issue 的草稿。
- **指定的 issue 已關閉**：告訴使用者，並問要重新打開，還是開新 issue。

## 3. 討論做法（改任何檔案前）

1. 提出做法：
   - 要改什麼、為什麼。
   - 會改哪些檔案、大概怎麼改。
   - 怎麼驗收。
   - 和 issue 現有內容不一樣的地方：要新增、刪掉或改寫的工作項目和驗收條件。
2. 有需要選擇的地方（「待決定」項目、有幾種做法），用 AskUserQuestion 一個一個問清楚，並附上建議。
3. 做法談定後，把**做法和 issue 草稿一起**給使用者確認，只確認這一次：
   - 已有 issue：列出內文要改的地方（改前 → 改後）。已經符合時，說明不用改。
   - 沒有 issue：附上新 issue 的完整草稿（標題、內文、label，格式見第 4 步）。
   - 用 AskUserQuestion 確認，選項有：照這個做、要調整、先不做；要開新 issue 時再加「併入現有 #N」。
   - 在 plan mode 時，把 issue 草稿寫進 plan 檔，使用者核准 plan 就算同意。
4. **使用者明確同意前，不改任何檔案，也不寫入 issue。** 使用者要調整時，回到第 1 項。

## 4. 更新 issue

使用者同意後，先寫 issue，寫完才實作。

- **已有 issue**：更新內文，讓它和同意的做法一致。
  - 工作項目、驗收條件照討論結果增刪修改。
  - 「待決定」有結論的項目，改寫進工作項目，或用 `> [!NOTE]` 記下決定和理由。
  - 已經勾選的 checkbox 不動。
  - 先讀出目前的 body，改好後寫進 scratchpad 檔案，再用 `gh issue edit <N> -R jerry830401/travel-pocket --body-file <檔案>` 更新。
- **沒有 issue**：照這個 repo 的格式開新 issue。
  - 標題：`<範圍>：<描述>`。範圍例如 `monorepo`、`shared`、`api`、`web`、`deploy`、`docs`、`追蹤`。
  - 內文章節：`## 背景`、`## 工作項目`（checkbox，可再分 `###` 小節）、`## 驗收條件`，視需要加 `## 待決定`、`## 相依` 或 `## 相關`。補充說明用 `> [!NOTE]`、`> [!WARNING]`。
  - label：從現有 label 選（`gh label list -R jerry830401/travel-pocket`），例如 `enhancement`、`bug`、`documentation`。
  - 屬於某張追蹤 issue 的工作，內文註明 `Part of #<追蹤 issue>`。
  - 內文先寫進 scratchpad 檔案，再用 `gh issue create -R jerry830401/travel-pocket --title <標題> --label <label> --body-file <檔案>` 建立。
- 寫完後回報 issue 連結，接著直接實作，不用再問一次。

其他寫入 issue 的動作也要先問：留言、第 3 步確認範圍以外的內文修改、關閉或重開、改 label。

## 5. 實作中與收尾

- 實作中要偏離已同意的做法（多改檔案、換做法、發現範圍外的問題）：停下來回報，回到第 3 步討論，更新 issue 後才繼續。
- commit message 加 `Refs #N`。
- PR 描述寫 `Closes #N`；追蹤 issue 底下的工作再加 `Part of #<追蹤 issue>`。
- 完成後逐條對照「驗收條件」回報結果。
- **勾選 checkbox 不用先問**：工作項目已完成、驗收條件已實際驗證通過的，直接勾選。
  - 只勾真的做完並驗證過的；沒驗證、只做一部分、或驗證失敗的保持不勾，並說明原因。
  - 只能把 `- [ ]` 改成 `- [x]`，內文其他地方一個字都不動。先讀出目前的 body，替換後寫進 scratchpad 檔案，再用 `gh issue edit <N> -R jerry830401/travel-pocket --body-file <檔案>` 更新。
  - 勾完後回報勾了哪些、還剩哪些沒勾。
  - 留言、改其他內文、關閉 issue 仍要先問（見第 4 步最後一段）。
