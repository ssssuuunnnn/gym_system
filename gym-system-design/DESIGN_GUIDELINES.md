# PulseFit → 健身房管理系統 設計規範 (Design Guidelines)

**狀態**：規範文件（spec-only）。本文件僅定義視覺 token 與元件對應規則，**尚未套用到 `frontend/`**，實作時再由開發者依本文件改動 `frontend/src/main.tsx` / `App.tsx` 及相關元件。

**來源**：`gym-system-design/project/` 是從 Claude Design 匯出的設計交付包（無真實品牌資產、無 Figma、無既有前端可參考），視覺語言模仿 [Ant Design Pro Analysis Dashboard](https://preview.pro.ant.design/dashboard/analysis)，數值即 **Ant Design 5 官方預設 design token**。本規範將這些 token 對照到本專案實際使用的 **antd 6.5.3**（見第 0 節）並給出 `ConfigProvider theme.token` 的落地方式。

---

## 0. 與現有前端的落差核對（實作前必讀）

檢查 `frontend/src/` 後確認：

| 項目 | 現況 | 結論 |
|---|---|---|
| antd 版本 | `6.5.3`（非設計包假設的 5.x） | `theme.token` API 在 antd 6 完全相容；`colorPrimary` 預設值本來就是 `#1677ff`，與設計包主色相同，但**不可省略** `ConfigProvider theme` 設定，因為其餘 token（radius、shadow、layout 尺寸等）在 antd 6 預設值不一定與本規範一致，須顯式覆寫，不可依賴預設值恰好相符。 |
| `ConfigProvider` | `frontend/src/App.tsx` 目前只傳了 `locale={zhTW}`，**無 `theme` prop** | 全新加入，見第 1 節範例 |
| 全域 CSS | `frontend/src/index.css` 只有 `html,body,#root{height:100%;margin:0}`，**沒有任何字體/顏色覆寫** | 字體堆疊完全吃 antd 6 內建預設；如需生效請走 `theme.token.fontFamily`（見第 2 節），不要另外寫 CSS 覆寫字體，避免雙重來源 |
| 圖示庫 | 專案完全沒有圖示（`grep` 全 repo 無 icon 相關 import），但 `@ant-design/icons@6.3.2` **已存在** `node_modules`（antd 自身的 transitive dependency，尚未列在 `frontend/package.json` 的 `dependencies` 中） | 見第 9 節建議 |
| 現有元件 | `components/AppLayout.tsx`、`SlotPicker.tsx`、`StatusTag.tsx` | 之後套用本規範時，`AppLayout` 是 header/sider 版面度量與毛玻璃效果的落地點；`StatusTag` 是語意色 Tag 的落地點 |

---

## 1. 色彩 Color

### 1.1 色階（10-step tint/shade，來自 `tokens/colors.css`）

| Step | Blue（主色） | Green（成功） | Gold（警告） | Red（錯誤） | Gray（中性） |
|---|---|---|---|---|---|
| 1 | `#e6f4ff` | `#f6ffed` | `#fffbe6` | `#fff1f0` | `#ffffff` |
| 2 | `#bae0ff` | `#d9f7be` | `#fff1b8` | `#ffccc7` | `#fafafa` |
| 3 | `#91caff` | `#b7eb8f` | `#ffe58f` | `#ffa39e` | `#f5f5f5` |
| 4 | `#69b1ff` | `#95de64` | `#ffd666` | `#ff7875` | `#f0f0f0` |
| 5 | `#4096ff` | `#73d13d` | `#ffc53d` | `#ff4d4f` | `#d9d9d9` |
| 6（基準） | **`#1677ff`** | **`#52c41a`** | **`#faad14`** | `#f5222d` | `#bfbfbf` |
| 7 | `#0958d9` | `#389e0d` | `#d48806` | `#cf1322` | `#8c8c8c` |
| 8 | `#003eb3` | `#237804` | `#ad6800` | `#a8071a` | `#595959` |
| 9 | `#002c8c` | `#135200` | `#874d00` | `#820014` | `#434343` |
| 10 | `#001d66` | `#092b00` | `#613400` | `#5c0011` | `#262626` |
| 11 | — | — | — | — | `#1f1f1f` |
| 12 | — | — | — | — | `#141414` |

錯誤色的基準取 **red-5** (`#ff4d4f`) 而非 red-6，其餘語意色取 step 6 — 這是 Ant Design 官方預設的取法，照抄。

### 1.2 語意色組合

| 用途 | 主色 | 淺底 | 邊框 |
|---|---|---|---|
| Primary | `#1677ff` | `#e6f4ff` (blue-1) | `#91caff` (blue-3) |
| Success | `#52c41a` | `#f6ffed` (green-1) | `#b7eb8f` (green-3) |
| Warning | `#faad14` | `#fffbe6` (gold-1) | `#ffe58f` (gold-3) |
| Error | `#ff4d4f` | `#fff1f0` (red-1) | `#ffa39e` (red-3) |
| Link | `#1677ff`（同 primary），hover `#4096ff` (blue-5) | — | — |

Hover/Active 一律取相鄰一階：hover = 淺一階（blue-5），active = 深一階（blue-7）。error 只定義 hover（red-4），無 active。

### 1.3 中性文字 — alpha-black，非固定灰階

| Token | 值 | 用途 |
|---|---|---|
| `--text-primary` | `rgba(0,0,0,.88)` | 標題、正文主要文字 |
| `--text-secondary` | `rgba(0,0,0,.65)` | 次要說明文字、表格內容 |
| `--text-tertiary` | `rgba(0,0,0,.45)` | 佔位文字、禁用文字、輔助說明 |
| `--text-quaternary` | `rgba(0,0,0,.25)` | 極弱提示（如禁用圖示） |
| `--text-inverse` | `#ffffff` | 深色/主色底上的文字 |

用 alpha-black 而非固定灰的原因：文字疊在任何淺色底（白／`--bg-layout`／`--fill-*`）上都能維持正確對比，不必為每種底色分別配色。

### 1.4 邊框色

| Token | 值 | 用途 |
|---|---|---|
| `--border-color` | `#d9d9d9` (gray-5) | Input、Card、可互動元件的主邊框 |
| `--border-secondary` | `#f0f0f0` (gray-4) | 內部分隔線（Table 列分隔、Card header 分隔線） |

### 1.5 背景分層（Layout vs Container vs Elevated）

| Token | 值 | 用途 |
|---|---|---|
| `--bg-layout` | `#f5f5f5` (gray-3) | 最底層：內容區背景（Layout.Content 的底色） |
| `--bg-container` | `#ffffff` | 中層：Card、Table、表單容器 |
| `--bg-elevated` | `#ffffff` | 上層：Modal、Dropdown、Popover |
| `--bg-mask` | `rgba(0,0,0,.45)` | Modal 遮罩 |
| `--bg-spotlight` | `rgba(0,0,0,.85)` | 高對比提示底（如 Tooltip 深底變體，目前未使用） |
| `--fill-primary/-secondary/-tertiary` | `rgba(0,0,0,.06/.04/.03)` | 無邊框互動元件的填色（如 ghost/text 按鈕 hover、禁用底） |
| `--sider-bg` / `--header-bg` | `#ffffff` | Sider／Header 底色（未捲動狀態） |

### 1.6 對應 antd `ConfigProvider theme.token`

在 `frontend/src/App.tsx` 的 `ConfigProvider` 加上 `theme` prop（僅列本規範會用到的 key；未列出的沿用 antd 6 預設）：

```tsx
<ConfigProvider
  locale={zhTW}
  theme={{
    token: {
      // 色彩
      colorPrimary: '#1677ff',
      colorSuccess: '#52c41a',
      colorWarning: '#faad14',
      colorError: '#ff4d4f',
      colorLink: '#1677ff',
      colorTextBase: '#000000',      // antd 會自動衍生 colorText/colorTextSecondary/... 的 alpha 階梯
      colorBgLayout: '#f5f5f5',
      colorBgContainer: '#ffffff',
      colorBgElevated: '#ffffff',
      colorBorder: '#d9d9d9',
      colorBorderSecondary: '#f0f0f0',
      // 字體
      fontFamily:
        `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
      fontSize: 14,
      // 圓角
      borderRadius: 6,      // 對應 --radius-base，Button/Input/Card 預設值
      borderRadiusSM: 4,    // 對應 --radius-sm，小尺寸元件（Tag、小 Button）
      borderRadiusLG: 8,    // 對應 --radius-lg，Card、Modal
      // 陰影（僅供元件層級 token 覆寫參考，見第 5 節）
    },
  }}
