# Travel Pocket

行動裝置優先的旅遊手冊 PWA。所有行程資料以靜態 JSON 存放，部署於 GitHub Pages，可安裝到手機主畫面並支援離線瀏覽。

🔗 https://jerry830401.github.io/travel-pocket/

## 功能

- **行程表** — 依日期分頁，顯示標題、地點、類別貼紙、起訖時間與行程間的空檔時間差；點擊項目由下往上彈出詳細資訊，地點可外連 Google Map。
- **店鋪** — 以 tag 分類商店，顯示名稱、地點、營業時間與 Google Map 連結。
- **資訊** — 以主題分組的外部連結清單（出入境、景點等），每組可設定 emoji 圖示。
- **深色 / 淺色主題** — 以 `localStorage` 記憶選擇，預設跟隨系統 `prefers-color-scheme`。
- **PWA** — Service Worker 離線快取，有新版本時跳出更新提示。
- **本地編輯模式** — 僅在 `pnpm dev` 下啟用，可直接在畫面上新增／編輯／刪除資料並寫回 JSON 檔。

## 技術棧

| 分類 | 使用 |
|---|---|
| 框架 | React 19 + TypeScript 5.9（strict） |
| 建置 | Vite 7 |
| 樣式 | Tailwind CSS 3 |
| 路由 | React Router 7（**HashRouter**） |
| 動畫 | framer-motion |
| 時間處理 | date-fns |
| 圖示 | lucide-react |
| PWA | vite-plugin-pwa（Workbox） |
| 測試 | Vitest + React Testing Library / Playwright |
| 套件管理 | pnpm 10（版本由 proto 釘選） |

## 開始開發

