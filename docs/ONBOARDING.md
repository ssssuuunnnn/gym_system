# 新人快速導覽指南

給第一次接觸這個專案的工程師看的導覽文件。詳細規格請見 [`PRD.md`](./PRD.md)、開發指令與慣例請見根目錄 [`CLAUDE.md`](../CLAUDE.md)。

---

## 1. 一分鐘專案簡介

這是一套**健身工作室（場地租借型）的預約與會員管理系統**。核心問題：工作室要管理「教練 / 學員」的預約申請、堂數購買與剩餘堂數、每週開放時段、以及管理端的審核流程。

- **後端**：FastAPI（Python）＋ SQLAlchemy ORM ＋ Alembic migration，正式環境接 MySQL（本機開發預設可用 SQLite 快速啟動）。
- **前端**：React + TypeScript + Vite，UI 元件用 Ant Design，資料抓取用 TanStack Query，全域登入狀態用 zustand（持久化到 localStorage）。
- **認證**：JWT bearer token，角色分 `admin`（管理員）／`member`（會員，其中「教練」是否為場租教練身份是由 `coaches` 表是否存在對應紀錄**衍生**出來的，不是存在 `users` 表的欄位）。
- **開發環境**：Docker Compose 一鍵啟動 backend + frontend + MySQL + adminer（DB 瀏覽介面），見 `docker-compose.yml`。

一句話定位：**「時段表 + 堂數餘額 + 審核流程」三者互相牽動的預約系統**。

---

## 2. 專案地圖（Module Map）

### Backend（`backend/app/`）

每個資源（resource）都遵循同一套三件式結構：`models` → `schemas` → `routers`。新增資源時照抄這個模式即可。

| 資料夾 | 職責 |
|---|---|
| `models/` | SQLAlchemy ORM，一張表一個檔案（`user.py`、`coach.py`、`product.py`、`purchase.py`、`time_slot.py`、`course.py`、`reservation.py`）。這裡定義的是**資料庫長什麼樣**。 |
| `schemas/` | Pydantic 的請求/回應模型，通常一個資源一個檔案，內含 `XCreate`（建立用）、`XUpdate`（更新用）、`XOut`（回傳用）。這裡定義的是**API 進出資料的形狀**，跟 ORM model 故意分開，避免資料庫欄位直接外洩。 |
| `routers/` | FastAPI 的路由 handler，一個資源一個檔案，最後統一在 `main.py` 用 `API_V1_PREFIX`（`/api/v1`）掛載。這裡是**HTTP 進來後實際執行商業邏輯的地方**。 |
| `core/` | 橫向共用：`config.py`（讀環境變數的 `Settings`）、`security.py`（bcrypt 雜湊密碼 + JWT 簽發/解碼）。 |
| `deps.py` | FastAPI 的共用 `Depends()`：`get_current_user`（驗證 token）、`require_admin`（管理員限定）、`require_coach`（教練身份限定）、`get_coach_profile`（判斷某使用者是否為教練）。**權限守門都集中在這裡**。 |
| `db/session.py` | SQLAlchemy engine/session 建立，以及 ORM 的 declarative `Base`。 |
| `alembic/` | 資料庫遷移腳本，用 `alembic revision --autogenerate` 產生。 |
| `seed_admin.py` | 容器啟動時，用環境變數 `ADMIN_USERNAME`/`ADMIN_PASSWORD` 冪等地建立管理員帳號（`/auth/register` 這條公開路由則永遠只會建立 `role=member`）。 |

### Frontend（`frontend/src/`）

| 資料夾 | 職責 |
|---|---|
| `api/` | 一個資源一個檔案，是很薄的一層：定義對應後端 `XOut` 的 TypeScript interface，加上呼叫 `apiClient`（`api/client.ts`，axios instance）的 async function。**不含業務邏輯**，純粹是型別化的 HTTP wrapper。 |
| `pages/admin/` | 管理端限定畫面（審核預約、時段設定、會員/教練/商品管理⋯）。 |
| `pages/member/` | 會員端畫面（我的預約、我的堂數、送出預約申請⋯）。 |
| `pages/common/` | 登入、註冊，管理員與會員共用入口。 |
| `components/` | 跨頁共用元件：`AppLayout`（側邊欄＋頂欄框架）、`SlotPicker`（週間時段格子，讀取/勾選兩用，是預約相關畫面的核心元件）、`StatusTag`（狀態標籤）。 |
| `store/auth.ts` | zustand store，存 token / role / isCoach / username，並持久化到 localStorage，重整頁面登入狀態不會掉。 |
| `router/index.tsx` + `RequireRole.tsx` | 路由表與角色守衛（未登入或角色不符時導向登入頁）。 |

---

## 3. 核心資料流（Data Flow）：以「使用者登入」為例

這是最適合拿來認識全站骨架的流程，因為它會走過前後端每一層。

```
使用者在 Login 頁輸入帳密
        │
        ▼
frontend/src/pages/common/Login.tsx        ← onFinish() 收表單資料
        │  呼叫
        ▼
frontend/src/api/auth.ts  login()          ← 組成 x-www-form-urlencoded body
        │  透過
        ▼
frontend/src/api/client.ts  apiClient      ← axios instance，
        │                                    request 攔截器會自動夾帶 JWT（登入前為空）
        │  POST /api/v1/auth/login
        ▼
backend/app/main.py                        ← FastAPI app，依 API_V1_PREFIX 分派到 auth router
        │
        ▼
backend/app/routers/auth.py  login()       ← 核心商業邏輯：
        │   1. 依 username 查 users 表（backend/app/models/user.py）
        │   2. verify_password() 比對密碼雜湊（backend/app/core/security.py）
        │   3. 檢查 is_blacklisted
        │   4. get_coach_profile()（deps.py）查 coaches 表，衍生 is_coach
        │   5. create_access_token() 簽發 JWT（payload 含 user_id / role / is_coach）
        ▼
回傳 schemas/user.py 的 Token（access_token / role / is_coach）
        │
        ▼
frontend 收到回應 → useAuthStore.login()（store/auth.ts）
        │            寫入 token/role/isCoach，並持久化到 localStorage
        ▼
Login.tsx 依 role 導向不同首頁
   （admin → /admin/dashboard） → /member/dashboard）
```