>
```

- `colorTextBase: '#000000'` 讓 antd 依內建演算法自動產生 `colorText`(.88) / `colorTextSecondary`(.65) / `colorTextTertiary`(.45) / `colorTextQuaternary`(.25)，**不需要**手動逐一設定這四個 alpha 階，設對 `colorTextBase` 即可對齊本規範 1.3 節。
- `colorBgLayout` / `colorBgContainer` / `colorBgElevated` 三者分層對應第 1.5 節，這是本專案目前完全沒有設定的部分（現況只用 antd 全預設）。
- 語意色的淺底/邊框（如 `colorSuccessBg`、`colorSuccessBorder`）antd 會依 `colorSuccess` 自動衍生，一般不需手動指定；若視覺對不上表格中列出的確切色號，才需要在 `token` 中明確覆寫 `colorSuccessBg: '#f6ffed'` 等。

---

## 2. 字體 Typography

### 2.1 字體堆疊

```
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC",
"Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, "Noto Sans", sans-serif
```

無自訂 webfont，繁中裝置走 macOS 的「蘋方-繁」（PingFang SC 字族在 macOS 會回退為對應的繁體字重）、Windows 走「微軟正黑體」。**這是 antd 6 的內建預設字體堆疊**，本專案目前未覆寫，理論上不設定也會吃到相同結果 —— 但仍建議在 `theme.token.fontFamily` 顯式寫死（如上），避免未來 antd 版本升級改變預設值時無聲跑版。

### 2.2 字級（px）

| Token | 值 | 用途 |
|---|---|---|
| `font-size-sm` | 12px | 輔助文字、表格次要欄、Tag 文字 |
| `font-size-base` | 14px | 正文預設（body、按鈕、表單） |
| `font-size-lg` | 16px | 強調正文、卡片標題（=H5） |
| `font-size-xl` | 20px | （=H4） |
| `font-size-h3` | 24px | 區塊大標 |
| `font-size-h2` | 30px | 頁面級大標 |
| `font-size-h1` | 38px | 極少用，最高層標題 |

### 2.3 行高 / 字重

| Token | 值 |
|---|---|
| `line-height-base` | 1.5714…（22px @ 14px） |
| `line-height-sm` | 1.6667…（20px @ 12px） |
| `line-height-lg` | 1.5（24px @ 16px） |
| `font-weight-regular` | 400（本文） |
| `font-weight-medium` | 500（選中狀態、次強調，如 Menu 選中項） |
| `font-weight-semibold` | 600（標題、Statistic 數值） |

單一字族、三個字重，不使用 300/700/800 等其他字重。

---

## 3. 間距 Spacing

4px 基準的等差數列，`tokens/spacing.css`：

| Token | 值 | 典型用途 |
|---|---|---|
| `space-xxs` | 4px | 圖示與文字間距、Tag 內距上下 |
| `space-xs` | 8px | 按鈕內距上下、表單項目間距（緊湊） |
| `space-sm` | 12px | Table 儲存格內距（垂直）、Card 內元素間距 |
| `space-md` | 16px | Table 儲存格內距（水平）、表單項目標準間距 |
| `space-lg` | 24px | Card 內距、Layout content padding、區塊間距 |
| `space-xl` | 32px | 頁面級區塊分隔 |
| `space-xxl` | 48px | 極少用，如空狀態的上下留白 |

`margin-*` 與 `space-*` 數值相同（antd 對 padding token 與 margin token 是分開的兩組 key，但取值一致），對應 `Card.styles.body.padding`、`Form.itemMarginBottom` 等元件層級 token 時可直接沿用同一組數字。

---

## 4. 圓角 Radius

| Token | 值 | 用途 |
|---|---|---|
| `radius-xs` | 2px | 極小元素（Badge dot 邊、Progress 細節），少用 |
| `radius-sm` | 4px | Tag、小尺寸 Button/Input（antd `size="small"`） |
| `radius-base` | 6px | **預設值**：Button、Input、Select、Card 內元件 |
| `radius-lg` | 8px | Card 外框、Modal、Dropdown 面板 |
| `radius-round` | 100px | 膠囊形（Tag `round`、部分 Badge、搜尋框圓角變體） |
| `radius-circle` | 50% | Avatar、圓形 Button |

對應 antd token：`borderRadius: 6`（base）、`borderRadiusSM: 4`、`borderRadiusLG: 8`。這三個是 antd 主題演算法會拿去派生其餘元件圓角的種子值，一般不需要逐元件覆寫。

---

## 5. 陰影 Shadow

| Token | 值 | 何時使用 |
|---|---|---|
| `--shadow-1` | `0 1px 2px rgba(0,0,0,.03), 0 1px 6px -1px rgba(0,0,0,.02), 0 2px 4px rgba(0,0,0,.02)` | 目前設計包定義但**未在任何元件上使用**（Card 靜止態是 0 陰影 + 邊框，見第 7 節）；保留給未來需要「靜止態就有陰影」的獨立元件（如浮動操作按鈕） |
| `--shadow-2` | `0 6px 16px rgba(0,0,0,.08), 0 3px 6px -4px rgba(0,0,0,.12), 0 9px 28px 8px rgba(0,0,0,.05)` | Modal、Dropdown、Popover、Select 下拉面板等「彈出層」——對應 antd `boxShadowSecondary` |
| `--shadow-header` | `0 1px 4px rgba(0,21,41,.08)` | **僅** Header 在捲動後出現（見第 7.3 節），靜止時 Header 無陰影 |
| `--shadow-card-hover` | `0 2px 8px rgba(0,0,0,.09)` | Card 設為 `hoverable` 時，滑鼠懸停才出現；靜止態維持 0 陰影 |

對應 antd token：`boxShadow`（一般元素陰影，對應不到就用 `--shadow-1`）、`boxShadowSecondary`（彈出層，對應 `--shadow-2`）。Header 陰影與 Card hover 陰影是本規範獨有數值，antd 沒有對應的全域 token，需在對應元件（自訂 Header 容器、`Card` 的 CSS-in-JS class 或 `hoverable` 樣式）中手動套用，見第 10 節元件清單備註。

---

## 6. 版面度量 Layout metrics

| 項目 | 值 |
|---|---|
| Header 高度 | **64px** |
| Sider 展開寬度 | **208px** |
| Sider 收合寬度 | **56px** |
| Sider 展開/收合過渡 | `width .2s`（ease，瀏覽器預設 timing） |
| Content padding | **24px**（四邊皆同，`space-lg`） |
| Content 上方預留（避免被 fixed Header 蓋住） | `calc(64px + 24px)` = 88px（見 `DashboardLayout.jsx` 第 27 行的 `padding-top` 算法） |

Header 為 `position: fixed`／`absolute` 疊在內容區之上（`z-index: 10`），因此 Content 容器需要用上述 88px 的 padding-top 讓內容不被蓋住，而非把 Header 排進正常流。

### 6.1 Sider 品牌區塊與收合切換按鈕（來自 `DashboardLayout.jsx`）

| 元素 | 規格 |
|---|---|
| 品牌區塊高度 | 64px（與 Header 對齊同一水平線），展開時左內距 20px，收合時置中 |
| 品牌 Logo 方塊 | 28×28px，圓角 `--radius-sm`(4px)，底色 `--color-primary`，白字 |
| 收合切換按鈕 | 固定於 Sider **最底部**；高度 44px；`border-top: 1px solid --border-secondary`；置中對齊；點擊整列可點 |
| 切換按鈕圖示 | 展開時 fold 圖示、收合時 unfold 圖示（原型用 `ri-menu-fold-line` / `ri-menu-unfold-line`，對應 antd 圖示見第 9 節） |
| 切換按鈕圖示顏色 | `--text-tertiary`（未 hover 時），字級 16px |

此為使用者主動點擊觸發的收合（非僅視窗寬度斷點自動收合），Sider 寬度切換沿用第 6 節 208px/56px 與 `.2s` 過渡。

---

## 7. 邊框、卡片、透明/毛玻璃

### 7.1 邊框

- Input／Select／Card 等元件邊框：**1px solid `#d9d9d9`**（`--border-color`）
- Table 列分隔線、Card 內部分隔（如 Card header 下緣）：**1px solid `#f0f0f0`**（`--border-secondary`）
- 不使用漸層邊框、雙層邊框或超過 1px 的邊框寬度

