# 健身工作室管理系統

依「健身房預約系統 — Wireframe 頁面清單.md」設計文件建立的專案骨架。技術棧：React.js（Vite + TypeScript + Ant Design）＋ FastAPI（Python）＋ MySQL。

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
- 後端目前缺：加購臨時加人的堂數扣抵邏輯（目前只更新人數）、會員自助購買的付款狀態（目前購買即入帳堂數）
- 手機版時段選擇器的橫向滑動／列表式呈現尚未實作（目前 SlotPicker 僅桌面版格狀版面）
- 後端已有 pytest（`backend/tests/`，CI 自動執行）；前端尚無自動化測試
- 尚無 CD；Docker（本機一鍵啟動 MySQL＋後端＋前端）已驗證可正常 build／run

## 啟動方式

**環境啟動請一律使用 Docker**（唯一驗證過、建議使用的方式）。下方「本機開發（不使用 Docker）」僅供需要直接除錯後端／前端程式時參考，非日常啟動方式。

### Docker（一鍵啟動 MySQL + 後端 + 前端，建議方式）

```bash
docker compose up --build
```

- 前端：http://localhost（nginx 提供靜態檔，並將 `/api/*` 反向代理到 backend）
- 後端 API 文件：http://localhost:8000/docs
- MySQL：`localhost:3306`（資料存於 named volume `mysql_data`）

容器啟動流程：`backend/docker-entrypoint.sh` 會先跑 `alembic upgrade head` 建表，再啟動 `uvicorn`；`backend` 服務設定 `depends_on: mysql: condition: service_healthy`，等 MySQL healthcheck 通過才會啟動，避免建表時資料庫還沒就緒。

**建立 admin 帳號**：`register` 端點固定建立 `role=member`，若要自動建立／確保 admin 帳號存在，啟動時帶上 `ADMIN_USERNAME`／`ADMIN_PASSWORD`（entrypoint 會呼叫 `backend/app/seed_admin.py`，可重複執行、不會覆蓋既有密碼）：

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=<你的密碼> docker compose up --build
```

檔案結構：
- `backend/Dockerfile`、`backend/docker-entrypoint.sh`、`backend/app/seed_admin.py`、`backend/.dockerignore`
- `frontend/Dockerfile`（多階段建置：node 建置 → nginx 提供靜態檔）、`frontend/nginx.conf`、`frontend/.dockerignore`
- 根目錄 `docker-compose.yml`

### 本機開發（不使用 Docker，除錯用）

後端：

```bash
cd backend
pip install -r requirements.txt   # 需 Python 3.10+
cp .env.example .env
# 本機開發預設用 SQLite（.env 內 DATABASE_URL），正式環境請改為 MySQL 連線字串
alembic upgrade head
uvicorn app.main:app --reload
python -m app.seed_admin --username admin --password <你的密碼>   # 建立/確保 admin 帳號
```

前端：

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

預設會呼叫 `http://localhost:8000/api/v1`（可在 `.env` 的 `VITE_API_BASE_URL` 調整）。

MySQL（正式環境）連線字串範例：

```
DATABASE_URL=mysql+pymysql://<user>:<password>@<host>:3306/fitness_studio?charset=utf8mb4
```

改好 `.env` 後執行 `alembic upgrade head` 建表即可，Model／Schema／Enum 皆已依「技術棧與系統架構」章節的型別對應表設計，可直接套用 MySQL。
