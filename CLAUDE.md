# CLAUDE.md

Fitness studio booking/management system: **FastAPI (Python) + MySQL** backend, **React + TypeScript + Ant Design (Vite)** frontend, Docker Compose for local orchestration. All identifiers, UI copy, and comments in this repo are in **Traditional Chinese** — match that convention in new code.

## Commands

```bash
# Run the full stack (always prefer this over local dev servers)
docker compose up --build

# Frontend type-check + build — run after any TSX/TS change
cd frontend && npm run build

# Frontend lint
cd frontend && npm run lint   # if configured; check package.json scripts

# Backend tests (pytest, in-memory SQLite; also run in CI)
cd backend && pip install -r requirements-dev.txt && python -m pytest -q

# DB migrations (inside backend/, local venv or `docker compose exec backend`)
alembic upgrade head
alembic revision --autogenerate -m "..."
```

Services once `docker compose up` is running: frontend `http://localhost`, backend docs `http://localhost:8000/docs`, MySQL `localhost:3306`, adminer (DB browser UI) `http://localhost:8080` (server `mysql`, default creds `fitness_user`/`changeme`/`fitness_studio` unless overridden by `.env`).

Admin account is seeded idempotently via `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars at container start (`backend/app/seed_admin.py`); the `/auth/register` endpoint always creates `role=member`.

## Architecture

```
backend/app/
  models/     SQLAlchemy ORM models (1 file per table)
  schemas/    Pydantic request/response models (1 file per resource)
  routers/    FastAPI route handlers (1 file per resource)
  core/       config.py (env-driven Settings), security.py (JWT + bcrypt)
  deps.py     shared FastAPI dependencies (auth/role guards)
  db/session.py  SQLAlchemy engine/session, declarative Base
  alembic/    migrations (autogenerate-driven)

frontend/src/
  api/        one file per resource, thin axios wrappers returning typed data
  pages/admin/    admin-only screens
  pages/member/   member-only screens
  pages/common/   Login, Register
  components/     shared UI: AppLayout (sidebar+header), SlotPicker (week grid), StatusTag; calendar/ (排程原子組件)
  store/auth.ts   zustand store, persisted to localStorage (login survives refresh)
  router/index.tsx   route table; RequireRole.tsx guards by role