### 7.2 卡片 Cards

| 狀態 | 樣式 |
|---|---|
| 靜止 | 白底 `#ffffff`；圓角 **8px**（`--radius-lg`）；邊框 1px solid `#f0f0f0`；**無陰影** |
| Hover（僅 `hoverable` 卡片） | 陰影變為 `--shadow-card-hover`（`0 2px 8px rgba(0,0,0,.09)`）；邊框、圓角不變；`transition: box-shadow .2s` |

即卡片的層次感來自「邊框 + hover 陰影」而非「靜止陰影」，這點要注意不要把 `--shadow-1` 套到 Card 靜止態上（設計包本身也只定義未使用）。

### 7.3 透明 / 毛玻璃（Header scroll 效果 —— 數值需與另一個平行工作項對齊）

此效果只出現在 **Header**，UI 包中其餘元件（含 Card、Modal）皆為不透明。Modal 遮罩的半透明黑（`rgba(0,0,0,.45)`）不算毛玻璃，是純色遮罩。

**觸發條件**：內容區 `scrollTop > 4px` 時觸發（見 `DashboardLayout.jsx:27`，`onScroll` 監聽 content 容器，非 `window`）。

| 狀態 | 背景 | backdrop-filter | 陰影 | 下邊框 |
|---|---|---|---|---|
| 未捲動（`scrollTop ≤ 4`） | `#ffffff`（`--header-bg`，不透明） | 無 | 無 | `1px solid transparent` |
| 已捲動（`scrollTop > 4`） | `rgba(255,255,255,.45)` | `blur(18px) saturate(180%)`（需同時加 `-webkit-backdrop-filter` 以相容 Safari） | `--shadow-header` = `0 1px 4px rgba(0,21,41,.08)` | `1px solid rgba(255,255,255,.3)` |
| 狀態切換過渡 | — | — | `transition: background .25s, box-shadow .25s`（**注意**：`backdrop-filter` 本身在原型中沒有加進 transition list，是瞬時切換，只有背景色和陰影漸變） | — |

