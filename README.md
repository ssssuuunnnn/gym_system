# 健身工作室管理系統

依「健身房預約系統 — Wireframe 頁面清單.md」設計文件建立的專案骨架。技術棧：React.js（Vite + TypeScript + Ant Design）＋ FastAPI（Python）＋ PostgreSQL。

**多租戶 SaaS**：多家健身房共用一套系統、資料完全隔離。每家一個子網域（`<subdomain>.<BASE_DOMAIN>`），資料庫以 PostgreSQL 列層級權限（RLS）強制隔離。設計見 [`docs/adr/0001-multi-tenancy.md`](docs/adr/0001-multi-tenancy.md)。

設計文件與 Claude Design mockup 請見上一層資料夾：
- `../健身房預約系統 — Wireframe 頁面清單.md`（畫面清單、資料庫結構、技術棧）
- `../Fitness Studio Backend Mockup.html`（視覺化 wireframe）

## 目前完成度

已搭好可執行的骨架，尚未實作各畫面的完整業務邏輯／UI 細節。

**後端（backend/）**：
- 8 張資料表的 SQLAlchemy Model（對應「資料庫結構設計」章節）：users、coaches、products、purchases、time_slots、courses、reservations、reservation_addons
- Alembic 初始 migration（`alembic/versions/073d85f424c1_initial_schema.py`，已用 autogenerate 產生並驗證可建表）
- JWT 登入／註冊、角色權限（require_admin／require_coach）
- 各資源的基礎 CRUD API：教練、商品、購買紀錄、課程、時段開放設定、預約（含核准／拒絕／取消、容量檢查、加購臨時加人）、會員列表（含黑名單、重設密碼）
- 已用 FastAPI TestClient 跑過端對端流程（註冊→登入→建立商品→登錄購買→建立預約）驗證可執行

**前端（frontend/）**：
- Vite + React + TypeScript + Ant Design 專案結構，`npm run build` 已驗證通過（tsc + vite build 無錯誤）
- React Router 路由，依 6＋3 大類導覽分組（見「對照 Claude Design Mockup」章節的已確認事項）
- 登入／註冊頁（已串接後端 API）
- 21 個畫面的空頁面（依 Wireframe 頁面清單建立，內容待實作）
- 共用元件：`SlotPicker`（時段選擇器格狀元件）、`StatusTag`（狀態標籤）
- 登入狀態管理（zustand）、API 呼叫層（axios + 攔截器自動帶 JWT）

## 尚未實作（下一步）

- 21 個畫面目前都是佔位卡片，需依文件的欄位／表格定義逐一補上表格、表單、與後端 API 串接（TanStack Query）
- 後端目前缺：加購臨時加人的堂數扣抵邏輯（目前只更新人數）、已付款訂單的退款流程
- 手機版時段選擇器的橫向滑動／列表式呈現尚未實作（目前 SlotPicker 僅桌面版格狀版面）
- 後端已有 pytest（`backend/tests/`，CI 自動執行）；前端尚無自動化測試
- 尚無 CD；Docker（本機一鍵啟動 PostgreSQL＋後端＋前端）

## 啟動方式

**環境啟動請一律使用 Docker**（唯一驗證過、建議使用的方式）。下方「本機開發（不使用 Docker）」僅供需要直接除錯後端／前端程式時參考，非日常啟動方式。

### Docker（一鍵啟動 PostgreSQL + 後端 + 前端，建議方式）

```bash
docker compose up --build
```

- 前端：http://localhost（nginx 提供靜態檔，並將 `/api/*` 反向代理到 backend）
- 後端 API 文件：http://localhost:8000/docs
- PostgreSQL：`localhost:5432`（資料存於 named volume `postgres_data`；第一次建立時 `docker/postgres/init-roles.sh` 會建立資料表擁有者 `fitness_owner`、應用程式帳號 `fitness_app` 與平台後台帳號 `fitness_platform`）
- 子網域：瀏覽器會把 `*.localhost` 指到本機，所以 `http://demo.localhost`、`http://alpha.localhost` 都能直接開；`http://localhost` 沒有子網域時使用 `DEFAULT_TENANT`（預設 `demo`）

> 舊版用 MySQL 的 `mysql_data` volume 不會被沿用；migration 歷史已整併為 PostgreSQL 初始結構，若有既有 MySQL 資料需另外搬移。