之後每一次呼叫其他 API，`apiClient` 的 request 攔截器都會自動把 token 塞進 `Authorization: Bearer` header；後端則透過 `deps.py` 的 `get_current_user`（解碼 JWT、查 `users` 表）→ 視路由需要再疊加 `require_admin` 或 `require_coach` 做權限檢查。若後端回 401，`apiClient` 的 response 攔截器會自動觸發登出。

> 想看「建立訂單」等寫入流程，可以用同樣的方式追 `POST /api/v1/reservations`（`routers/reservations.py`），邏輯上會多一段「檢查/扣減 `purchases.remaining_hours`」，是本專案除了登入外最重要的一條資料流，但目前**尚未包在同一個 DB transaction 裡**（見第 5 節）。

---

## 4. 新手上路第一步（Quick Start & Entry Points）

建議照這個順序看：

1. **`CLAUDE.md`（根目錄）** — 不是程式碼，但是地圖的地圖：專案指令、8 張資料表的一句話說明、權限模式的既有慣例、目前哪些畫面已完成/哪些還是 TODO stub。**沒看這份就直接看程式碼，很容易誤判某段程式是「未完成」還是「刻意如此」。**
2. **`backend/app/deps.py` + 任一個 router（例如 `routers/reservations.py` 或 `routers/purchases.py`）** — 這兩個檔案合起來就能看懂本專案的權限模式：路由本身通常只要求「有登入」，實際的角色分流/資料範圍限縮寫在 handler 內部（例如非管理員自動被限定只能看自己的資料）。這個模式所有 list/read 端點都在用，看懂一個就等於看懂全部。
3. **`frontend/src/router/index.tsx` 搭配 `components/SlotPicker.tsx`** — 前者是整個前端的路由總表，能一眼看出有哪些頁面、對應哪個角色；後者是預約相關畫面（時段設定、送出預約、審核）共用的核心互動元件，看懂它的 `SlotState` 設計，就看懂了本專案最複雜的一塊 UI 邏輯。

看完這三組檔案，再去看 `docs/PRD.md` 對照需求規格，會比一開始就啃 PRD 更容易抓到重點。

---

## 5. 開發注意事項

- **語言慣例**：所有識別字、UI 文案、註解一律使用**繁體中文**（含 commit 內的說明性文字），新程式碼要跟著這個慣例走，不要混用英文命名的業務詞彙。
- **資源三件式（triad）**：新增任何後端資源都照 `models/X.py` → `schemas/X.py`（`XCreate`/`XUpdate`/`XOut`）→ `routers/X.py` 的模式做，並在 `main.py` 用 `API_V1_PREFIX` 註冊。不要為了省事把 ORM model 直接當 API 回應塞出去。
- **權限風格**：**不要**在整個 router 上掛 `dependencies=[Depends(require_admin)]`。正確作法是路由只要求 `get_current_user`，在 handler 內部依角色/擁有者身份縮限資料範圍（原因：過去這樣做過，結果誤傷了會員原本該有讀取權限的目錄類資料與自己的購買/預約紀錄）。寫入類端點（POST/PUT/DELETE）才逐一用 `require_admin` 之類的依賴把關。
- **`time_slots` 是時段可用性的唯一真相來源**：沒有那一列 row = 該時段預設開放。設定畫面、審核畫面、建立預約（會員送出／管理員代建）都要讀同一份資料，不要各自硬編一份時段規則。
- **`is_coach` 是衍生值**：永遠用「`coaches` 表是否存在對應 `user_id`」去判斷，不要在 `users` 表上加欄位存這個狀態。
- **前端 list 頁固定套路**：`useQuery` 抓資料 + antd `Table`（帶 `ColumnsType<T>`）+ 外鍵名稱用 `Map` 在前端組（因為 API 回傳的是原始 id）+ `useMutation` 搭配 `queryClient.invalidateQueries` + `message.success/error` 回饋 + `Popconfirm` 保護有破壞性的操作。做新畫面前先照抄一個既有的 list 頁（如 `CoachList.tsx`、`BookingReviewList.tsx`）。
- **已知的後端技術債（尚未實作，寫程式時要意識到）**：
  - 購買（purchase）與預約（reservation）建立目前**沒有包在同一個 DB transaction**，理論上有競態風險。
  - 教練「臨時加人」加購（`reservation_addons`）目前**不會**扣減 `purchase.remaining_hours`。
  - **沒有自動化測試**，改後端要靠手動對 `http://localhost:8000/docs` 打 API 驗證。
- **還沒做的畫面**：`CoachForm`、`ProductForm` ✅（已完成）、`CourseForm`、`PurchaseEntry` ✅（已完成）、`CoachPurchaseQuery`、`CreateBooking` ✅（已完成）、`BookingReviewDetail`、`MemberDetail`（管理端）；`SubmitBooking` ✅（已完成）、`AddPerson`、`Dashboard`（會員端）——實際最新狀態請以 `CLAUDE.md` 的「Implementation status」段落為準，那份文件會隨每次功能完成更新。