以上數值需與負責「Header 毛玻璃」平行工作項的規格完全一致（模糊半徑 18px、飽和度 180%、背景 alpha .45、觸發閾值 scrollTop 4px），若該工作項有不同數字，以最終決議為準並回頭同步本節。

---

## 8. 動效 Animation

| 對象 | 值 |
|---|---|
| 一般 hover/focus 過渡（Button 顏色、Input 邊框、Card 陰影） | `all .2s` 或針對性屬性 `.2s`，easing 使用瀏覽器預設（未指定 cubic-bezier，即 `ease`） |
| Header 毛玻璃切換 | `.25s`（見 7.3） |
| Sider 展開/收合寬度 | `.2s`（width） |
| Loading 按鈕轉圈 | `@keyframes spin { to { transform: rotate(360deg) } }`，`animation: spin .8s linear infinite` |
| 進場動畫 | **無** — 不使用 fade-in/slide-in 等進場效果 |
| 縮放/彈跳效果 | **無** — 按下 (`active`) 狀態只變色（深一階），不做 `scale()` 效果 |

Hover/press 色階規則：
- Primary Button：hover 淺一階（`--color-primary-hover` = blue-5），按下深一階（`--color-primary-active` = blue-7）
- Default/Dashed Button：hover 時邊框與文字轉為 primary 色
- Ghost/Text Button：hover 時填入 `--fill-tertiary`（`rgba(0,0,0,.03)`）淡底，無邊框變化

