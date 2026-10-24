# ADR 0002：平台管理後台

- **狀態**：已採納
- **日期**：2026-10-24
- **決策者**：Sunkuo
- **前提**：[ADR 0001 多租戶 SaaS 架構](0001-multi-tenancy.md)

## 背景

ADR 0001 完成後，開通、停用健身房只能用指令（`python -m app.cli`）在伺服器上執行。平台營運需要一個網頁後台：開通健身房、看各家的使用情形、停用未續約的、協助健身房老闆重設管理員密碼，並留下操作紀錄。

## 決策

### 1. 網址：`platform.<BASE_DOMAIN>`

- 平台後台與各家健身房共用同一套前端與 API，**依網址分流**：`platform` 是保留子網域，不會分配給健身房。
  - 前端：`App.tsx` 依 `isPlatformHost()` 只建立平台或健身房其中一套路由（`router/platform.tsx`、`router/index.tsx`）。
  - 後端：`/api/v1/platform/*` 只在平台網址提供（`deps.require_platform_host`），在健身房網址一律 404；平台網址也不是健身房，打健身房 API 同樣 404。

### 2. 帳號：獨立的平台管理員

- 新表 `platform_admins`，與任何健身房的 `users` 無關。
- 平台 JWT 帶 `scope=platform`、沒有 `tid`：不能打健身房 API；健身房 token 也不能打平台 API。有效時間較短（`PLATFORM_TOKEN_EXPIRE_MINUTES`，預設 120 分鐘）。
- 第一位平台管理員由部署時建立：環境變數 `PLATFORM_ADMIN_USERNAME`／`PLATFORM_ADMIN_PASSWORD`，或 `python -m app.cli create-platform-admin`。

### 3. 資料庫：第三個帳號 `fitness_platform`，權限最小

| 帳號 | 用途 | 權限 |
|---|---|---|
| `fitness_owner` | migration、CLI | 擁有資料表，不受 RLS |
| `fitness_app` | 健身房 API | 業務表讀寫（受 RLS）、`tenants` 唯讀；**平台表無權限** |
| `fitness_platform` | 平台 API | `tenants`、`platform_admins` 讀／新增／修改；`platform_audit_logs` 讀／新增；`users` 讀／新增／修改（**受 RLS**）；執行 `platform_tenant_stats()` |

- 平台帳號**看不到各家的會員、預約、購買等明細**：業務表沒有授權；`users` 雖有授權但受 RLS，必須先在交易中切換到某一家（`db.session.act_as_tenant`）才看得到那家的帳號——只用在管理該家的管理員帳號。
- 跨租戶的使用概況只透過 `platform_tenant_stats(month_start)` 取得：`SECURITY DEFINER`（以擁有者身份執行）、只回傳每家的彙總數字（會員數、管理員數、教練數、本月預約數、最後登入時間）。
- 開通健身房＋建立第一位管理員＋寫操作紀錄在**同一個交易**完成（建立 tenant 後切換到該租戶建立管理員），任何一步失敗都不會留下半套資料。

### 4. 功能範圍

- 健身房列表（狀態篩選、搜尋、使用概況）、開通（子網域即時檢查、時區、聯絡資訊、第一位管理員與隨機密碼）、修改基本資料與聯絡資訊、試用／啟用／停用（停用需填原因）。
- **子網域開通後不可修改**：網址、登入狀態（各網域的 localStorage）與上傳檔案路徑都跟著子網域。
- 各家管理員帳號：列表、新增、協助重設密碼（預設要求下次登入修改）。**不能動會員與教練帳號**，那是健身房自己的事。
- 密碼只在成功對話框顯示一次，不寫入操作紀錄。
- 操作紀錄 `platform_audit_logs`：開通、修改（只記有變動的欄位與前後值）、變更狀態（含原因）、新增管理員、重設管理員密碼。CLI 的操作也會記錄，操作者為 `cli`。

### 5. 版面

平台後台與健身房管理員後台共用同一個外框 `components/BackOfficeShell.tsx`（固定 Header＋毛玻璃、可收合側欄、底部操作列），各自只提供導覽、品牌與登入者資訊（`AppLayout.tsx`、`platform/PlatformLayout.tsx`）。

## 影響

- 新 migration `0002_platform`：兩張平台表、`tenants` 聯絡欄位、統計函式、`fitness_platform` 的授權。**部署前必須先建立 `fitness_platform` 帳號**（Docker 的 `init-roles.sh` 與 CI 已處理；既有資料庫需手動 `CREATE ROLE` 並 `GRANT USAGE ON SCHEMA public`）。
- 子網域查詢快取：「查無此家」只快取 5 秒，開通時也會清除本程序的快取，剛開通的健身房不會因為先前有人打過網址而持續 404。
- 修改密碼頁 `/member/change-password` 改為任何已登入身份都能進入：平台開通的第一位管理員預設要先改密碼，原本的會員專用守衛會讓管理員在 `/admin` 與修改密碼頁之間無限導向。
- 前端開發改用 Vite proxy 轉送 `/api`、`/media` 並保留 Host，`VITE_API_BASE_URL` 預設改為 `/api/v1`；本機用 `http://platform.localhost:5173`、`http://<子網域>.localhost:5173`。

## 已知限制

- 平台登入沒有次數限制或兩步驟驗證；正式上線前建議加上（或在反向代理層限制平台網址的來源 IP）。
- 停用在其他 API 程序最多 30 秒生效（子網域快取）。
- 平台管理員只有一種權限，沒有唯讀角色；平台管理員帳號的新增／停用目前只能用 CLI。
- 使用概況是即時計算，健身房數量很大時需改為定期彙總。

## 後續

1. 平台帳號管理畫面、兩步驟驗證、角色（唯讀／營運）。
2. 每家品牌色、自訂網域。
3. 訂閱方案與收費（方案、到期日、試用期自動到期）。
4. 個資：租戶資料匯出、解約後刪除。