```

Every backend resource follows the same triad: `models/X.py` (table) → `schemas/X.py` (`XCreate` / `XUpdate` / `XOut`) → `routers/X.py` (registered in `main.py` under `API_V1_PREFIX` = `/api/v1`). Follow this triad for any new resource.

## Data model (12 tables)

`users` (admin/member, `is_coach` is a **derived** value — true iff a `coaches` row references the user, not a stored column; `is_blacklisted` and `must_change_password` are stored flags the admin sets from 會員詳情) · `coaches` (`user_id` bind is unique; plus `name`, `alias` 授課名稱, `line_name`, `phone`, `bank_code`/`bank_account` 匯款帳號, `specialty` 專長, `photo_url`) · `products` (catalog, three kinds via `category` enum — stored `course`/`single_course`/`supply`, API 團體課程/課程/用品: **團體課程** binds `course_id` → a `courses` row and `session_hours` mirrors that course's `session_count` (set server-side, read-only in the form, `stock` null); **課程** (單次課程) has an admin-entered `session_hours` (≥1), `course_id`/`stock` null; **用品** carries `stock` (decremented on purchase; `create_purchase` 400 「庫存不足」 when short), `session_hours` 0, `course_id` null; plus `price`, `is_active`) · `purchases` (a member's purchased session-hours; `total_hours` = 下單當下 `session_hours * quantity`, `remaining_hours` = current balance (only via `services/hours.py`); **付款狀態** `payment_status` 待付款/已付款/已取消 (stored `unpaid`/`paid`/`cancelled`) + `payment_method` 現金/轉帳/刷卡/其他 (stored `cash`/`transfer`/`card`/`other`), `payment_note`, `paid_at`, `paid_confirmed_by`, `cancelled_at`; for a 用品 purchase `total_hours`/`remaining_hours` are 0 and `products.stock` is decremented at order time) · `hour_ledger` (堂數異動紀錄: one row per change to `purchases.remaining_hours` — `delta` (+增/−扣), `balance_after`, `reason` 期初餘額/購買/預約扣抵/預約退回/手動調整 (stored `opening`/`purchase`/`reservation_deduct`/`reservation_refund`/`manual_adjust`), optional `reservation_id`, `note`, `created_by`; invariant `SUM(delta) == remaining_hours`) · `time_slots` (per-date slot-availability exception: `slot_date` + `start_hour` 10–21 + `is_open`, unique per date+hour; **no row for a date/hour = open by default**) · `system_settings` (singleton config row: `company_name` / `short_name` / `logo_url`; lazily get-or-created — see 系統設定 below) · `courses` (團體課程 bound to a coach: auto `code` `GC-YYYY-NNN`, `status` 上架/下架/草稿, `min_capacity` 最低開班, `max_capacity` = **每堂**容量, `duration_minutes` (**one value per course**), `description`, `cover_image_url`, `updated_by_name`, `is_archived`/`archived_at`/`archived_by_name`; **排程規格 lives on the course row** — `start_hour` (單一上課時間), `start_date`, `end_mode` 週數/結束日, `week_count` / `end_date`; `day_of_week` = the **min weekday** (denormalised for the list summary), all nullable for a 草稿; `session_count` = non-cancelled `course_sessions`; `start_date`/`end_date` = the schedule spec (`end_date` is the input in 結束日 mode, or `start_date` + `week_count` in 週數 mode); `enrolled_count` (API only) = **peak single-session** headcount from `reservations`) · `course_weekdays` (course_id, `weekday` ISO 1–7; the 多選 上課星期) · `course_sessions` (the展開後 課堂 list: `session_date`, `start_minute`, `duration_minutes`, `source` 排程/加開, `is_cancelled` 停課 (kept as a record, not counted); FK `ON DELETE CASCADE`) · `reservations` (status: 待確認/已確認/已拒絕/已取消; source: member_submitted/admin_created) · `reservation_addons` (coach-only "臨時加人" add-on; the `product_id` "固定為「臨時加人」商品" comment is now historical — that product category no longer exists).

**Reservation capacity** (`routers/reservations.py` `_check_capacity`): a reservation whose product/`course_id` resolves to a `courses` row is capped by that course's `max_capacity` (每堂容量) — `SUM(people_count)` of 已確認 reservations with the same `course_id` + `booking_date` + `start_hour`; no course link ⇒ no cap. (Replaced the old per-`category` `CAPACITY_BY_CATEGORY` map.)

**Enum columns store the Python enum *member name*, not the Chinese `.value`** (SQLAlchemy default): e.g. `courses.status` is stored as `on`/`off`/`draft`, `products.category` as `course`/`single_course`/`supply`, `reservations.status` as `pending`/`confirmed`/… — the API layer (Pydantic `XOut`) serializes back to the Chinese value. Alembic `sa.Enum(...)` declarations, raw SQL, and seed inserts must use the names.

**`day_of_week` is ISO-8601: `1` = 週一 … `7` = 週日** — used by `courses` (`day_of_week` = 最小上課星期; the full 多選 lives in `course_weekdays.weekday`). `time_slots` keys off a concrete `slot_date` instead. Frontend labels come from `frontend/src/lib/weekday.ts` (`weekdayLabel` / `WEEKDAY_SHORT_MON_FIRST`) — don't re-declare weekday arrays per file.

## Auth & permission model

JWT bearer tokens (`app/core/security.py`), role = `admin` | `member`. Key dependencies in `deps.py`:
- `get_current_user` — any authenticated, non-blacklisted user
- `require_admin` — admin only
- `require_coach` — member with a bound `coaches` row

**Established pattern for list/read endpoints that both admins and members need** (see `routers/purchases.py`, `reservations.py`, `coaches.py`, `products.py`, `courses.py`): the route itself only requires `get_current_user`; inside the handler, non-admins are **silently scoped to their own data** (e.g. `purchases`/`reservations` force-filter by `current_user.id`, ignoring any different id passed in). Mutations (`POST`/`PUT`/`DELETE`) stay `require_admin`-gated per-route. Follow this pattern rather than gating an entire router with a single `dependencies=[Depends(require_admin)]` — several routers used to do that and it silently broke member-facing pages that needed read access to catalog data (coaches/products/courses) or their own purchases/reservations.

`time_slots` is the single source of truth for slot availability — read by the settings screen, the reservation-review screens, and reservation creation (both member submit and admin create) alike.

**File uploads**: `POST /coaches/upload-photo` (multipart, admin-only, jpg/png ≤ 2MB) saves under `settings.MEDIA_DIR` (`/app/media`, a named volume `coach_media`) and returns a `/media/...` URL; `main.py` mounts that dir as StaticFiles at `/media`, and `frontend/nginx.conf` proxies `/media/` to the backend. Store the returned URL in `coaches.photo_url`. This is the pattern for any future upload.

**Forced password change**: when an admin resets a member's password from 會員詳情 with "會員下次登入時必須自行修改密碼" ticked, `POST /users/{id}/reset-password` sets `users.must_change_password`. `/auth/login` returns that flag in the token response; the frontend stores it and `AppLayout` redirects to `/member/change-password` (rendered outside `AppLayout`) until the member calls `POST /auth/change-password` (verifies current password, clears the flag). Enforcement is frontend-only — the API token still works elsewhere.

## Frontend conventions

Every list page follows the same shape (see `pages/admin/CoachList.tsx`, `BookingReviewList.tsx`, `MemberList.tsx` as references):
- `useQuery` (TanStack Query) for data fetching, keyed by resource name
- Antd `Table` with typed `ColumnsType<T>`
- Name/label lookups for foreign keys done client-side via `Map` built from a sibling `useQuery` (e.g. `coachNameById`), since API responses return raw ids
- Mutations via `useMutation` + `queryClient.invalidateQueries` on success, `message.success/error` for feedback
- `Popconfirm` for destructive/state-changing actions (approve/reject/cancel)

`api/*.ts` files are thin: exported TS interfaces mirroring the backend `XOut` schema, plus one async function per endpoint using the shared `apiClient` (axios instance in `api/client.ts` with JWT-injecting request interceptor and 401→logout response interceptor).

`components/SlotPicker.tsx` is the canonical week grid — a dated 7-day time grid (`dates: Dayjs[]` × 10:00–21:00) composed from the `components/calendar/` atoms (`TimeAxis`, `DayHeaderCell`, `TimeSlotCell`, `NowIndicator`, `EventBlock`); `SlotState` = `open | closed`. Optional `cellEvents(date, hour) => SlotEvent[]` prop overlays `EventBlock`s (side-by-side via `colIndex`/`colCount`; a `SlotEvent` without `onClick` gets `pointerEvents:none` so the cell stays clickable, one with `onClick` is itself clickable) — `SlotSettings` uses it to show existing reservations on closed cells (not courses). Optional `cellDisabled(date, hour) => boolean` greys out + blocks extra cells beyond the always-disabled past dates (`CourseForm` passes it for 公休 slots on its read-only preview). `SlotSettings` owns the week nav + `MiniCalendar` + legend layout. Extend `SlotPicker`/`TimeSlotCell` rather than building a parallel grid component.

`components/InlineRuleList.tsx` (`InlineRuleList` + `InlineRuleRow`) is the shared chrome for a **numbered setting-row list** — a soft panel with title/description, rows each carrying a `規則 N` / `設定 N` chip (`chipPrefix` via context) and a trailing delete button, plus a dashed 新增一列 button (`readOnly` hides the add + per-row delete buttons). Row *contents* stay with the caller. Used by `Availability`'s 快速設定 (批次關閉); reuse it for any future batch-rule editor rather than re-styling a panel.

`components/courseColumns.tsx` (`sharedCourseColumns({ coachNameById })`) + `components/CourseCoverThumb.tsx` are the 7 course-row columns (封面 / 課程名稱 / 教練 / 開班人數 / 課程介紹 / 課堂數 / 開課時間) shared by `GroupCourseList` and `GroupCourseArchive`; each page spreads them then appends its own columns (狀態＋操作 / 封存資訊＋還原刪除).

`components/calendar/` holds 8 presentational scheduling atoms imported from the PulseFit design system (`TimeAxis`, `TimeSlotCell`, `DayHeaderCell`, `EventBlock`, `EventChip`, `NowIndicator`, `MonthDayCell`, `MiniCalendar`) — colours/radius/font via `theme.useToken()`, no global CSS. See `components/calendar/README.md`.

When **authoring or reviewing a UI component** (not a page screen), follow the `component-conventions` skill: where it lives (shared `frontend/src/components/` for 2+ consumers vs. page-scoped `frontend/src/pages/<Area>/<Page>/components/` for a single consumer), reach for an Ant Design component before hand-rolling, colours/radius via `theme.useToken()` (no hardcoded hex), `dayjs` for all date work, one shared source for constants/helpers, controlled props-driven components, and "one concept, one component". The layout shell (`AppLayout.tsx`, header, sidebar) has its own `layout-conventions` skill.

## Implementation status

**Done**: all list/read screens — CoachList, ProductList, MemberList, BookingReviewList, SlotSettings, GroupCourseList, GroupCourseArchive (admin); MyBookings, MyProducts (member); Login/Register. Implemented forms/flows: ProductForm, PurchaseEntry, CreateBooking, CourseForm (admin); SubmitBooking, BuyProduct (member).

**購買商品** (`/member/purchase`, `BuyProduct.tsx`): the member self-service purchase screen. A `Select` over active `products` (data from 商品管理; out-of-stock 用品 disabled), an antd `Descriptions` panel showing the picked product's 分類 / 堂數 or 庫存 / 單價, a 數量 `InputNumber`, the computed 應付金額, and a `Popconfirm`-gated 購買 button → `POST /purchases/self` (`PurchaseSelfCreate` = `product_id` + `quantity` only; the endpoint forces `user_id`/`created_by` = current user, `purchase_date` = today, and `amount` = `product.price * quantity` server-side — the client-sent amount is never trusted). Shares `_build_purchase` in `routers/purchases.py` with the admin `POST /purchases` (課程類 → `remaining_hours = session_hours * quantity`; 用品 → decrement `products.stock`, 400 「庫存不足」). On success invalidates `my-purchases` + `products` and routes to 我的商品.

Also done: `ProductForm`, `PurchaseEntry`, `SubmitBooking`, `BookingReviewDetail`, `MemberDetail`, `CoachForm`. `ProductForm` 分類 is 團體課程/課程/用品: **團體課程** picks a `course_id` — only 上架 courses are offered (edit mode also keeps the currently-bound one), and the backend `_normalize_product_fields` rejects binding a **new** non-上架 course ("只能綁定上架中的課程"; re-saving with the same course is allowed even after it goes 下架) — then shows the course's `session_count` as a read-only 堂數; **課程** takes a free `session_hours` (≥1, 單次課程); **用品** takes `stock`. `SubmitBooking` offers every non-用品 active product; `PurchaseEntry` blocks out-of-stock 用品 options. `MemberDetail` (帳號/密碼/黑名單維護) is the reference for the 會員詳情 design handoff — controlled local state + a sticky save bar that fires only the mutations for fields that actually changed (`PUT /users/{id}` for username, `POST /users/{id}/reset-password`, `PUT /users/{id}/blacklist`). `CoachForm` serves both `/admin/coaches/new` and `/admin/coaches/:id/edit` (edit prefills from the `['coaches']` list cache, shows 綁定帳號 read-only with a 不可變更 tag, adds a card-`extra` id/created line, a dirty-gated 儲存變更, and a 刪除教練資料 button that opens a confirm `Modal` → `DELETE /coaches/{id}`) — same sticky-save-bar shape; on new, 綁定帳號 is a keyword search over `['members']` that dims accounts already bound to a coach.

**系統設定** (`/admin/settings`, `SystemSettings.tsx`) manages a singleton `system_settings` row (`company_name`, `short_name`, `logo_url`) via `GET/PUT /system-settings` (`GET` open to any authenticated user — read by `AppLayout`'s sidebar for both admin and member — `PUT` and `POST /system-settings/upload-logo` admin-only) — same sticky-save-bar/dirty-diff shape as `MemberDetail`, logo upload deferred-to-save like `CoachForm`'s photo picker. The row is lazily get-or-created on first read rather than seeded via migration. Logo uploads accept jpg/png only (no svg, to avoid stored-XSS from inline-rendered SVG).

**課程管理 is being split into 團體課程 and 私人教練課程**: `/admin/courses` now renders `GroupCourseList` — the group-course management list, faithful to the Claude Design spec (`GroupCourseList.dc.html`): name/coach filters + 開課期間 `DatePicker.RangePicker` + status filter, inline 上架/下架 toggle (`PATCH /courses/{id}/status`), cover thumbnail, auto course `code`, capacity range (每堂上限), 課堂數, 開課起訖 + 多星期摘要 (每週一、三、五 …), edit tracking. The old plain `CourseList` table is kept at `/admin/private-courses` as the not-yet-built 私人教練課程 starting point (not in the sidebar menu yet).

**團體課程 新增／編輯／複製 (`CourseForm`, `pages/admin/CourseForm/`)**: 課程資訊 card (name/coach/最低開班/每堂人數上限/單堂時長 (`InputNumber` 分鐘)/介紹/封面 — cover via `POST /courses/upload-cover`, mirrors `coaches/upload-photo`); **課程時段 card = a single 排程規格** (`ScheduleSpecForm`: 上課星期 `Checkbox.Group` 多選 · 上課時間 `Select` (單一) · 開課期間 起日 + 週數/結束日 可切換), NOT a rule list. `CourseForm/lib/recurrence.ts` shrank to `expandSchedule(spec, cancelled, extras, isSlotClosed, confirmedDates)` → `PreviewSession[]` (每個勾選星期在期間內一堂; a 排程 session whose slot is 公休 **and** whose date is not in `confirmedDates` (edit-mode = the already-saved 正常 session dates) is flagged `closedSlot` — **not shown** in the sessions table or the calendar, excluded from 堂數 and from `toSessionPayload`; the gap is surfaced only by the 「開課期間」 summary note 「(N 堂落在公休時段，不會建立)」; so a course keeps its saved 堂數 in edit even if slots close later, and only newly-added dates get flagged; dedup (date, hour)). `SessionsTable` (below, **grouped & ordered by weekday** 週一…週日 then date, with a 週X group header): per-row 停課/恢復 toggle (正常 排程 sessions) + 移除 (加開 sessions) + a 「加開單堂」 `Popover` (`DatePicker`+`Select`, 公休 blocked); `closedSlot` sessions are filtered out entirely. `SchedulePreviewCalendar` is **read-only** — `SlotPicker` with week-nav, 公休 slots greyscale (`cellDisabled`), this course's non-公休 sessions as blocks (停課 → `tone:'gray'` + 「（停課）」). 課程狀態 radio, sticky save bar via `usePageActionBar`. One route component serves `courses/new` · `courses/:id/edit` · `courses/:id/duplicate` (mode from the path). Edit → load spec + sessions from `GET /courses/{id}`; duplicate → prefill info, clear schedule, status 下架. **Editing a course whose saved `status` is 上架 and that still has a future non-cancelled 課堂 locks the whole 課程時段 section read-only** (`ScheduleSpecForm` disabled, no 停課/加開, `Alert` telling the admin to set 下架/草稿 first) — course-info fields and the status radio stay editable. **封存** button → `POST /courses/{id}/archive`; archived courses leave `GroupCourseList` (`?archived=false`) and appear in **`GroupCourseArchive`** (`/admin/courses/archived`, `?archived=true`) with 還原 (`POST /courses/{id}/restore` — back to list, forced 下架) and 永久刪除 (`DELETE /courses/{id}` — archived-only, 409 if any `reservations` reference it). `GroupCourseArchive` (faithful to `GroupCourseArchive.dc.html`: shared course columns + separate 封存時間/封存者/最後編輯時間/編輯者 columns, `showTotal` pager, `RollbackOutlined` 返回, `Empty` empty-state) starts empty until courses are archived.

**Still stub placeholders** (`Card` with a TODO paragraph, ~16 lines) — these are the next things to implement when asked: `CoachPurchaseQuery`, `BookingReviewDetail` (admin); `AddPerson`, `Dashboard` (member). When implementing a form page, check the matching router in `backend/app/routers/` first — `products` has no `DELETE` endpoint by design; `courses` gained `DELETE` (archived-only, reservation-guarded) for the 封存課程 flow.

**堂數帳務 (`app/services/hours.py`)**: **every** change to `purchases.remaining_hours` must go through this module (never assign it directly) so a `hour_ledger` row is written alongside. Its functions only `add`/`flush`; the router commits once at the end, so e.g. 建立預約＋扣抵 is one transaction and rolls back together (400 「剩餘堂數不足」 leaves no reservation behind). Rules: creating a reservation (member submit *or* admin create) with a `purchase_id` deducts `HOURS_PER_RESERVATION` (1 堂, independent of `people_count`) after checking the purchase belongs to `member_id`, is not 用品, and has the same `product_id`; 已拒絕 (review) and 已取消 refund the reservation's **net** ledger amount (idempotent — never refunds more than was deducted); review is only allowed on 待確認. Admin manual correction: `POST /purchases/{id}/adjust` (`change` ≠ 0, `note` required, balance can't go < 0); history: `GET /purchases/{id}/ledger` (members: own only). Tests live in `backend/tests/`. Confirmed business rules (堂數扣抵／退回 etc., with confirmation dates and the tests that pin them) are recorded in **`docs/business-rules.md`** — update that file first if a change alters one of those rules.

**購買付款流程**: admin `POST /purchases` (購買紀錄登錄, `payment_method` required in the form) creates **已付款** and credits `total_hours` at once; member `POST /purchases/self` (購買商品) creates **待付款** with `remaining_hours` 0 — unusable for booking (`deduct_for_reservation` 400 「購買紀錄尚未付款，無法扣抵」) until an admin calls `POST /purchases/{id}/confirm-payment` (`payment_method` required, `payment_note` optional) from **購買紀錄** (`/admin/purchases`, `PurchaseList.tsx`, sidebar item; `Segmented` filter 待付款/已付款/已取消/全部, defaults to 待付款), which credits `total_hours` via `record_purchase`. `POST /purchases/{id}/cancel` (admin any, member own) only works on 待付款 and returns 用品 stock. `GET /purchases` accepts `payment_status` and returns newest first. `adjust` only works on 已付款. Members see 付款狀態 and can 取消訂單 in 我的商品. `StatusTag` also colours 待付款/已付款. Rules R4–R7 in `docs/business-rules.md` are still 待確認.

**Server timestamps are naive UTC** (`datetime.utcnow()`): always display them with `formatServerTime()` from `frontend/src/lib/datetime.ts` (dayjs utc → local), never `dayjs(value).format(...)` directly — that shows UTC as local time (8 hours off in Taipei).

**Known backend gaps**: add-on people (`reservation_addons`) don't yet decrement hours; no refund flow for 已付款 purchases.
