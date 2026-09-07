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

# Backend: no automated test suite exists yet — verify endpoints with curl
# against the running backend container (http://localhost:8000/docs has the
# interactive schema).

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

## Data model (10 tables)

`users` (admin/member, `is_coach` is a **derived** value — true iff a `coaches` row references the user, not a stored column; `is_blacklisted` and `must_change_password` are stored flags the admin sets from 會員詳情) · `coaches` (`user_id` bind is unique; plus `name`, `alias` 授課名稱, `line_name`, `phone`, `bank_code`/`bank_account` 匯款帳號, `specialty` 專長, `photo_url`) · `products` (catalog: category enum, `session_hours`, price) · `purchases` (a member's purchased session-hours, `remaining_hours` decremented/incremented as reservations are created/cancelled) · `time_slots` (weekly open/closed template, `day_of_week` 1–6 + `start_hour` 10–21, **row absence = open by default**) · `courses` (團體課程 bound to a coach: auto `code` `GC-YYYY-NNN`, `status` 上架/下架/草稿, `min`/`max_capacity`, `duration_minutes`, `session_count`, `start_date`/`end_date`, `description`, `cover_image_url`, `updated_by_name`, `is_archived`/`archived_at`/`archived_by_name`; `day_of_week`/`start_hour` are the **denormalised "primary slot"** = first session's weekday/hour, both nullable for a draft with no sessions; `session_count`/`start_date`/`end_date` are re-derived from `course_sessions` on every save; enrolled headcount is **derived** from `reservations`) · `course_schedule_rules` (a course's 排課規則 rows: `position`, `start_date`, `start_minute`, `frequency` weekly/biweekly, `end_mode` count/date, `week_count`/`end_date`) · `course_sessions` (the resolved 課堂 list: `session_date`, `start_minute`, `duration_minutes`, `source` rule/extra, `rule_position`, `adjusted` + `origin_date`/`origin_minute`; both child tables FK `ON DELETE CASCADE`) · `reservations` (status: 待確認/已確認/已拒絕/已取消; source: member_submitted/admin_created) · `reservation_addons` (coach-only "臨時加人" add-on).

**Enum columns store the Python enum *member name*, not the Chinese `.value`** (SQLAlchemy default): e.g. `courses.status` is stored as `on`/`off`/`draft`, `reservations.status` as `pending`/`confirmed`/… — the API layer (Pydantic `XOut`) serializes back to the Chinese value. Alembic `sa.Enum(...)` declarations, raw SQL, and seed inserts must use the names.

**`day_of_week` is ISO-8601: `1` = 週一 … `7` = 週日** (`courses`, `time_slots`). Frontend labels come from `frontend/src/lib/weekday.ts` (`weekdayLabel` / `WEEKDAY_SHORT_MON_FIRST`) — don't re-declare weekday arrays per file.

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

`components/SlotPicker.tsx` is the canonical week grid — a dated 7-day time grid (`dates: Dayjs[]` × 10:00–21:00) composed from the `components/calendar/` atoms (`TimeAxis`, `DayHeaderCell`, `TimeSlotCell`, `NowIndicator`, `EventBlock`); `SlotState` = `open | closed`. Optional `cellEvents(date, hour) => SlotEvent[]` prop overlays `EventBlock`s (side-by-side via `colIndex`/`colCount`; a `SlotEvent` without `onClick` gets `pointerEvents:none` so the cell stays clickable, one with `onClick` is itself clickable — `CourseForm` uses that to remove a 課堂) — `SlotSettings` uses it to show existing reservations + courses on closed cells. `SlotSettings` owns the week nav + `MiniCalendar` + legend layout. Extend `SlotPicker`/`TimeSlotCell` rather than building a parallel grid component.

`components/InlineRuleList.tsx` (`InlineRuleList` + `InlineRuleRow`) is the shared chrome for a **numbered setting-row list** — a soft panel with title/description, rows each carrying a `規則 N` / `設定 N` chip (`chipPrefix` via context) and a trailing delete button, plus a dashed 新增一列 button. Row *contents* stay with the caller. Used by `CourseForm`'s `ScheduleRulesEditor` (排課規則) and `Availability`'s 快速設定 (批次關閉); reuse it for any future batch-rule editor rather than re-styling a panel.

`components/courseColumns.tsx` (`sharedCourseColumns({ coachNameById })`) + `components/CourseCoverThumb.tsx` are the 7 course-row columns (封面 / 課程名稱 / 教練 / 開班人數 / 課程介紹 / 課堂數 / 開課時間) shared by `GroupCourseList` and `GroupCourseArchive`; each page spreads them then appends its own columns (狀態＋操作 / 封存資訊＋還原刪除).

`components/calendar/` holds 8 presentational scheduling atoms imported from the PulseFit design system (`TimeAxis`, `TimeSlotCell`, `DayHeaderCell`, `EventBlock`, `EventChip`, `NowIndicator`, `MonthDayCell`, `MiniCalendar`) — colours/radius/font via `theme.useToken()`, no global CSS. See `components/calendar/README.md`.

When **authoring or reviewing a UI component** (not a page screen), follow the `component-conventions` skill: where it lives (shared `frontend/src/components/` for 2+ consumers vs. page-scoped `frontend/src/pages/<Area>/<Page>/components/` for a single consumer), reach for an Ant Design component before hand-rolling, colours/radius via `theme.useToken()` (no hardcoded hex), `dayjs` for all date work, one shared source for constants/helpers, controlled props-driven components, and "one concept, one component". The layout shell (`AppLayout.tsx`, header, sidebar) has its own `layout-conventions` skill.

## Implementation status

**Done**: all list/read screens — CoachList, ProductList, MemberList, BookingReviewList, SlotSettings, GroupCourseList, GroupCourseArchive (admin); MyBookings, MyProducts (member); Login/Register. Implemented forms/flows: ProductForm, PurchaseEntry, CreateBooking, CourseForm (admin); SubmitBooking (member).

Also done: `ProductForm`, `PurchaseEntry`, `SubmitBooking`, `BookingReviewDetail`, `MemberDetail`, `CoachForm`. `MemberDetail` (帳號/密碼/黑名單維護) is the reference for the 會員詳情 design handoff — controlled local state + a sticky save bar that fires only the mutations for fields that actually changed (`PUT /users/{id}` for username, `POST /users/{id}/reset-password`, `PUT /users/{id}/blacklist`). `CoachForm` serves both `/admin/coaches/new` and `/admin/coaches/:id/edit` (edit prefills from the `['coaches']` list cache, shows 綁定帳號 read-only with a 不可變更 tag, adds a card-`extra` id/created line, a dirty-gated 儲存變更, and a 刪除教練資料 button that opens a confirm `Modal` → `DELETE /coaches/{id}`) — same sticky-save-bar shape; on new, 綁定帳號 is a keyword search over `['members']` that dims accounts already bound to a coach.

**系統設定** (`/admin/settings`, `SystemSettings.tsx`) manages a singleton `system_settings` row (`company_name`, `short_name`, `logo_url`) via `GET/PUT /system-settings` (`GET` open to any authenticated user — read by `AppLayout`'s sidebar for both admin and member — `PUT` and `POST /system-settings/upload-logo` admin-only) — same sticky-save-bar/dirty-diff shape as `MemberDetail`, logo upload deferred-to-save like `CoachForm`'s photo picker. The row is lazily get-or-created on first read rather than seeded via migration. Logo uploads accept jpg/png only (no svg, to avoid stored-XSS from inline-rendered SVG).

**課程管理 is being split into 團體課程 and 私人教練課程**: `/admin/courses` now renders `GroupCourseList` — the group-course management list, faithful to the Claude Design spec (`GroupCourseList.dc.html`): name/coach filters + 開課期間 `DatePicker.RangePicker` + status filter, inline 上架/下架 toggle (`PATCH /courses/{id}/status`), cover thumbnail, auto course `code`, capacity range, 課堂數, 開課起訖, edit tracking, derived enrolled headcount. The old plain `CourseList` table is kept at `/admin/private-courses` as the not-yet-built 私人教練課程 starting point (not in the sidebar menu yet).

**團體課程 新增／編輯／複製 (`CourseForm`, `pages/admin/CourseForm/`)** implements the Claude Design `GroupCourseCreate`/`GroupCourseEdit`/`GroupCourseDuplicate` specs: 課程資訊 card (name/coach/capacity/單堂時長/介紹/封面 — cover via `POST /courses/upload-cover`, mirrors `coaches/upload-photo`), 課程時段 card with a **recurrence engine** (`CourseForm/lib/recurrence.ts` — multi-row 排課規則 → expanded 課堂, per-session date/time overrides "已調整", single-session add/remove on a week calendar — the shared `SlotPicker` with a week-nav 上一週/下一週/回到今天 `Space`, `cellState` always `open`, `cellEvents` carrying an `onClick` to remove that 課堂), 開課時間 sessions table, 課程狀態 radio, sticky save bar via `usePageActionBar`. One route component serves `courses/new` · `courses/:id/edit` · `courses/:id/duplicate` (mode from the path). Edit → load exact rules+sessions from `GET /courses/{id}`; duplicate → prefill info, clear schedule, status 下架. **封存** button → `POST /courses/{id}/archive`; archived courses leave `GroupCourseList` (`?archived=false`) and appear in **`GroupCourseArchive`** (`/admin/courses/archived`, `?archived=true`) with 還原 (`POST /courses/{id}/restore` — back to list, forced 下架) and 永久刪除 (`DELETE /courses/{id}` — archived-only, 409 if any `reservations` reference it). `GroupCourseArchive` (faithful to `GroupCourseArchive.dc.html`: shared course columns + separate 封存時間/封存者/最後編輯時間/編輯者 columns, `showTotal` pager, `RollbackOutlined` 返回, `Empty` empty-state) starts empty until courses are archived.

**Still stub placeholders** (`Card` with a TODO paragraph, ~16 lines) — these are the next things to implement when asked: `CoachPurchaseQuery`, `BookingReviewDetail` (admin); `AddPerson`, `Dashboard` (member). When implementing a form page, check the matching router in `backend/app/routers/` first — `products` has no `DELETE` endpoint by design; `courses` gained `DELETE` (archived-only, reservation-guarded) for the 封存課程 flow.

**Known backend gaps** (see README "尚未實作"): purchase/reservation creation aren't wrapped in a single DB transaction; add-on people (`reservation_addons`) don't yet decrement `purchase.remaining_hours`; no automated test suite yet.
