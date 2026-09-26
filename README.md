# Travel Pocket

行動裝置優先的旅遊手冊 PWA。用 Google 帳號登入（Cloudflare Access）後，每個人管理自己的行程；前端和 API 都部署在 Cloudflare Workers，資料存在 Cloudflare D1。可以安裝到手機主畫面，離線時也看得到最後讀到的資料。

🔗 https://travel-pocket.travel-pocket-web.workers.dev（需要 Google 帳號登入）

## 功能

- **行程表** — 依日期分頁，顯示標題、地點、類別貼紙、起訖時間與行程間的空檔；點擊項目由下往上彈出詳細資訊，地點可外連 Google Map。
- **店鋪** — 以 tag 分類商店，顯示名稱、地點、營業時間與 Google Map 連結。
- **資訊** — 以主題分組的外部連結清單（出入境、景點等），每組可設定 emoji 圖示。
- **帳號** — 用 Google 帳號登入，各自的行程分開；可以新增、編輯、刪除旅程和其中的行程、店鋪、資訊。
- **深色 / 淺色主題** — 以 `localStorage` 記憶選擇，預設跟隨系統 `prefers-color-scheme`。
- **PWA** — Service Worker 快取；離線時顯示最後讀到的資料（唯讀），有新版本時跳出更新提示。

## 技術棧

| 分類 | 使用 |
|---|---|
| 前端 | React 19 + TypeScript 5.9（strict）、Vite 7、Tailwind CSS 3 |
| 路由 | React Router 7（**HashRouter**） |
| 動畫 | framer-motion |
| PWA | vite-plugin-pwa（Workbox） |
| 後端 | Hono，跑在 Cloudflare Workers |
| 資料庫 | Cloudflare D1 |
| 登入 | Cloudflare Access（Google） |
| 測試 | Vitest + React Testing Library、Vitest in workerd（`@cloudflare/vitest-plugin`）、Playwright |
| 套件管理 | pnpm 10 workspace（版本由 proto 釘選） |

## 開始開發