---

## 9. 圖示 Iconography — 建議改用 `@ant-design/icons`，理由如下

設計包原始建議是透過 CDN `<link>` 引入 **Remix Icon**（`remixicon.css`），理由是「Ant Design Icons 只能以 npm 套件形式使用，無法用 `<script>` 直接掛」。**此建議不適用於本專案，應改用 `@ant-design/icons`**：

1. **CDN 前提不成立**：本專案是 Vite + React + TS 的 SPA build pipeline，本來就是透過 npm/ESM import 元件，不是「純 HTML 掛 `<script>`」的情境 —— 設計包擔心的限制反而是本專案的常態做法，不是缺點。
2. **已經在相依樹裡**：`frontend/node_modules/@ant-design/icons@6.3.2` 已存在（antd 6.5.3 內部自身依賴它渲染 Modal 關閉鈕、Select 下拉箭頭等），版本已驗證與目前 antd 版本相容；只需把它從 transitive dependency 提升為 `frontend/package.json` 的**直接** `dependencies` 即可使用，不引入新的相容性風險。
3. **視覺一致性**：現有 antd 元件內建圖示（如 Table 排序箭頭、Modal 關閉 X、DatePicker 圖示）本來就是 `@ant-design/icons`，自訂圖示（Menu 圖示、Statistic 趨勢箭頭等）若混用 Remix Icon 的雙線風格會與這些內建圖示風格不一致；用同一套反而更貼近設計包所追求的「視覺上接近 antd 自身圖示美學」的目標。
4. **無 CDN 依賴**：不吃額外的外部網路請求（CDN 掛點失敗、CSP 限制、離線開發環境等問題都不用處理），且 tree-shakeable、有 TS 型別，符合本專案其餘 `api/*.ts` 一貫的型別優先風格。
5. **無 FOUC 風險**：CDN icon font 常見的「文字先顯示、字型稍後載入」閃爍問題，SVG-based 的 `@ant-design/icons` 元件不會有。

