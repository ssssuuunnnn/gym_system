# ADR 0003：健身房形象網站

- **狀態**：已採納
- **日期**：2026-10-25
- **決策者**：Sunkuo
- **前提**：[ADR 0001 多租戶](0001-multi-tenancy.md)、[ADR 0002 平台管理後台](0002-platform-console.md)

## 背景

各家健身房需要一個對外的形象網站：介紹、教練、課表、價格、交通，並讓新客人預約體驗課。網站要能被搜尋到、分享到 LINE／FB 時有預覽，而且教練、課表、價格不該另外維護一份。

## 決策

### 1. 網址：子網域首頁

`<subdomain>.<BASE_DOMAIN>/` 就是形象網站；`/login`、`/admin`、`/member`、`/coach` 維持原本的系統。未發布時首頁導向 `/login`（與改版前相同）。平台網址的首頁仍是平台後台。

路由：`frontend/nginx.conf`（正式）與 `vite.config.ts`（開發）把 `/`（平台網址除外）、`/site/*`、`/robots.txt`、`/sitemap.xml` 轉給後端；其餘仍是 SPA。轉給後端的 `Host` 帶連接埠（`$http_host`），讓分享預覽圖等絕對網址正確。

### 2. 由伺服器產生整頁 HTML（SSR）

| 選項 | 結論 |
|---|---|
| 放在現有 React SPA | 不採用：LINE／FB 抓預覽不執行 JavaScript，分享時沒有標題與圖片；搜尋較差；手機首次載入慢 |
| SPA＋伺服器只產生標題資訊 | 不採用：解決分享預覽，但內容仍要等 JavaScript |
| **FastAPI＋Jinja2 產生整頁** | **採用**：網站幾乎沒有互動，內容只在發布時改變；不需另外架服務 |

- 樣板 `app/templates/site/bold.html`、樣式 `app/static/site/site.css`（掛在 `/site/static`），**不需要 JavaScript**：選單與常見問題用 `<details>`，表單一般送出（POST → 303 導回）。
- SEO：`<title>`、description、canonical、Open Graph、JSON-LD（`ExerciseGym`）、`robots.txt`、`sitemap.xml`。快取 `Cache-Control: public, max-age=60`。
- 後台編輯畫面仍是 React；預覽用 iframe 載入 `/site/preview?token=…`，看到的就是伺服器實際產生的頁面。

### 3. 內容：固定段落、一份 JSON

- `websites` 表每家一筆：`draft`（編輯中）與 `published`（線上，空＝未上線）兩份 JSON，格式由 `schemas/website.py` 的 `SiteContent` 定義與驗證。
- 段落：主視覺、關於我們、團體課表、教練團隊、方案價格、環境照片、常見問題、預約體驗課、交通與聯絡。可調順序、可關閉（主視覺、關於我們、交通與聯絡必備）；沒有內容的段落自動隱藏。
- **教練、課表、方案直接讀系統資料**：內容只存教練／商品的 id 與網站用文字；名稱、照片、價格、課堂在顯示時讀取。後台改了，網站就跟著變。課表與會員預約共用 `services/schedule.py`。
- 由上而下段落的三種版型（2026-10-27 起）：活力 `bold`（深色主視覺、粗體大字）、清爽 `airy`（白底留白、圓角照片、柔和陰影）、溫暖 `warm`（米白大地色、襯線標題、拱形照片）。三者共用同一份內容與 HTML 結構（`templates/site/bold.html`），`site.css` 是活力版型，清爽／溫暖再載入 `theme-<key>.css` 只覆寫顏色、字體與形狀，所以切換版型不會遺失內容，新增段落也只要改一份樣板。版型清單在 `schemas/website.py` 的 `SITE_THEMES`（前端 `api/website.ts` 同步一份縮圖用的代表色）。
- 方格 `bento`（2026-10-28 起）是另一套排版（`templates/site/bento.html` ＋ `static/site/bento.css`，以 `site.css` 的按鈕、表單等元件為基礎）：每個段落是一條自己的 4 欄網格（`.band`），段落內的方塊大小不一（主視覺深色大方塊、照片、品牌色的「下一堂團體課」、方案起價、教練照片方塊、方案卡、環境照片、常見問題、表單、聯絡＋地圖）。段落之間照後台順序由上而下，只在段落內補空位，所以視覺順序和閱讀順序一致；平板 2 欄、手機 1 欄。主視覺旁的「下一堂團體課」與「方案起價」只在該段落顯示時出現。
- 所有版型共用 `templates/site/_layout.html`（head、頁首、頁尾、手機底部按鈕）與 `_trial_form.html`、`_contact_info.html`；版型對應的排版在 `SITE_THEMES[...]['template']`。新增段落時兩套排版都要加。
- 品牌色只能從 5 個預設色挑，每個都確認過在三種版型的底色上文字對比 ≥ 4.5:1（原設計稿的橘色白字只有 4.3:1，改深一階；溫暖版型的淺米底色因此調亮到 #F7F0E7）。

### 4. 安全

- **公開欄位白名單**：`routers/site.py` 只把教練的授課名稱、專長、照片、網站自我介紹，以及商品名稱、類別、堂數、價格交給樣板；教練電話、LINE、匯款帳號、鐘點費，課程教練費永遠不會進到樣板（R16）。
- Jinja2 autoescape；內嵌 JSON-LD 的 `</` 跳脫。
- 連結驗證：LINE 只接受 @ID 或 `https://lin.ee`／`line.me`；Instagram 只接受帳號名稱（或 instagram.com 網址，取出帳號）；Facebook 只接受 `https://(www.|m.)facebook.com`／`fb.com`。
- 圖片只能是本站上傳到 `/media/<自己的子網域>/site/` 的 jpg／png（5MB 以內）；存草稿與發布時都會檢查。
- 預覽 token：`scope=site_preview`、30 分鐘、只能看該家的草稿，不能呼叫任何 API。
- 資料表 `websites`、`inquiries`、`inquiry_notes` 都是租戶資料表（RLS）。

### 5. 體驗課詢問

- 公開表單 `POST /site/inquiry`：姓名、手機、LINE ID（選填）、想體驗、方便時段、留言，**必須勾選同意個資告知事項**（存同意時間）。告知事項預設內容依個人資料保護法撰寫，健身房可修改。
- 防垃圾：隱藏欄位（機器人填了就假裝成功、不存）、同一 IP 10 分鐘內最多 3 次（只存 IP 的雜湊）。
- 後台「詢問名單」：狀態 新詢問／聯絡中／已約體驗／已成為會員／未成交；跟進紀錄（第一筆紀錄自動改為聯絡中）；「建立會員帳號」直接建立會員（預設以手機當帳號、下次登入須改密碼），密碼只顯示一次。
- 個資保存：未成為會員者，送出 6 個月後在讀取名單時自動刪除（R18）。

## 影響

- 新 migration `0003_website`；新增依賴 `jinja2`。
- 部署時 nginx 必須用新的 `frontend/nginx.conf`（首頁轉給後端）。
- 已發布網站的健身房，首頁不再直接是登入頁；會員從網站右上角「會員登入」進入（`/login` 不變）。

## 已知限制與後續

- 更多版型、自訂網域（需自動申請 HTTPS 憑證）、收到詢問時的 Email／LINE 通知、瀏覽統計留待後續。
- 地圖使用 Google 地圖嵌入（不需金鑰），會載入 Google 的資源。
- 平台尚不能代為下架某家的網站（停用整家健身房時網站會一起停止）。
- 圖片不做縮圖與壓縮，大圖會影響手機載入速度；之後可在上傳時產生多種尺寸。