Node 與 pnpm 版本已在 `.prototools` 釘選（node 22.22.0 / pnpm 10.28.0）。若使用 [proto](https://moonrepo.dev/proto)：

```bash
proto install     # 依 .prototools 安裝對應版本
pnpm install
```

未使用 proto 也可以，根目錄 `package.json` 的 `packageManager` 欄位會讓 corepack 對上同一個 pnpm 版本。

第一次在本機跑 API 前，先建立本機 D1 並匯入範例行程：

```bash
pnpm -F @travel-pocket/api db:migrate:local
pnpm -F @travel-pocket/api db:seed --owner dev@example.com
pnpm dev          # http://localhost:5173/
```

本機沒有 Cloudflare Access，API 會把打到 localhost 的請求當成 `dev@example.com` 登入。

### 三種 dev 指令

| 指令 | 內容 | 資料來源 | 可編輯 |
|---|---|---|---|
| `pnpm dev` | 前端 + API | 本機 API（Vite 把 `/api` 轉給 wrangler），API 停掉時退回範例 JSON | 是，寫進本機 D1 |
| `pnpm dev:web` | 只有前端 | `packages/data` 的範例 JSON | 否 |
| `pnpm dev:api` | 只有 API（wrangler dev，:8787） | 本機 D1 | — |

### 其他指令

以下指令都在 repo 根目錄執行，`build`、`lint`、`test` 會跑過每個 workspace：

```bash
pnpm build          # 型別檢查 + 前端 production build（apps/web/dist/）
pnpm lint           # ESLint
pnpm test           # 單元測試（前端 Vitest、API 在 workerd 裡跑的 Vitest）
pnpm test:e2e       # 前端 Playwright E2E（自動啟動 dev:web）
pnpm preview        # 在本機預覽前端 production build
```

各 app 的完整指令見 [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md) 與 [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md)。

## 專案結構

pnpm workspace monorepo。`apps/*` 是各自獨立開發、測試、部署的應用程式，只透過 `packages/*` 共用程式碼，彼此之間只透過 HTTP API 溝通（規則見 [`CLAUDE.md`](CLAUDE.md) 的 Isolation Rules）。

```
├── .github/workflows/
│   ├── deploy.yml         # 前端：測試、build、部署到 Cloudflare
│   └── deploy-api.yml     # API：測試、套用 D1 migrations、部署到 Cloudflare
├── apps/
│   ├── web/               # 前端 PWA（@travel-pocket/web）
│   │   ├── src/           # React app；資料一律經過 src/dataSource.ts
│   │   ├── worker/        # 正式環境的 Worker：把 /api/* 轉給 API
│   │   ├── e2e/           # Playwright E2E
│   │   └── wrangler.jsonc
│   └── api/               # 後端 API（@travel-pocket/api，Hono + D1）
│       ├── src/           # 路由、身分驗證、資料存取
│       ├── migrations/    # D1 schema
│       ├── scripts/seed.ts
│       └── wrangler.jsonc
└── packages/
    ├── shared/            # 共用型別與 API 契約（@travel-pocket/shared）
    └── data/              # 範例行程 JSON（@travel-pocket/data）
```

## 路由

使用 **HashRouter**：所有路由都由同一份 `index.html` 處理，static assets 不需要額外的 fallback 設定。

| 路由 | 頁面 |
|---|---|
| `/#/` | 旅程清單（首頁） |
| `/#/trip/{tripId}/schedule` | 行程表（`/trip/{tripId}` 會自動導向這裡） |
| `/#/trip/{tripId}/shops` | 店鋪 |
| `/#/trip/{tripId}/info` | 資訊 |

## 資料

- 每個使用者的行程存在 D1，API 只回傳登入者自己的資料。型別定義見 [`packages/shared/src/types.ts`](packages/shared/src/types.ts)，API 路由見 [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md)。
- 新旅程在 app 裡建立（首頁 → 新增旅程），旅程 ID 由伺服器產生。
- `packages/data/` 是範例資料：`pnpm dev:web` 直接讀它，`db:seed --owner <email>` 把它匯入指定帳號。正式版不會附帶這些 JSON。

### 資料格式

```jsonc
// trips.json — Trip[]
{
  "id": "sendai-2026",
  "name": "仙台",
  "startDate": "2026-03-14",
  "endDate": "2026-03-21",
  "coverImage": "/data/sendai-2026/snapshot.jpg"   // 封面圖 URL，"" 表示沒有；在 app 裡上傳的會是 /api/trips/{id}/cover?v=…
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

## 測試

| 範圍 | 工具 | 位置 |
|---|---|---|
| 前端單元 / 元件 | Vitest + React Testing Library + jsdom | `apps/web/src/**/*.test.tsx`、`apps/web/worker/*.test.ts` |
| API | Vitest，在 workerd 裡對本機 D1 執行 | `apps/api/test/` |
| E2E | Playwright（僅 Chromium） | `apps/web/e2e/*.spec.ts` |

E2E 針對 `http://localhost:5173/` 的 `dev:web`（範例 JSON、唯讀）執行，不需要 API。

## 部署

全部部署在 Cloudflare：

- **`travel-pocket`**（`apps/web`）— 提供前端的 static assets；只有 `/api/*` 會進到 `worker/index.ts`，經 service binding 轉給 API。網址是 https://travel-pocket.travel-pocket-web.workers.dev，由 Cloudflare Access 保護，要用 Google 帳號登入才進得去。
- **`travel-pocket-api`**（`apps/api`）— 沒有自己的公開網址，只能經由前端的 service binding 存取；它驗證 Access 帶來的 JWT，資料存在 D1。

推送到 `master` 時，兩個 workflow 依路徑各自觸發：[`deploy.yml`](.github/workflows/deploy.yml)（前端）與 [`deploy-api.yml`](.github/workflows/deploy-api.yml)（API，先套用 D1 migrations 再部署）。兩者都需要 repo secrets `CLOUDFLARE_API_TOKEN` 與 `CLOUDFLARE_ACCOUNT_ID`。

### 第一次部署

1. `wrangler login`，再用 `wrangler d1 create travel-pocket` 建立資料庫，把 `database_id` 填進 `apps/api/wrangler.jsonc`。
2. `pnpm -F @travel-pocket/api db:migrate:remote`，接著 `pnpm -F @travel-pocket/api run deploy`。
3. `pnpm -F @travel-pocket/web run deploy`（API 要先部署，service binding 才找得到它）。
4. 在 Zero Trust 的 Integrations → Identity providers 加入 Google，並建立一個允許任何以 Google 登入者的 reusable policy。到 Workers & Pages → `travel-pocket` → **Access** 分頁，選 Protect this Worker behind Access（All traffic）並套用這個 policy。再到 Access 應用程式把登入方式只留 Google、**關閉 instant authentication**（讓使用者在登入頁自己按 Google），最後在 Settings → Admin controls 設定 seat expiration（免費方案 50 個名額）。
5. 把 Zero Trust 的團隊網域與 Access 應用程式的 AUD 填進 `apps/api/wrangler.jsonc` 的 `ACCESS_TEAM_DOMAIN`、`ACCESS_AUD`，重新部署 API。
6. 用 `pnpm -F @travel-pocket/api db:seed --owner <你的 email> --remote` 匯入現有行程。

### 建置注意事項

- TypeScript strict 模式開啟，含 `noUnusedLocals`、`noUnusedParameters`。
- 版面為 mobile-first，主容器上限 `max-width: 480px`。
- API 的 GET 回應採 NetworkFirst 快取（7 天）；離線時的快取資料一律唯讀，登出時會清除。