Node 與 pnpm 版本已在 `.prototools` 釘選（node 22.22.0 / pnpm 10.28.0）。若使用 [proto](https://moonrepo.dev/proto)：

```bash
proto install     # 依 .prototools 安裝對應版本
pnpm install
pnpm dev          # http://localhost:5173/travel-pocket/
```

未使用 proto 也可以，`package.json` 的 `packageManager` 欄位會讓 corepack 對上同一個 pnpm 版本。

### 指令

```bash
pnpm dev            # Vite dev server（含 HMR 與編輯模式）
pnpm build          # tsc 型別檢查 + production build，輸出到 dist/
pnpm preview        # 在本機預覽 production build
pnpm lint           # ESLint

pnpm test           # Vitest 單元測試（單次執行）
pnpm test:watch     # Vitest watch 模式
pnpm test:coverage  # V8 coverage 報告
pnpm test:e2e       # Playwright E2E（自動啟動 dev server）
pnpm test:e2e:ui    # Playwright 互動式 UI

pnpm deploy         # build 後以 gh-pages 推送 dist/
```

## 專案結構

```
├── .github/workflows/deploy.yml   # push 到 master 自動部署 GitHub Pages
├── .prototools                    # 釘選 node / pnpm 版本
├── docs/                          # 需求文件與套件說明
├── e2e/                           # Playwright E2E 測試
│   ├── home.spec.ts
│   └── trip.spec.ts
├── public/
│   ├── data/                      # 所有行程資料（靜態 JSON）
│   │   ├── trips.json             # 旅程清單
│   │   ├── sendai-2026/
│   │   │   ├── itinerary.json
│   │   │   ├── shops.json
│   │   │   ├── info.json
│   │   │   └── snapshot.jpg
│   │   └── kyushu-2024/…
│   └── icons/                     # PWA 圖示
├── src/
│   ├── App.tsx                    # 路由定義與外層容器
│   ├── main.tsx                   # 進入點
│   ├── types.ts                   # 所有資料結構的 TypeScript 介面
│   ├── pages/
│   │   ├── Home.tsx               # 旅程選擇首頁
│   │   ├── TripView.tsx           # 巢狀路由的 layout shell，負責抓資料
│   │   ├── Schedule.tsx           # 行程表
│   │   ├── scheduleUtils.ts       # 時間差／日期格式的純函式
│   │   ├── Shops.tsx              # 店鋪
│   │   └── Info.tsx               # 資訊
│   ├── components/
│   │   ├── ThemeToggle.tsx
│   │   ├── UpdatePrompt.tsx       # PWA 更新提示
│   │   └── editor/                # 開發用編輯模式 UI 元件
│   ├── contexts/ThemeContext.tsx  # 深淺色主題
│   ├── hooks/useDataEditor.ts     # 編輯模式的儲存 API
│   └── test/                      # Vitest setup 與 mock
├── vite-plugin-data-editor.ts     # dev-only 的 JSON 讀寫 REST API
└── vite.config.ts
```

單元測試與被測檔案並排放置（`Schedule.tsx` ↔ `Schedule.test.tsx`）。

## 路由

使用 **HashRouter**，這是 GitHub Pages 靜態託管的必要條件（不能用 BrowserRouter）。

| 路由 | 頁面 |
|---|---|
| `/#/` | 旅程選擇首頁 |
| `/#/trip/{tripId}/schedule` | 行程表（`/trip/{tripId}` 會自動導向這裡） |
| `/#/trip/{tripId}/shops` | 店鋪 |
| `/#/trip/{tripId}/info` | 資訊 |

`TripView.tsx` 是巢狀 layout，統一抓取旅程資料後透過 `useOutletContext` 傳給子路由。

## 資料

所有資料都是 `/public/data/` 底下的靜態 JSON，在執行期以 fetch 取得，沒有後端。型別定義見 [`src/types.ts`](src/types.ts)。

### 新增一趟旅程

1. 在 `public/data/` 建立資料夾，名稱即 `tripId`（僅限英數、`-`、`_`）。
2. 放入 `itinerary.json`、`shops.json`、`info.json`。
3. 在 `public/data/trips.json` 加一筆項目。

除非要引入新欄位，否則**不需要改任何程式碼**。

### 資料格式

```jsonc
// trips.json — Trip[]
{
  "id": "sendai-2026",
  "name": "仙台",
  "startDate": "2026-03-14",
  "endDate": "2026-03-21",
  "coverImage": "https://…",
  "snapshot": "data/sendai-2026/snapshot.jpg"   // 選填
}

// itinerary.json — ItineraryDay[]
{
  "id": "1",
  "day": 1,                    // 支援數字或字母混合，如 "8A"、"8B"
  "date": "2026-03-14",
  "items": [
    {
      "id": "1-1",
      "title": "小港機場出發",
      "location": "Kaohsiung International Airport",
      "category": "planeTakeoff",
      "startTime": "10:30",
      "endTime": "13:25",
      "googleMapLink": "",       // 選填
      "description": ["…"]       // 選填，字串或字串陣列
    }
  ]
}

// shops.json — Shop[]
{ "id": "…", "name": "…", "location": "…", "tags": ["甜點"], "businessHours": "10:00–19:00", "googleMapLink": "…" }

// info.json — InfoItem[]
{ "id": "…", "title": "出入境", "icon": "🛂", "links": [{ "label": "…", "url": "…" }] }
```

`day` 欄位支援字母混合格式（例如同一天分成 `8A`、`8B` 兩段）。

### 行程類別

`category` 對應 `Schedule.tsx` 內的貼紙圖示，可用值：

| 值 | 顯示 | 值 | 顯示 |
|---|---|---|---|
| `planeTakeoff` | ✈ 出發 | `car` | 🚗 自駕 |
| `planeLanding` | 🛬 抵達 | `hotel` | 住 住宿 |
| `train` | 🚆 交通 | `food` | 食 餐廳 |
| `bus` | 🚌 巴士 | `sightseeing` | ⛩ 景點 |
| `ship` | ⛴ 渡船 | 其他 | · 其他（fallback） |

## 本地編輯模式

`pnpm dev` 時畫面上會出現 `✏ DEV EDIT MODE` 標記，行程／店鋪／資訊都可以直接在 UI 上新增、編輯、刪除，儲存後會**直接寫回 `public/data/` 的 JSON 檔**。

實作分兩部分：

- [`vite-plugin-data-editor.ts`](vite-plugin-data-editor.ts) — 掛在 dev server 上的 `/api/data/*` REST 端點，含路徑白名單與 traversal 防護。
- [`src/hooks/useDataEditor.ts`](src/hooks/useDataEditor.ts) — 前端以 `import.meta.env.DEV` 判斷是否啟用。

production build 不會包含這條路徑，編輯功能在線上版本完全停用。

## 測試

| 層級 | 工具 | 位置 |
|---|---|---|
| 單元 / 元件 | Vitest + React Testing Library + jsdom | `src/**/*.test.tsx` |
| E2E | Playwright（僅 Chromium） | `e2e/*.spec.ts` |

- Vitest setup 在 `src/test/setup.ts`，替 jsdom 補上 `matchMedia`，並在每個測試後執行 `cleanup`。
- E2E 針對 `http://localhost:5173/travel-pocket/` 執行，dev server 由 `playwright.config.ts` 的 `webServer` 自動啟動。

## 部署

推送到 `master` 會觸發 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)，自動 build 並發佈 `dist/` 到 GitHub Pages。也可用 `pnpm deploy` 從本機手動發佈。

建置注意事項：

- base path 固定為 `/travel-pocket/`（`vite.config.ts`），GitHub Pages 子路徑所需。
- TypeScript strict 模式開啟，含 `noUnusedLocals`、`noUnusedParameters`。
- 版面為 mobile-first，主容器上限 `max-width: 480px`。
- 行程 JSON 採 NetworkFirst 快取策略，離線可用、7 天過期。
