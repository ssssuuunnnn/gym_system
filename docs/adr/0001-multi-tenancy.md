# ADR 0001：多租戶 SaaS 架構

- **狀態**：已採納
- **日期**：2026-10-24
- **決策者**：Sunkuo

## 背景

系統原本是單一健身工作室的內部系統。產品方向改為 **SaaS 平台**：多家健身房共用同一套系統，但彼此是**不同公司、互不相關**，任何資料（會員、教練、方案、預約、帳務）都不能跨租戶看到或修改。

原架構中有多處「全站只有一份」的設計：`system_settings` 單筆、帳號全站唯一、課程編號全站流水號、公休時段以日期＋時段全站唯一、時區寫在設定檔、上傳檔案共用一個資料夾、JWT 不帶租戶。

## 決策

### 1. 資料隔離：共用資料庫，每張業務表加 `tenant_id`，由 PostgreSQL RLS 強制

| 選項 | 結論 |
|---|---|
| 每租戶一個資料庫 | 不採用：每次 migration、備份、監控都要乘以 N，對一人維運的小型工作室客群成本過高 |
| 共用資料庫＋`tenant_id`，只靠程式過濾 | 不採用：任何一支 API 忘記過濾就外洩 |
| **共用資料庫＋`tenant_id`＋PostgreSQL 列層級權限（RLS）** | **採用** |

- 資料庫由 MySQL **改為 PostgreSQL**，以使用 RLS。
- 除 `tenants` 外，每張業務表都有 `tenant_id`（含子表，例如 `course_sessions`、`hour_ledger`），每張表都有 RLS policy：
  `tenant_id = current_setting('app.tenant_id')::int`，同時套用在讀取（`USING`）與寫入（`WITH CHECK`）。
- **兩個資料庫帳號**：
  - `fitness_owner`：擁有資料表，只用來跑 migration 與平台層級工具（開通租戶）。擁有者不受 RLS 限制。
  - `fitness_app`：應用程式連線用，只有資料讀寫權限（無 DDL），**受 RLS 限制**。
- 每個交易開始時，應用程式以 `set_config('app.tenant_id', <id>, true)`（交易範圍）設定目前租戶（`app/db/session.py` 的 `after_begin` 事件）。沒有設定租戶時，RLS 讓所有業務表看起來都是空的，寫入一律失敗，**預設拒絕**。
- 新增資料時由 ORM 自動填入 `tenant_id`（`before_flush` 事件），路由程式不需手動處理；RLS 的 `WITH CHECK` 確保無法寫入別家的 `tenant_id`。
- 「每家唯一」的限制改為複合唯一：`(tenant_id, username)`、`(tenant_id, code)`、`(tenant_id, slot_date, start_hour)`、`system_settings` 每家一筆。

### 2. 租戶識別：子網域

- 每家健身房一個子網域：`<subdomain>.<BASE_DOMAIN>`，由 HTTP `Host` 判斷租戶（`app/deps.py` 的 `get_tenant`）。登入頁、品牌、資料都跟著網址走。
- JWT 帶 `tid`（租戶 id）；`get_current_user` 驗證 token 的租戶與網址的租戶一致，**拿 A 家的 token 打 B 家的網址會被拒絕**。
- 停用中的租戶回 403。
- 本機開發（`localhost`、IP）沒有子網域時，使用設定 `DEFAULT_TENANT`；正式環境應留空，未知網址回 404。

### 3. 帳號：每家各自獨立

- 同一個人在兩家健身房就是兩個帳號，帳號只在該租戶內唯一。不做跨租戶的統一身份，個資不跨公司流動。
- 角色：健身房管理員（現有 `admin`，只管自己那家）、會員／教練。**平台管理員**（開通、停用租戶）在後續階段實作，以 `fitness_owner` 連線的平台工具執行，不經過租戶 API。

### 4. 每家各自的設定

- 時區：`tenants.timezone`（原設定檔 `STUDIO_TIMEZONE` 改為未設定租戶時的預設值）。
- 系統設定（名稱、LOGO、取消期限）：每家一筆。
- 上傳檔案：`MEDIA_DIR/<subdomain>/...`。
- 前台品牌色：後續階段。

## 影響

- 舊的 MySQL migration 歷史整併為一份 PostgreSQL 初始 migration（系統尚未正式上線；若有既有 MySQL 資料需另寫搬移程式）。本機以 SQLite 開發的方式不再支援（RLS 為 PostgreSQL 功能）。
- 後端測試改在真的 PostgreSQL 上執行（以 `fitness_app` 身份連線，才能驗證 RLS），每個測試在交易中執行後回滾；新增跨租戶隔離測試。CI 加上 PostgreSQL 服務。
- 新增資料表時**必須**：繼承 `TenantMixin`，並在 migration 中呼叫 `enable_tenant_rls(<table>)`。`tests/test_tenancy.py` 會檢查每張業務表都已啟用 RLS。

## 已知限制（第一階段）

- **外鍵不檢查租戶**：例如預約的 `product_id` 指到別家商品，外鍵本身不會擋。實務上路由都先用 `db.get()` 讀取被參照的資料，RLS 讓別家的資料「找不到」而回 400／404（`tests/test_tenancy.py` 有測）。若要在資料庫層也擋下，之後可改為 `(tenant_id, id)` 複合外鍵。
- **上傳檔案以不可猜的網址公開**：`/media/<subdomain>/...` 由靜態路徑提供、不驗證登入，安全性來自隨機 uuid 檔名（與改版前相同）。
- **停用租戶最多延遲 30 秒生效**：子網域查詢有短暫快取（`app/deps.py`）。
- 測試中多個 Session 共用同一條連線與交易，切換租戶前要先取好值（見 `test_cannot_reference_other_tenants_rows`）；正式執行時每個請求各自一條連線，沒有這個問題。

## 後續階段

1. 平台管理：開通／停用健身房的工具與後台、用量統計。
2. 每家品牌色、自訂網域。
3. 訂閱方案與收費。
4. 個資：租戶資料匯出、解約後刪除、操作紀錄。
5. 每家的形象網頁（子網域首頁）。
