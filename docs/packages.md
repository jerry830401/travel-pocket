# 套件說明文件

本專案使用 pnpm 管理套件，以下依「正式依賴」與「開發依賴」分類介紹所有套件及使用範例。

---

## 正式依賴（dependencies）

### react & react-dom

**版本：** `^19.2.0`

React 是本專案的核心 UI 框架，用於建構元件化介面。`react-dom` 負責將 React 元件渲染至瀏覽器 DOM。

```tsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>點擊次數：{count}</button>;
}
```

---

### react-router-dom

**版本：** `^7.13.0`

處理前端路由，讓 SPA 可以根據 URL 切換不同頁面，無需重新整理。

```tsx
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">首頁</Link>
        <Link to="/trips">行程</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trips/:id" element={<TripView />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

### framer-motion

**版本：** `^12.31.0`

提供宣告式動畫 API，輕鬆為 React 元件加上進場、離場、手勢等動畫效果。

```tsx
import { motion } from "framer-motion";

function Card() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      卡片內容
    </motion.div>
  );
}
```

---

### clsx

**版本：** `^2.1.1`

用於有條件地組合 CSS class 名稱，讓動態 className 的寫法更簡潔易讀。

```tsx
import clsx from "clsx";

function Badge({ active, size }: { active: boolean; size: "sm" | "lg" }) {
  return (
    <span
      className={clsx(
        "rounded-full px-2 py-1",
        active ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600",
        size === "lg" && "text-lg px-4",
      )}
    >
      狀態
    </span>
  );
}
```

---

### date-fns

**版本：** `^4.1.0`

輕量級日期工具庫，提供格式化、計算、比較等純函式操作，支援 Tree-shaking。

```tsx
import { format, differenceInDays, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";

const start = parseISO("2024-10-01");
const end = parseISO("2024-10-07");

format(start, "yyyy年MM月dd日", { locale: zhTW }); // → "2024年10月01日"
differenceInDays(end, start); // → 6
```

---

### lucide-react

**版本：** `^0.563.0`

Lucide 圖示庫的 React 版本，提供數百個一致風格的 SVG 圖示元件。

```tsx
import { MapPin, Calendar, ShoppingBag } from "lucide-react";

function Icons() {
  return (
    <div className="flex gap-2">
      <MapPin size={20} className="text-red-500" />
      <Calendar size={20} className="text-blue-500" />
      <ShoppingBag size={20} className="text-green-500" />
    </div>
  );
}
```

---

## 開發依賴（devDependencies）

### vite

**版本：** `^7.2.4`

下一代前端建置工具，開發環境使用原生 ESM 提供極速 HMR，生產環境使用 Rollup 打包。

```bash
pnpm run dev      # 啟動開發伺服器
pnpm run build    # 建置生產版本
pnpm run preview  # 預覽建置結果
```

---

### @vitejs/plugin-react

**版本：** `^5.1.1`

Vite 的 React 官方外掛，透過 Babel 支援 React Fast Refresh（HMR）與 JSX 轉換。

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
```

---

### vite-plugin-pwa

**版本：** `^1.2.0`

為 Vite 專案自動產生 Service Worker 與 Web App Manifest，讓應用支援 PWA（可安裝、離線瀏覽）。

```ts
// vite.config.ts
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Travel Pocket",
        short_name: "Travel",
        theme_color: "#ffffff",
      },
    }),
  ],
});
```

---

### typescript

**版本：** `~5.9.3`

JavaScript 的靜態型別超集，幫助在編譯期間找出型別錯誤，提升程式碼品質與可維護性。

```ts
interface Trip {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

function getTripDuration(trip: Trip): number {
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
}
```

---

### tailwindcss

**版本：** `^3.4.17`

Utility-First CSS 框架，直接在 HTML/JSX 中使用原子類別組合樣式，不需另外撰寫 CSS 檔案。

```tsx
<div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-md dark:bg-gray-800">
  <img
    className="h-12 w-12 rounded-full object-cover"
    src={avatar}
    alt="avatar"
  />
  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
    使用者名稱
  </p>
</div>
```

---

### @tailwindcss/typography

**版本：** `^0.5.19`

Tailwind 的文字排版外掛，提供 `prose` class 讓 Markdown 渲染或長文內容自動套用美觀的排版樣式。

```tsx
<article className="prose prose-lg dark:prose-invert max-w-none">
  <h1>文章標題</h1>
  <p>文章內文會自動套用合適的字體、間距與顏色。</p>
</article>
```

---

### postcss & autoprefixer

**版本：** `^8.5.6` / `^10.4.24`

PostCSS 是 CSS 後處理器框架，Tailwind 透過它轉換 CSS。Autoprefixer 作為 PostCSS 外掛，自動為 CSS 屬性加上瀏覽器廠商前綴（`-webkit-`、`-moz-` 等）。

```js
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

### eslint、@eslint/js、typescript-eslint

**版本：** `^9.39.1` / `^9.39.1` / `^8.46.4`

ESLint 為 JavaScript/TypeScript 的靜態程式碼分析工具，`@eslint/js` 提供內建規則，`typescript-eslint` 增加 TypeScript 專屬規則支援。

```js
// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
```

---

### eslint-plugin-react-hooks

**版本：** `^7.0.1`

ESLint 外掛，強制執行 React Hooks 的使用規則（如 `rules-of-hooks`、`exhaustive-deps`），避免常見的 Hooks 使用錯誤。

```js
// eslint.config.js 中啟用
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { plugins: { "react-hooks": reactHooks } },
  { rules: reactHooks.configs.recommended.rules },
];
```

---

### eslint-plugin-react-refresh

**版本：** `^0.4.24`

確保 React Fast Refresh（HMR）能正常運作，會警告只匯出元件以外的內容（可能導致 HMR 失效）的情況。

---

### globals

**版本：** `^16.5.0`

提供各環境（browser、node、worker 等）的全域變數清單，供 ESLint 辨識合法的全域變數，避免誤報「未定義變數」錯誤。

```js
import globals from "globals";

export default [
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
];
```

---

### gh-pages

**版本：** `^6.3.0`

自動將指定資料夾（通常為 `dist`）的內容推送至 GitHub 的 `gh-pages` 分支，實現一鍵部署至 GitHub Pages。

```bash
# package.json scripts
"predeploy": "pnpm run build",
"deploy": "gh-pages -d dist"
```

```bash
pnpm run deploy  # 建置後自動部署
```

---

### @types/react、@types/react-dom、@types/node

**版本：**`^19.2.5` / `^19.2.3` / `^24.10.1`

TypeScript 的型別定義檔，讓 TypeScript 能夠正確推導 React API、React DOM API 及 Node.js 內建模組的型別，純開發工具不會打包進產物。

---

## 套件依賴關係總覽

```
Vite ─── @vitejs/plugin-react ─── React
  │
  └── vite-plugin-pwa (PWA 支援)

React ─── react-router-dom (路由)
       ─── framer-motion    (動畫)
       ─── lucide-react     (圖示)
       ─── clsx             (class 合併)
       ─── date-fns         (日期處理)

Tailwind ─── postcss ─── autoprefixer
          └── @tailwindcss/typography

ESLint ─── @eslint/js
        ─── typescript-eslint
        ─── eslint-plugin-react-hooks
        └── eslint-plugin-react-refresh
```
