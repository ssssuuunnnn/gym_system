# ADR 0013：平台形象頁與自助申請試用

- **狀態**：已採納（第一期）
- **日期**：2026-11-01
- **決策者**：Sunkuo
- **前提**：[ADR 0001 多租戶](0001-multi-tenancy.md)、[ADR 0002 平台管理後台](0002-platform-console.md)、[ADR 0003 形象網站](0003-gym-website.md)、[ADR 0011 行業類型](0011-business-type.md)

## 背景

到目前為止，新店家只能由平台管理員在後台手動開通。我們需要一個對外的平台形象頁：介紹系統，並讓有興趣的店家**填完必填欄位就馬上開通 30 天試用**，不必等人工處理。

需要決定：形象頁放在哪裡、試用到期後怎麼辦、開通後要不要放範例資料、形象頁上的聯絡方式怎麼管理。

## 決策

### 1. 形象頁放在平台網址的首頁

- `platform.<主網域>/` 由後端以 Jinja2 產生（`routers/platform_site.py`、`templates/platform/`、`static/site/platform.css`），和店家形象網站一樣不靠 JavaScript；店家網址的即時檢查是加分（`GET /api/v1/platform/public/check-subdomain`，不需登入）。
- 平台管理後台改從 `/login`（登入後 `/tenants`）進入。nginx 的 `location = /` 與 vite 的 `^/$` 不再為平台網址轉回 SPA，一律交給後端；`routers/site.home` 在平台網址改呈現形象頁。
- 其他頁面：`POST /site/signup`（成功 303 到完成頁，失敗 400 重新顯示表單、保留已填的值但不回填密碼）、`/site/signup/done?s=<子網域>`（只顯示一小時內自助申請的店家）、`/site/terms`（服務條款與個資告知）。都放在 `/site/` 下，nginx/vite 不必再加規則。robots／sitemap 在平台網址只列 `/` 與 `/site/terms`。

### 2. 申請即開通（平台帳號的交易）

- `services/trial.signup` 在平台帳號（`fitness_platform`）的同一個交易裡：檢查 → `create_tenant`（狀態試用、`trial_ends_at` = 現在 + 30 天、`signup_source = "self"`）→ `create_tenant_admin`（第一位管理員＝主要管理者，`display_name` 為聯絡人）→ `trial_signups` 申請紀錄 → 操作紀錄「自助申請試用」。共用 `services/tenants.py` 的子網域規則與密碼長度。
- 防濫用：同一支手機／Email 只能試用一次（比對 `trial_signups`）、同一個 IP（只存加鹽雜湊）一天最多 3 次、隱藏欄位 `website` 抓機器人（假裝成功）。
- 平台可在「形象頁設定」暫停開放申請。

### 3. 試用到期：方案 A — 整個店家網址暫停，資料保留

考慮過三種：A 全部暫停；B 只鎖後台、會員還能預約；C 自動降級成免費版。選 **A**：最單純、店家最有動機聯絡我們，也不會出現「會員還在預約但店家看不到」的狀況。

- `TenantInfo.trial_ends_at`（只有試用中的店家才有）跟著 30 秒的租戶快取；`deps.get_tenant` 在停用檢查之後，若 `trial_expired(...)` 且不是 `/api/v1/tenant/profile`，回 403 `試用已到期`。所以後台、會員、教練、LIFF、LINE webhook 全部擋下，形象網站顯示「暫停服務」。
- `/tenant/profile` 多回 `trial {ends_at, days_left, expired, contact}`。平台的聯絡方式放在平台資料表，店家的應用程式帳號讀不到，所以用 `SECURITY DEFINER` 函式 `platform_public_contact()`（只回品牌名稱與「設定為顯示」的欄位）。
- 前端：`components/trial/TrialGate` 包住店家的 router，到期就整頁顯示「試用已到期，請聯絡我們」；`api/client.ts` 收到 403「試用已到期」會發事件讓它重新讀取。後台頁首 `TrialHeaderTag` 顯示「試用剩 N 天」。
- 背景工作（ADR 0004 店家通知、ADR 0005 會員推播與上課提醒）用 `trial.running_tenant_ids` 跳過到期的店家。
- 資料保留 60 天（寫在服務條款與常見問題）。第一期**不自動刪除**，由平台人工處理。
- 平台延長試用：`POST /platform/tenants/{id}/trial {days}`，從今天或原到期日（較晚者）起加天數；轉為正式就是把狀態設為「啟用」，到期日不再有作用。

### 4. 開通後自動建立範例資料

空的後台很難體會系統能做什麼。開通並 commit 後，`trial.seed_sample_data` 以**該店的應用程式帳號**（受 RLS、`tenant_session`）建立：系統設定的店名、2 位服務人員（綁定無法登入的 `sample-staffN` 帳號）、幾個方案與用品、健身另有一門團體課（每週二、四 19:00，8 週）與其方案、形象網站草稿（團隊與價目段落）。依行業類型換內容。失敗只記錄，不影響已開通的店家。

建立的 id 記在 `system_settings.sample_data`；儀表板的 `SampleDataAlert` 有「清除範例資料」（`POST /system-settings/clear-sample-data`，系統設定權限）：沒被用過的刪除，已有人買過或預約過的方案下架、課程封存、服務人員保留，並從網站內容拿掉被刪除的 id。

### 5. 聯絡方式各自有顯示開關

平台資料表 `platform_settings`（單筆）：品牌名稱、是否開放申請、Email／LINE 官方帳號／電話與各自的 `show_*`。平台後台新增「形象頁設定」頁（`pages/platform/LandingSettings.tsx`），修改寫操作紀錄（只記改了哪些欄位）。

**LINE 詢問按鈕（2026-11-03 補充，R67）**：很多店家想先問清楚再申請，LINE 比 Email 門檻低。LINE 官方帳號在設定頁獨立成「LINE 官方帳號詢問」卡（ID／網址、「在前台顯示」開關、測試加好友連結），打開後形象頁的頁首、申請表單上方、暫停申請說明、聯絡區與手機右下角浮動按鈕都有「LINE 詢問」（首屏只留「免費試用」，不放 LINE 按鈕）。聯絡區在電腦版附加好友 QR Code：後端用 `segno` 從加好友網址產生行內 SVG（不需 JavaScript、也不連外部 QR 服務）。沿用既有的 `contact_line`／`show_line`，不新增欄位。

## 資料表

- `tenants.trial_ends_at`、`tenants.signup_source`
- `system_settings.sample_data`（JSON）
- 平台資料表（`PLATFORM_TABLE_NAMES`，無 RLS）：`platform_settings`、`trial_signups`（店名、聯絡人、手機、Email、IP 雜湊、`tenant_id` SET NULL）。平台帳號：settings 讀寫、signups 讀與新增；應用程式帳號沒有權限，只能執行 `platform_public_contact()`。

## 影響

- 平台網址 `/` 不再是 SPA；書籤在 `/` 的平台管理員要改用 `/login`。
- 新店家可能大量出現：列表多了「自助申請」標籤、「試用快到期／試用已到期」篩選。
- 規則 R53–R56（`docs/business-rules.md`）；測試 `tests/test_trial_signup.py`。

## 之後

- 到期 60 天後自動刪除資料（目前人工）
- 線上付款直接轉為正式方案、方案與計價頁
- 申請後寄 Email／LINE 通知平台人員、驗證 Email 或手機
- 自訂網域