容器啟動流程：`backend/docker-entrypoint.sh` 會先跑 `alembic upgrade head` 建表，再開通 `DEFAULT_TENANT` 這家健身房，最後啟動 `uvicorn`；`backend` 服務等 PostgreSQL healthcheck 通過才會啟動。

**建立 admin 帳號**：`register` 端點固定建立 `role=member`，若要自動建立／確保 `DEFAULT_TENANT` 的 admin 帳號存在，啟動時帶上 `ADMIN_USERNAME`／`ADMIN_PASSWORD`（entrypoint 會呼叫 `backend/app/seed_admin.py`，可重複執行、不會覆蓋既有密碼）：

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=<你的密碼> docker compose up --build
```

**形象網站**：每家健身房的首頁（例如 `http://alpha.localhost`）是後端產生的形象網站，在後台「形象網站」編輯、預覽、發布；訪客預約體驗課的資料進到「詢問名單」。未發布時首頁直接是登入頁。設計見 [`docs/adr/0003-gym-website.md`](docs/adr/0003-gym-website.md)。

**LINE 通知店家**：有新的體驗課詢問、會員下單待收款、預約待審核時，用平台共用的 LINE 官方帳號通知老闆和員工。在 `.env` 設定 `LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_BOT_BASIC_ID`，LINE Developers 的 Webhook 設為 `https://platform.<BASE_DOMAIN>/api/v1/line/webhook`；各健身房在「系統設定 › LINE 通知」掃 QR 碼、傳綁定碼加入接收人。沒設定時不發送。設計見 [`docs/adr/0004-line-notifications.md`](docs/adr/0004-line-notifications.md)。

**平台管理後台**（開通／停用健身房、各家使用概況、協助重設管理員密碼、操作紀錄）：`http://platform.localhost`。第一位平台管理員在啟動時建立：

```bash
PLATFORM_ADMIN_USERNAME=ops PLATFORM_ADMIN_PASSWORD=<至少 8 字元> docker compose up --build
```

設計見 [`docs/adr/0002-platform-console.md`](docs/adr/0002-platform-console.md)。

**用指令開通健身房**（部署、救援或自動化用；以資料表擁有者連線）：

```bash
docker compose exec backend python -m app.cli create-tenant --subdomain alpha --name "Alpha 健身" \
  --admin-username admin --admin-password <密碼>
docker compose exec backend python -m app.cli list-tenants
docker compose exec backend python -m app.cli set-status --subdomain alpha --status suspended
```

之後打開 `http://alpha.localhost` 用該家的 admin 登入。同一個人在兩家健身房是兩個獨立帳號。

檔案結構：
- `docker/postgres/init-roles.sh`（建立三個資料庫帳號：擁有者、應用程式、平台後台）
- `backend/Dockerfile`、`backend/docker-entrypoint.sh`、`backend/app/seed_admin.py`、`backend/.dockerignore`
- `frontend/Dockerfile`（多階段建置：node 建置 → nginx 提供靜態檔）、`frontend/nginx.conf`、`frontend/.dockerignore`
- 根目錄 `docker-compose.yml`

### 本機開發（不使用 Docker，除錯用）

後端：

```bash
cd backend
pip install -r requirements.txt   # 需 Python 3.10+
cp .env.example .env
# 需要本機 PostgreSQL 16，並先建好 fitness_owner／fitness_app／fitness_platform 三個帳號（參考 docker/postgres/init-roles.sh）
alembic upgrade head
python -m app.cli create-tenant --subdomain demo --admin-username admin --admin-password <你的密碼>
uvicorn app.main:app --reload
```

前端：

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

開發伺服器會把 `/api`、`/media` 轉給 `http://localhost:8000` 並保留網址，所以可以直接開 `http://<子網域>.localhost:5173`（健身房）與 `http://platform.localhost:5173`（平台管理後台）。

後端測試在真的 PostgreSQL 上執行（以受 RLS 限制的帳號連線，才能驗證租戶隔離），預設連 `fitness_test` 資料庫，可用 `TEST_DATABASE_URL`／`TEST_MIGRATION_DATABASE_URL` 覆寫：

```bash
cd backend && pip install -r requirements-dev.txt && python -m pytest -q
```
