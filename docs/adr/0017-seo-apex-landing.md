# ADR 0017：平台形象頁搬到主網域與 SEO 基本設定

- **狀態**：已採納
- **日期**：2026-11-08
- **決策者**：Sunkuo
- **前提**：[ADR 0013 自助申請試用](0013-trial-signup.md)、[ADR 0002 平台管理後台](0002-platform-console.md)

## 背景

平台改名為「Bookdex 預約簿」，正式網域 `bookdex.cc`。形象頁原本放在 `platform.bookdex.cc/`，主網域本身沒有內容：

- 品牌搜尋、別人分享或連結時最自然的網址是 `bookdex.cc`，外部連結的權重應該集中在這裡。
- `platform.` 聽起來是後台，不像產品首頁；同一個網址又是平台管理後台，robots 要一邊開放、一邊擋。
- 形象頁缺少結構化資料、分享預覽圖、網站圖示；HTML 一律 `no-store`，Cloudflare 與瀏覽器都無法快取；服務條款頁的 canonical 指到首頁。

## 決策

### 網址

| 網址 | 內容 |
|---|---|
| `bookdex.cc` | 平台形象頁、申請試用、服務條款（給搜尋引擎） |
| `www.bookdex.cc` | 301 到 `bookdex.cc`（nginx） |
| `platform.bookdex.cc` | 只剩平台管理後台，從 `/login` 進入；首頁與形象頁網址 301 轉到主網域，robots 全部擋掉 |
| `<店家>.bookdex.cc` | 不變 |

- 以設定 `LANDING_ON_APEX` 切換，正式環境開啟。本機開發維持在 `platform.localhost`，因為本機的 `localhost` 是預設健身房（`DEFAULT_TENANT`）。
- 舊網址的轉址保留路徑與查詢字串；申請表單 `POST /site/signup` 用 307，舊頁面送出的申請照樣成立。
- 申請表單的店家網址即時檢查改走 `GET /site/check-subdomain`（形象頁同網址），主網域不需要開放 `/api/`，也不用處理跨網域。
- 主網域上除了形象頁需要的路徑（`/`、`/site/*`、`robots.txt`、`sitemap.xml`），其他路徑由 nginx 302 回首頁，避免主網域載入店家前台的 SPA。
- Cloudflare 需要多一筆 `@` 的 A 紀錄（已代理）。原始伺服器憑證本來就涵蓋 `bookdex.cc` 與 `*.bookdex.cc`。

### SEO 基本設定

- `<title>`、description 帶入「線上預約系統」等搜尋用詞；各頁有自己的 canonical 與 description。
- Open Graph 與 Twitter 分享資料，附 1200×630 分享圖。
- favicon（SVG＋32px PNG）、apple-touch-icon；店家前台 SPA 也改用同一個圖示，不再是 Vite 預設圖。
- JSON-LD：Organization、WebSite、SoftwareApplication（免費試用的 Offer）、FAQPage。常見問題只有一份資料（`platform_site.FAQS`），頁面與結構化資料共用。Google 自 2023 年起只對政府、醫療網站顯示 FAQ 擴充結果，所以 FAQPage 主要是給其他搜尋引擎與 AI 搜尋讀取。
- 沒有表單內容的形象頁 `Cache-Control: public, max-age=300`；表單錯誤頁維持 `no-store`。
- sitemap 加 `lastmod`（形象頁設定的最後修改日）。

### 網站分析（Google 代碼管理工具）

- 設定 `GTM_ID`（正式環境預設 `GTM-P57ZQDMK`），**只放在平台形象頁**：首頁、服務條款、申請完成頁。
- 不放在店家形象網站、店家後台、會員與教練前台：那些頁面有店家顧客的姓名、電話等個資，平台的追蹤碼不該蒐集；店家若要自己的分析，之後另做「店家自己的 GA」設定。
- 用 GTM 官方的安裝碼（`gtm.start` 事件＋`<noscript>` iframe）。ID 由後端驗證格式後才寫進頁面。
- 申請完成頁送出 `sign_up` 事件（只帶行業類型），可在 GA4 設為轉換。
- 服務條款在啟用時加上「網站使用分析」說明。

## 不做的（之後再說）

- 行業頁、功能頁、價格頁、文章：需要實際內容，之後一頁一頁加，都放在主網域。
- 店家形象網站頁尾的「由 Bookdex 預約簿 提供」連結。
- Cloudflare 的 HTML 快取規則：預設不快取 HTML，要在 Cloudflare 另外設定 Cache Rule 才會在邊緣快取；目前瀏覽器快取已經夠用。

## 影響

- 平台管理員的書籤若是 `platform.bookdex.cc/`，會被轉到形象頁；後台請用 `platform.bookdex.cc/login`。
- 測試：`tests/test_landing_seo.py`。
