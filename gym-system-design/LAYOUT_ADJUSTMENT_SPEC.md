# AppLayout adjustment spec: fixed/blur header, collapsible sidebar, design-token styling

Status: **spec only — not implemented.** No app code has been changed. This document describes what should change in `frontend/src/components/AppLayout.tsx` (and possibly `frontend/src/main.tsx`/`App.tsx` for `ConfigProvider`) to satisfy three requirements, plus open questions the user should confirm before implementation begins.

Companion skill (durable rules, not task steps): `.claude/skills/layout-conventions/SKILL.md`.

## Current state (baseline)

`frontend/src/components/AppLayout.tsx` today:
- Outer `Layout` with `minHeight: '100vh'` (no fixed height, no internal scroll container — the whole page/body scrolls).
- `Sider` with `breakpoint="lg" collapsedWidth="0"` only — collapses automatically at a viewport breakpoint, no manual toggle, no `collapsible`/`trigger` props used, dark themed (`theme` prop not set on `Sider` itself, but `Menu` inside is `theme="dark"`; `Sider`'s own default background is Ant's dark sider color since no `theme="light"` override).
- `Header` is plain, non-fixed, opaque white, no shadow, scrolls away with the page (it's a sibling in normal flow, not fixed/absolute/sticky).
- `Content` has `margin: 16` only, no scroll handling, no padding calculated against a fixed header.
- No `ConfigProvider` anywhere in the frontend (confirm during implementation with a repo-wide search of `main.tsx`/`App.tsx`) — Ant Design is currently running on its own default theme tokens, not the PulseFit/design-guideline tokens.

Reference prototype: `gym-system-design/project/ui_kits/dashboard/DashboardLayout.jsx` (raw `React.createElement`, no build step — read it for the *mechanism*, not as portable markup, since it doesn't use antd `Layout` primitives at all).

## Requirement 1 — Fixed header with scroll-triggered frosted glass

**RESOLVED** (superseding the two open questions originally raised below): use `position: sticky`, keep today's normal page-level (`<body>`) scroll — do **not** restructure `Content` into its own `overflow:auto` pane. `position: sticky` sticks relative to the nearest scrolling ancestor, which is the viewport by default as long as no ancestor sets `overflow`; since none of `Layout`/`Sider`/`Content` currently do, sticky "just works" with the existing scroll model. This avoids the prototype's `fixed` + manual left-offset math (the prototype needs it only because its sider is a plain flex sibling div, not an antd `Sider`) and avoids the scroll-model change (and its regression risk — `window.scrollY` usage, scroll-restoration on route change, browser "scroll to top" shortcuts) that a content-pane scroll container would introduce.

**Mechanism:**
- `Header` gets `position: 'sticky', top: 0, zIndex: 10` in its `style` prop. No left-offset math needed — it already sits correctly inside antd's inner `Layout` (right of `Sider`) because sticky respects normal flow/flex sizing, unlike `fixed`.
- **Scroll detection**: attach a `scroll` listener to `window` (`useEffect` + `window.addEventListener('scroll', ...)`, cleaned up on unmount) rather than to a content scroll container. Check `window.scrollY > 4` (or `document.documentElement.scrollTop`, cross-browser).
- **State**: `const [scrolled, setScrolled] = useState(false)`, set via the `window` scroll handler checking `> 4` (4px threshold, per the prototype's `e.target.scrollTop>4` — same numeric threshold, different event target).
- **Style toggle driven by `scrolled`**, matching the prototype's values:
  - At rest: opaque header background (design-guideline header-bg token), no shadow, transparent/no border.
  - Scrolled: `background: rgba(255,255,255,0.45)` (or the guideline's equivalent translucent token if one exists), `backdropFilter: 'blur(18px) saturate(180%)'` + `WebkitBackdropFilter` for Safari, `boxShadow` set to the design guideline's header shadow token, `borderBottom: '1px solid rgba(255,255,255,0.3)'`.
  - Transition the background/box-shadow (not an abrupt snap) — prototype uses `transition: 'background .25s, box-shadow .25s'`.
- Header height, and the padding-top added to `Content` to clear the fixed/sticky header, should come from the design guideline's header-height token (prototype: 64px) rather than a new hardcoded number.

## Requirement 2 — User-collapsible sidebar (icon-only collapsed)

**Mechanism needed:**
- Add `const [collapsed, setCollapsed] = useState(false)` in `AppLayout`.
- Antd's `Sider` already supports this natively: `collapsible`, `collapsed`, `onCollapse` props. **RESOLVED — use antd's built-in default trigger** (`collapsible` + `collapsed`/`onCollapse`, zero extra markup), per user confirmation. Do not suppress it with `trigger={null}` or build a custom bottom-of-sider row — the prototype's pixel-exact custom trigger is explicitly not being pursued; the built-in trigger's default look/position (small arrow bar docked at the bottom-center edge of the Sider) is accepted as-is.
- Keep `breakpoint="lg" collapsedWidth="0"` alongside the new manual `collapsed`/`onCollapse` state — both coexist fine (see Decision 8 below); small viewports still auto-hide to width-0, manual toggle still works above that breakpoint.
- Collapsed width: drive from the design guideline's sider-collapsed-width token (56px, `gym-system-design/DESIGN_GUIDELINES.md` §6) rather than antd's `collapsedWidth` default (80px) or `0`.
- Expanded width: drive from the design guideline's sider-width token (208px, §6) via `width` prop, rather than antd's default (200px).
- Menu items render icon-only automatically when `Sider` is `collapsed` — antd's `Menu` already hides labels in that state as long as each item has an `icon`. **Current menu item objects (`adminMenuItems`/`memberMenuItems`) have no `icon` field at all** — this must be added (one icon per nav entry) for collapsed-icon-only to be meaningful; today collapsing would just show blank rows. **RESOLVED — icon source is `@ant-design/icons`** (see Decision 6 below and `gym-system-design/DESIGN_GUIDELINES.md` §9's Remix-Icon-to-`@ant-design/icons` mapping table), not Remix Icon/CDN.

## Requirement 3 — Styling follows the design guideline (colors/spacing/radius/shadow)

**Mechanism needed:**
- No `ConfigProvider` currently wraps the app (verify at `frontend/src/main.tsx`). Introduce `<ConfigProvider theme={{ token: { ... } }}>` at the app root (wrapping `<RouterProvider>` or equivalent), mapping the design guideline's tokens to antd's theme token API: e.g. guideline primary color → antd `colorPrimary`, guideline base radius → antd `borderRadius`, guideline base font → `fontFamily`, etc. Exact token-name mapping should be produced once `gym-system-design/DESIGN_GUIDELINES.md` exists (it's being authored concurrently by another workstream) — don't hand-map from the raw `tokens/*.css` files in a way that will drift from the guideline doc.
- For values `ConfigProvider`'s theme token API doesn't cover directly (e.g. the header's frosted-glass rgba/blur values, exact shadow strings, layout metrics like header height/sider width), continue applying them as inline `style` / CSS on `AppLayout.tsx` itself, sourced from the guideline doc's token values, not invented independently.
- `Sider` theme: **RESOLVED — switch to light**, per user confirmation. The prototype uses a **light** sider (`--sider-bg:#ffffff`) with a bordered right edge; the current production `AppLayout` uses antd's **dark** default `Sider`/`Menu` (`theme="dark"` on `Menu`). Set `Sider`'s own background to `--sider-bg` (`#ffffff`) with a `1px solid --sider-border` right edge, change `Menu`'s `theme` to `"light"`, and let text/icon colors follow the design guideline's neutral text tokens (§1.3) for contrast on the white background.
- Content area background (guideline: light gray `bg-layout`, cards/header white) vs. current `Content`'s implicit antd default — confirm against the guideline once published.

## Decisions (all resolved — ready to implement)

1. **Fixed vs. sticky header**: resolved — `sticky`, no scroll-model change. See Requirement 1 above.
2. **Page-level vs. content-pane scroll**: resolved — kept page-level (`window`) scroll, no restructuring. See Requirement 1 above.
3. **Blur threshold configurability**: hardcoded local constant (`4`), matching the prototype. No caller needs it configurable.
4. **Sidebar theme**: resolved — light, per user confirmation. See Requirement 3 above.
5. **Collapse trigger**: resolved — use antd's built-in default `collapsible` trigger (not a custom bottom-row), per user confirmation. Simpler, less code to maintain; visual mismatch with the prototype's custom fold/unfold row is accepted.
6. **Icon set for menu items**: resolved — `@ant-design/icons`, per `gym-system-design/DESIGN_GUIDELINES.md` §9 and user confirmation (dashboard menu item icon: `DashboardOutlined`, per `gym-system-design/ADMIN_DASHBOARD_SPEC.md`). Each `adminMenuItems`/`memberMenuItems` entry needs an `icon` field added — required for antd's built-in collapse trigger's icon-only collapsed state to render meaningfully (item 5 above).
7. **`ConfigProvider` token mapping**: resolved — `gym-system-design/DESIGN_GUIDELINES.md` §1.6 has the exact `theme.token` object to use.
8. **Small-viewport behavior**: keep today's `breakpoint="lg" collapsedWidth="0"` (auto-hide sidebar entirely below `lg`) alongside the new manual collapsed-to-icon-only toggle — both antd features compose fine together; no reason raised to change small-viewport behavior.
9. **Frosted-glass rgba on non-white content backgrounds**: not an issue — the guideline's `--bg-layout` (`#f5f5f5`) is near-white, and no separate "glass"/"overlay" token exists in the guideline, so the prototype's `rgba(255,255,255,0.45)` is used as-is.
