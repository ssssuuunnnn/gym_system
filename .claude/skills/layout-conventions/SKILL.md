---
name: layout-conventions
description: Durable rules for this repo's site-wide layout shell (frontend/src/components/AppLayout.tsx) — fixed/sticky header with scroll-triggered backdrop-blur "frosted glass" treatment, user-collapsible left sidebar/menu with icon-only collapsed state, and design-token usage. TRIGGER — use whenever building or adjusting AppLayout.tsx, any admin or member page's structure/chrome, the header, the sidebar/Sider/Menu, collapse/toggle behavior, or anything visually derived from the PulseFit design handoff in gym-system-design/. Also use when asked to align the app's layout/header/sidebar with the design guideline or the Claude Design prototype.
---

# Layout conventions

This repo has **one** site-wide layout shell: `frontend/src/components/AppLayout.tsx`. It wraps both the `/admin/*` and `/member/*` route trees (see `frontend/src/router/index.tsx` — both role trees render `<AppLayout />` with their own `children`, switching only the sidebar menu items by `role`). Do not create a second layout component for a role or a page — extend `AppLayout.tsx` and gate what differs (menu items, labels) on `role`/`isCoach` from `useAuthStore`, the way it already does.

These are standing rules for this shell, not a record of a past change. Apply them any time you touch `AppLayout.tsx` or add a page that needs to fit inside it.

## Header: fixed + scroll-triggered frosted glass

- The header is fixed/sticky to the top of the viewport — it must not scroll away with page content.
- At rest (page not scrolled), the header stays in its normal opaque state.
- Once the content area has scrolled past a **4px** threshold, the header switches to a semi-transparent, blurred "frosted glass" treatment: `backdrop-filter: blur(18px) saturate(180%)` (with `-webkit-backdrop-filter` for Safari), a translucent white background, a hairline translucent bottom border, and the header shadow token — replacing the flat opaque background and no-shadow state used at rest. Transition the background/shadow change, don't snap it.
- This is a deliberate, header-only exception to the design system's general "no transparency/blur" rule — don't extend blur effects to other components (cards, modals, etc.) on the strength of this pattern.
- This behavior is reference-implemented (as a working, dependency-free React prototype) in `gym-system-design/project/ui_kits/dashboard/DashboardLayout.jsx` — read it before re-deriving the scroll-listener/threshold logic from scratch. It is not directly copy-pasteable: it's raw `React.createElement` div/absolute-positioning, not Ant Design `Layout`/`Header`/`Sider`/`Content`, so translate the technique (scroll listener on the scrolling container, boolean `scrolled` state past the threshold, conditional inline styles) rather than porting the markup.

## Sidebar: user-collapsible, not just breakpoint-driven

- The left sidebar/menu must be collapsible via an explicit toggle control the user clicks — not only auto-collapsing at a viewport breakpoint. (The current implementation only does the latter via `Sider`'s `breakpoint`/`collapsedWidth`; that alone does not satisfy this convention.)
- Collapsed state shows icon-only nav items (no text labels); a toggle control lives at the bottom of the sidebar to expand/collapse it, matching the prototype's placement and icon-swap (fold/unfold icon depending on state).
- Sidebar width switches between an expanded and a collapsed width — see the design guideline for the exact pixel values (do not hardcode them independently in multiple places; source from tokens/guideline).

## Tokens: don't duplicate values, reference the guideline

- Colors, spacing, radius, shadow, and layout metrics (header height, sider width expanded/collapsed, content padding) are defined in `gym-system-design/DESIGN_GUIDELINES.md`. Treat that file as the single source of truth for these values.
- When implementing or reviewing layout/style code, reference the guideline's token names/values rather than re-deriving or hardcoding numbers inline — if a needed value isn't in the guideline yet, add it there (or ask) instead of inventing a one-off number in component code.
- The underlying design tokens also exist as CSS custom properties in `gym-system-design/project/tokens/*.css` (colors.css, spacing.css, radius.css, shadow.css, typography.css, base.css) — these are the primary source the guideline doc is built from.

## Scope note

This skill covers layout/chrome conventions only (the shell, header, sidebar). It does not cover page-level content conventions (tables, forms, list-page shape) — see the "Frontend conventions" section of `CLAUDE.md` for those.