**行動項**（供之後實作參考，本次不動 `frontend/`）：於 `frontend/package.json` 加入 `"@ant-design/icons": "^6.3.2"` 為直接依賴。以下是 `DashboardLayout.jsx`／`Statistic.jsx` 原型中實際出現的 Remix Icon class → `@ant-design/icons` 元件對照（其餘頁面若新增圖示需求，比照同一命名習慣延伸）：

| Remix Icon class（原型） | 用途 | 對應 `@ant-design/icons` 元件 |
|---|---|---|
| `ri-dashboard-line` | Menu：儀表板 | `DashboardOutlined` |
| `ri-team-line` | Menu：會員管理 | `TeamOutlined` |
| `ri-calendar-line` | Menu：課程排程 | `CalendarOutlined` |
| `ri-user-star-line` | Menu：教練管理 | `UserSwitchOutlined`（antd 無完全對應的「star user」圖示，取語意最接近者；或用 `IdcardOutlined`，實作時二擇一即可） |
| `ri-bar-chart-2-line` | Menu：財務報表 | `BarChartOutlined` |
| `ri-settings-3-line` | Menu：系統設定 | `SettingOutlined` |
| `ri-search-line` | Header 搜尋框 prefix | `SearchOutlined` |
| `ri-notification-line` | Header 通知鈴鐺 | `BellOutlined` |
| `ri-arrow-down-s-line` | Header 使用者選單下拉箭頭 | `DownOutlined` |
| `ri-menu-fold-line` | Sider 收合按鈕（展開態） | `MenuFoldOutlined` |
| `ri-menu-unfold-line` | Sider 收合按鈕（收合態） | `MenuUnfoldOutlined` |
| `ri-arrow-up-line` | Statistic 正向趨勢 | `ArrowUpOutlined` |
| `ri-arrow-down-line` | Statistic 負向趨勢 | `ArrowDownOutlined` |

---

## 10. 元件清單 Component inventory（19 個）

設計包元件皆為 antd 原生元件的極薄封裝（10~30 行 JSX，純 inline style 讀 CSS variable），**沒有任何元件重寫了 antd 原生的互動邏輯**（無自訂鍵盤導覽、無自訂 focus trap 等）。逐一核對如下：

