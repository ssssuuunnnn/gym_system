# Copilot Instructions — 健身工作室管理系統

This is a fitness studio booking/management system: **FastAPI (Python) + MySQL** backend, **React + TypeScript + Ant Design (Vite)** frontend, Docker Compose for local orchestration. All identifiers, UI copy, and comments in this repo are in **Traditional Chinese** — match that convention in new code.

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
  components/     shared UI: AppLayout (sidebar+header), SlotPicker (weekly grid), StatusTag
  store/auth.ts   zustand store, persisted to localStorage (login survives refresh)
  router/index.tsx   route table; RequireRole.tsx guards by role
```

Every backend resource follows the same triad: `models/X.py` (table) → `schemas/X.py` (`XCreate` / `XUpdate` / `XOut`) → `routers/X.py` (registered in `main.py` under `API_V1_PREFIX` = `/api/v1`). Follow this triad for any new resource.

## Data model (8 tables)

`users` (admin/member, `is_coach` is a **derived** value — true iff a `coaches` row references the user, not a stored column) · `coaches` · `products` (catalog: category enum, `session_hours`, price) · `purchases` (a member's purchased session-hours, `remaining_hours` decremented/incremented as reservations are created/cancelled) · `time_slots` (weekly open/closed template, `day_of_week` 1–6 + `start_hour` 10–21, **row absence = open by default**) · `courses` (recurring group class template bound to a coach) · `reservations` (status: 待確認/已確認/已拒絕/已取消; source: member_submitted/admin_created) · `reservation_addons` (coach-only "臨時加人" add-on).

## Auth & permission model

JWT bearer tokens (`app/core/security.py`), role = `admin` | `member`. Key dependencies in `deps.py`:
- `get_current_user` — any authenticated, non-blacklisted user
- `require_admin` — admin only
- `require_coach` — member with a bound `coaches` row

**Established pattern for list/read endpoints that both admins and members need** (see `routers/purchases.py`, `reservations.py`, `coaches.py`, `products.py`, `courses.py`): the route itself only requires `get_current_user`; inside the handler, non-admins are **silently scoped to their own data** (e.g. `purchases`/`reservations` force-filter by `current_user.id`, ignoring any different id passed in). Mutations (`POST`/`PUT`/`DELETE`) stay `require_admin`-gated per-route. Follow this pattern rather than gating an entire router with a single `dependencies=[Depends(require_admin)]` — several routers used to do that and it silently broke member-facing pages that needed read access to catalog data (coaches/products/courses) or their own purchases/reservations.

`time_slots` is the single source of truth for slot availability — read by the settings screen, the reservation-review screens, and reservation creation (both member submit and admin create) alike.

## Frontend conventions

Every list page follows the same shape (see `pages/admin/CoachList.tsx`, `BookingReviewList.tsx`, `MemberList.tsx` as references):
- `useQuery` (TanStack Query) for data fetching, keyed by resource name
- Antd `Table` with typed `ColumnsType<T>`
- Name/label lookups for foreign keys done client-side via `Map` built from a sibling `useQuery` (e.g. `coachNameById`), since API responses return raw ids
- Mutations via `useMutation` + `queryClient.invalidateQueries` on success, `message.success/error` for feedback
- `Popconfirm` for destructive/state-changing actions (approve/reject/cancel)

`api/*.ts` files are thin: exported TS interfaces mirroring the backend `XOut` schema, plus one async function per endpoint using the shared `apiClient` (axios instance in `api/client.ts` with JWT-injecting request interceptor and 401→logout response interceptor).

`components/SlotPicker.tsx` is the canonical weekly grid (週一–週六 × 10:00–21:00) — reused for both the read-only reservation views and the admin `SlotSettings` toggle-to-open/close screen. Extend its `SlotState` union rather than building a parallel grid component.

## Implementation status

**Done**: all list/read screens — CoachList, ProductList, CourseList, MemberList, BookingReviewList, SlotSettings (admin); MyBookings, MyProducts, Dashboard stub aside (member); Login/Register.

**Still stub placeholders** (`Card` with a TODO paragraph, ~16 lines) — these are the next things to implement when asked: `CoachForm`, `ProductForm`, `CourseForm`, `PurchaseEntry`, `CoachPurchaseQuery`, `CreateBooking`, `BookingReviewDetail`, `MemberDetail` (admin); `SubmitBooking`, `AddPerson`, `Dashboard` (member). When implementing a form page, check the matching router in `backend/app/routers/` first — several resources (`courses`, `products`) have no `DELETE` endpoint by design.

**Known backend gaps** (see README "尚未實作"): purchase/reservation creation aren't wrapped in a single DB transaction; add-on people (`reservation_addons`) don't yet decrement `purchase.remaining_hours`; no automated test suite yet.

## Dev workflow

- **Always use Docker for running the full stack**: `docker compose up --build`. Services: `mysql` (3306), `backend` (8000, docs at `/docs`), `frontend` (80, nginx reverse-proxies `/api/*`), `adminer` (8080, DB browsing UI — server `mysql`, default creds `fitness_user`/`changeme`/`fitness_studio` unless overridden by `.env`).
- Admin account is seeded idempotently via `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars at container start (`backend/app/seed_admin.py`); the `/auth/register` endpoint always creates `role=member`.
- Local non-Docker dev uses SQLite by default (`backend/.env` `DATABASE_URL`); MySQL is required for anything resembling production.
- Frontend build check: `cd frontend && npm run build` (runs `tsc -b && vite build`) — run this after any TSX change before considering it done.
- No backend automated tests exist; verify new/changed endpoints with `curl` against the running `backend` container.
