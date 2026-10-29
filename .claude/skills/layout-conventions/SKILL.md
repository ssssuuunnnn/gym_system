---
name: layout-conventions
description: Durable rules for this repo's two layout shells — the back office (frontend/src/components/BackOfficeShell.tsx, configured by AppLayout.tsx for gym admins and platform/PlatformLayout.tsx for the platform console — fixed/sticky header with scroll-triggered backdrop-blur "frosted glass" treatment, user-collapsible left sidebar/menu with icon-only collapsed state, and design-token usage) and the member/coach front end (frontend/src/components/member/MemberLayout.tsx — mobile-first column, bottom tab bar, per-mode theme). TRIGGER — use whenever building or adjusting BackOfficeShell.tsx, AppLayout.tsx, PlatformLayout.tsx or MemberLayout.tsx, any admin, platform or member page's structure/chrome, the header, the sidebar/Sider/Menu, collapse/toggle behavior, or anything visually derived from the PulseFit design handoff in gym-system-design/. Also use when asked to align the app's layout/header/sidebar with the design guideline or the Claude Design prototype.
---

# Layout conventions

This repo has **exactly two** layout shells — don't add a third for a role or a page:

- **後台 `frontend/src/components/BackOfficeShell.tsx`** — the desktop back office: sticky header + collapsible sidebar + sticky page action bar. It takes `menuItems` / `brandName` / `brandLogoUrl` / `userLabel` / `headerExtra` / `onLogout` and is configured by two thin wrappers: `AppLayout.tsx` (gym admins, `/admin/*`, brand from 系統設定) and `platform/PlatformLayout.tsx` (platform console on `platform.<BASE_DOMAIN>`, ADR 0002). A new back-office surface gets a new thin wrapper, never a copy of the shell. The rest of this file (header, sidebar, tokens) is about this shell.
- **前台 `frontend/src/components/member/MemberLayout.tsx`** — members and coaches (`/member/*` with `mode="member"`, `/coach/*` with `mode="coach"`). See "Front-end shell" at the end.

Members and coaches use their phones, so the front end is a separate, mobile-first shell rather than the admin sidebar layout restyled (decided 2026-10-24 with a Claude Design mockup, 「健身工作室前台設計稿」).

These are standing rules for this shell, not a record of a past change. Apply them any time you touch `BackOfficeShell.tsx` / `AppLayout.tsx` / `PlatformLayout.tsx` or add a page that needs to fit inside them.

## Header: fixed + scroll-triggered frosted glass

- The header is fixed/sticky to the top of the viewport — it must not scroll away with page content.
- At rest (page not scrolled), the header stays in its normal opaque state.
- Once the content area has scrolled past a **4px** threshold, the header switches to a semi-transparent, blurred "frosted glass" treatment: `backdrop-filter: blur(18px) saturate(180%)` (with `-webkit-backdrop-filter` for Safari), a translucent white background, a hairline translucent bottom border, and the header shadow token — replacing the flat opaque background and no-shadow state used at rest. Transition the background/shadow change, don't snap it.
- This is a deliberate, header-only exception to the design system's general "no transparency/blur" rule — don't extend blur effects to other components (cards, modals, etc.) on the strength of this pattern.
- This behavior is reference-implemented (as a working, dependency-free React prototype) in `gym-system-design/project/ui_kits/dashboard/DashboardLayout.jsx` — read it before re-deriving the scroll-listener/threshold logic from scratch. It is not directly copy-pasteable: it's raw `React.createElement` div/absolute-positioning, not Ant Design `Layout`/`Header`/`Sider`/`Content`, so translate the technique (scroll listener on the scrolling container, boolean `scrolled` state past the threshold, conditional inline styles) rather than porting the markup.

## Sidebar: user-collapsible, not just breakpoint-driven

- The left sidebar/menu must be collapsible via an explicit toggle control the user clicks — not only auto-collapsing at a viewport breakpoint. (The current implementation only does the latter via `Sider`'s `breakpoint`/`collapsedWidth`; that alone does not satisfy this convention.)
- Collapsed state shows icon-only nav items (no text labels); a toggle control lives at the bottom of the sidebar to expand/collapse it, matching the prototype's placement and icon-swap (fold/unfold icon depending on state).
- Navigation can be grouped: `BackOfficeShell` `menuItems` may nest one level (`children` = a collapsible group, popping out when the sider is collapsed). The gym admin sidebar adds 釘選 / 最近使用 groups and remembers user-toggled groups in browser storage; menu structure and grouping live in `components/adminMenu.tsx`, never hard-coded in the shell.
- Sidebar width switches between an expanded and a collapsed width — see the design guideline for the exact pixel values (do not hardcode them independently in multiple places; source from tokens/guideline).

## Tokens: don't duplicate values, reference the guideline

- Colors, spacing, radius, shadow, and layout metrics (header height, sider width expanded/collapsed, content padding) are defined in `gym-system-design/DESIGN_GUIDELINES.md`. Treat that file as the single source of truth for these values.
- When implementing or reviewing layout/style code, reference the guideline's token names/values rather than re-deriving or hardcoding numbers inline — if a needed value isn't in the guideline yet, add it there (or ask) instead of inventing a one-off number in component code.
- The underlying design tokens also exist as CSS custom properties in `gym-system-design/project/tokens/*.css` (colors.css, spacing.css, radius.css, shadow.css, typography.css, base.css) — these are the primary source the guideline doc is built from.

## Front-end shell (`MemberLayout`)

- **Mobile first**: one content column, `maxWidth` = `FRONT_MAX_WIDTH` (560px) centred on desktop, `padding: 24px 16px` plus room for the tab bar and `env(safe-area-inset-bottom)`. No sidebar, no global header — each page renders its own `FrontPageHeader`.
- **Bottom tab bar**, fixed, same width as the column, 3–4 `NavLink` tabs (icon + 11px label, ≥44px touch target). Member tabs: 首頁 / 預約課程 / 我的預約 / 我的. Coach tabs: 今日課表 / 簽到紀錄 / 我的鐘點 (only 私人教練／團體課程教練 — read from `GET /coaches/me`) / 我的. Add a tab only for a top-level task; everything else is reached from a page or from 我的.
- **Theme per mode** via a nested `ConfigProvider` with `FRONT_THEMES[mode]` from `components/member/memberTheme.ts` — the single place front-end colours live (member `#0958d9`, coach `#006d75`, darker status colours for contrast, Noto Sans TC, radius 12/16, control height 44). Components read them with `theme.useToken()`; never hard-code a front-end hex in a component.
- **Guards** live in the shell: `mustChangePassword` → `/member/change-password`; `mode="coach"` without `isCoach` → `/member/dashboard`. Coaches land in `/coach/today` after login and switch modes from 我的.
- **Building blocks** (`components/member/`): `FrontPageHeader`, `FrontCard` (white, radius LG, no border/shadow; `highlighted` = 2px primary ring), `CoverTile`. Prefer cards and big tap targets over tables on front-end pages.

## Scope note

This skill covers layout/chrome conventions only (the shell, header, sidebar). It does not cover page-level content conventions (tables, forms, list-page shape) — see the "Frontend conventions" section of `CLAUDE.md` for those.