| # | 元件 | 對應真實 antd 元件 | 落地方式 |
|---|---|---|---|
| 1 | Button | `Button` | 純 token 化（見第 1/4/8 節），loading spin 動效 antd 內建已一致 |
| 2 | Input | `Input` | 純 token 化 |
| 3 | Select | `Select` | 純 token 化；下拉面板陰影對應 `--shadow-2` |
| 4 | Checkbox | `Checkbox` | 純 token 化 |
| 5 | Radio | `Radio` | 純 token 化 |
| 6 | Switch | `Switch` | 純 token 化 |
| 7 | Card | `Card` | 純 token 化，但**靜止態 0 陰影 + hover 陰影**這個組合需確認 antd `hoverable` prop 的預設 hover 陰影值是否等於 `--shadow-card-hover`（`0 2px 8px rgba(0,0,0,.09)`）；若不同須用 `Card` 的 `styles`/`classNames` 或 `.ant-card-hoverable:hover` CSS 覆寫，屬於**輕量客製** |
| 8 | Tag | `Tag` | 純 token 化，語意色（success/warning/error）直接對應第 1.2 節 |
| 9 | Badge | `Badge` | 純 token 化 |
| 10 | Avatar | `Avatar` | 純 token 化 |
| 11 | Statistic | `Statistic` | 純 token 化；trend 上/下箭頭需自行加（antd `Statistic` 沒有內建趨勢箭頭），用 `prefix`/`suffix` slot 搭配第 9 節圖示元件手動組合，屬於**輕量客製** |
| 12 | Progress | `Progress` | 純 token 化 |
| 13 | Table | `Table` | 純 token 化；表頭底色 `--gray-2`(`#fafafa`) 恰好等於 antd Table 表頭預設底色，不需覆寫 |
| 14 | Tabs | `Tabs` | 純 token 化 |
| 15 | Breadcrumb | `Breadcrumb` | 純 token 化 |
| 16 | Menu | `Menu`（Sider 導覽用） | 純 token 化；選中項底色/文字色對應 antd `Menu` 的 `itemSelectedBg`/`itemSelectedColor` 元件級 token，需確認 antd 6 預設的 `itemBorderRadius` 是否等於 `--radius-base`(6px)，不同則在 `theme.components.Menu` 補上，屬於**輕量客製** |
| 17 | Modal | `Modal` | 純 token 化；遮罩 `rgba(0,0,0,.45)` 為 antd 預設值，不需覆寫 |
| 18 | Tooltip | `Tooltip` | 純 token 化 |
| 19 | Alert | `Alert` | 純 token 化 |

**唯一真正超出「純 token 化」範疇的是 Header**（不在上表 19 個元件清單內，因為它屬於版面/layout，不是 antd 元件）：第 7.3 節的捲動毛玻璃效果需要一段 `onScroll` + `useState` 邏輯與 inline style 切換，無法只靠 `ConfigProvider theme.token` 達成，必須寫進 `AppLayout.tsx` 的自訂實作。

---

## 11. 沿用自設計包的待確認事項（Caveats — 不代答，待使用者確認）

以下是設計包本身標註的開放問題，原樣列出，**本文件不代為決定**：

1. **無真實品牌名稱／Logo**：「PulseFit」與「P」字標記皆為佔位內容。若有真實品牌名稱/Logo，需要提供後才能替換 Sider 頂部品牌區塊、favicon 等位置。
2. **無真實中文字型檔**：目前字體堆疊全靠作業系統內建字型（PingFang SC / 微軟正黑體）透過 CSS fallback 生效，**沒有內嵌任何 webfont 檔案**。若有指定的授權中文字型，需要提供字型檔才能套用。
3. **圖表僅為示意 bar chart**：設計包中的圖表不是正式圖表庫產出，之後接上真實數據時需要選定圖表方案（如 `@ant-design/charts` 或其他），本文件不預設選型。
4. **設計包目前只做了一個畫面**（Analysis Dashboard 樣式的儀表板），本專案實際頁面（`CoachList`、`BookingReviewList`、`MemberList` 等既有清單頁，以及尚待實作的表單頁）尚未有對應設計稿，套用本規範時各頁面的版面配置需要開發者依既有頁面結構自行套用 token，而非直接複製 Dashboard 版型。
