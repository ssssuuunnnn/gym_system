# Building with the PulseFit Design System

This is an **Ant Design–derived** system for a fitness-studio admin/member platform. UI copy is **Traditional Chinese**. Ant Design's own default tokens (seed `#1677FF`, 6px radius, 4px spacing scale) are the foundation.

## Setup — what every screen needs

There is **no provider/wrapper component**. Components read design tokens as CSS custom properties off `:root`, so the only requirement is that **`styles.css` is loaded** (it `@import`s all of `tokens/`). Without it every component renders unstyled (raw `var(--*)` fallbacks, no color).

- Components are exposed as globals on `window.PulseFitDesignSystem_325e30` (e.g. `const { Button, Table, StatusTag } = window.PulseFitDesignSystem_325e30`).
- Icons are **Remix Icon** class names (`ri-*`), loaded from `remixicon.css` via CDN — NOT Ant Design Icons. `Menu` items take `icon` as a `ri-*` **string**; `Button` takes `icon` as a **node**: `icon={<i className="ri-add-line" />}`.
- React 18 must be on `window.React` before the bundle runs.

## Styling idiom — inline styles + token vars, no class vocabulary

This system has **no utility-class layer and no CSS Modules**. Components are styled entirely with inline `style` objects whose values are `var(--token)` references. When you write layout glue around library components, do the same: inline styles, `var(--*)` for every color / size / radius / shadow. Never invent class names — there is no stylesheet to match them against.

Token families (all defined in `tokens/*.css`, listed in `_ds_manifest.json`):

| Family | Examples | Use for |
|---|---|---|
| Color — brand | `--color-primary`, `--color-primary-hover`, `--color-primary-bg`, `--color-primary-border` | primary actions, active states |
| Color — semantic | `--color-success` / `--color-warning` / `--color-error` (+ `-bg` / `-border` each) | status, alerts, `Tag` colors |
| Color — scales | `--blue-1`…`--blue-10`, `--green-*`, `--gold-*`, `--red-*`, `--gray-1`…`--gray-12` | charts, custom fills |
| Text | `--text-primary` `--text-secondary` `--text-tertiary` `--text-quaternary` (alpha-black) | all text color |
| Surface | `--bg-layout` (page) `--bg-container` (cards/header) `--border-color` `--border-secondary` (dividers) | backgrounds, borders |
| Type | `--font-family`, `--font-size-sm/base/lg/xl`, `--font-size-h1`…`--font-size-h5`, `--font-weight-regular/medium/semibold` | text |
| Spacing | `--space-xxs`(4) `--space-xs`(8) `--space-sm`(12) `--space-md`(16) `--space-lg`(24) `--space-xl`(32) `--space-xxl`(48) | gap, padding, margin |
| Radius | `--radius-xs`(2) `--radius-sm`(4) `--radius-base`(6) `--radius-lg`(8) `--radius-round` | corners |
| Shadow | `--shadow-1` (card rest) `--shadow-2` (popover/modal) `--shadow-header` `--shadow-card-hover` | elevation |
| Layout | `--layout-header-height`(64) `--layout-sider-width`(208) `--layout-sider-collapsed-width`(56) `--layout-content-padding`(24) | app shell metrics |

Backgrounds are flat colors only — no gradients, no imagery. Transitions are `.2s` on hover/focus; no entrance animation.

## Where the truth lives

- **`styles.css`** and its `@import`s in **`tokens/`** — the full token set. Read these before styling anything.
- **`components/<group>/<Name>.d.ts`** — the prop contract for each component.
- **`components/<group>/<Name>.prompt.md`** — one-paragraph usage note + a minimal example.
- **`components/app/`** — how this app composes the primitives (`AppLayout`, `SlotPicker`, `StatusTag`), all controlled via props.

## One idiomatic snippet

```jsx
const { Card, Table, StatusTag, Button } = window.PulseFitDesignSystem_325e30;

function ReservationList({ rows, onReview }) {
  return (
    <Card title="預約審核" extra={<Button type="link" icon={<i className="ri-refresh-line" />}>重新整理</Button>}>
      <Table
        columns={[
          { key: 'member', title: '會員' },
          { key: 'slot', title: '時段' },
          { key: 'status', title: '狀態', render: (v) => <StatusTag status={v} /> },
        ]}
        data={rows}
      />
      <div style={{ marginTop: 'var(--space-md)', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
        僅顯示待處理的預約
      </div>
    </Card>
  );
}
```


---

# PulseFit Design System

**PulseFit** is a fitness-studio management platform (health club / gym operations SaaS). This design system was built from scratch — no codebase, Figma file, or brand assets were attached. The brief asked for a React + Ant Design (Antd) admin interface, styled after the layout and visual language of [Ant Design Pro's Analysis Dashboard](https://preview.pro.ant.design/dashboard/analysis). This system implements Ant Design's own default design tokens (seed colors, radius, shadow, spacing) and rebuilds the Analysis Dashboard's layout — sider nav, header, stat cards, trend chart, ranking list — for the gym-management domain in Traditional Chinese.

No brand name, logo, or product content was supplied. "PulseFit" and all copy (menu labels, member names, course names) are placeholders standing in for real product content — swap freely.

## Sources
- No codebase, Figma, or deck attached.
- Visual reference: `https://preview.pro.ant.design/dashboard/analysis` (Ant Design Pro, viewed for layout/rhythm only).
- Token values (color scales, spacing, radius, shadow, type scale) are Ant Design 5's published default design tokens.

## Index
- `styles.css` — root stylesheet, imports everything below.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `radius.css`, `shadow.css`, `base.css` (resets + `@keyframes`).
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand groups in the Design System tab).
- `components/general/` — Button.
- `components/forms/` — Input, Select, Checkbox, Radio, Switch.
- `components/data-display/` — Card, Tag, Badge, Avatar, Statistic, Progress, Table.
- `components/navigation/` — Tabs, Breadcrumb, Menu (sider nav).
- `components/feedback/` — Modal, Tooltip, Alert.
- `components/app/` — StatusTag, SlotPicker, AppLayout (the gym-system app's own composed components, ported from `frontend/src/components/`).
- `ui_kits/dashboard/` — Analysis Dashboard screen (`index.html`, `DashboardLayout.jsx`, `DashboardContent.jsx`).
- `thumbnail.html` — project tile.
- `SKILL.md` — portable skill file for Claude Code.

## Components (22)
**Primitives (19)** — Button · Input · Select · Checkbox · Radio · Switch · Card · Tag · Badge · Avatar · Statistic · Progress · Table · Tabs · Breadcrumb · Menu · Modal · Tooltip · Alert

The primitives are the standard Ant Design set, sized to what an Analysis Dashboard needs — no source defined a fixed inventory, so this is a from-scratch build rather than a recreation.

**App Components (3)** — StatusTag · SlotPicker · AppLayout

Ported from the gym-system frontend's own `frontend/src/components/`. These show how the app composes the primitives: `StatusTag` wraps `Tag` for reservation status; `SlotPicker` is the weekly availability grid; `AppLayout` is the full app shell (role-based sider + sticky frosted-glass header). All three are rewritten as **controlled** components — the real app wires them to `react-router` and the zustand auth store; here they take plain props.

## Content fundamentals
- **Language**: Traditional Chinese (繁體中文) for all UI copy, matching the brief's phrasing. Labels are short and functional: 儀表板, 會員管理, 課程排程, 教練管理, 財務報表, 系統設定.
- **Tone**: neutral, operational, data-forward — like any admin console. No marketing voice, no exclamation points, no emoji.
- **Numbers**: revenue in `NT$` with thousands separators (`386,240`); percentages to one decimal for trends (`+12.4%`), whole numbers for rates (`76%`).
- **Address**: no "you/我們" language — the UI describes data and objects (會員, 課程, 教練), not the reader. Standard admin-dashboard register.
- **Status words**: 已續約 / 即將到期 / 待處理 / 待審核 — short state labels, never full sentences, always paired with a `Tag` color.

## Visual foundations
- **Color**: Ant Design's default blue seed (`#1677FF`) as primary, with the standard green/gold/red semantic triad for success/warning/error. Each has a 10-step tint/shade scale (`tokens/colors.css`). Neutrals are alpha-black on white (`rgba(0,0,0,.88/.65/.45/.25)`) rather than fixed grays, so text always sits correctly on light surfaces.
- **Type**: system font stack (`-apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", Arial, sans-serif`) — no custom webfont, matching Ant Design's own default. One weight family (400/500/600), a compact scale from 12px to 38px.
- **Spacing**: 4px-based scale (4/8/12/16/24/32/48), matching Ant's padding tokens. Layout metrics: 64px header, 208px sider (56px collapsed), 24px content padding.
- **Radius**: 2/4/6/8px steps, 100px for pill/round elements. Ant's default `borderRadius: 6` is the base for buttons, inputs, cards.
- **Shadow**: two elevation levels (`--shadow-1` subtle card rest, `--shadow-2` for popovers/modals) plus a dedicated flat `--shadow-header` (`0 1px 4px rgba(0,21,41,.08)`) matching Ant Pro's header shadow, and a `--shadow-card-hover` for hoverable cards.
- **Backgrounds**: flat colors only — no gradients, no imagery, no textures. Content area sits on `--bg-layout` (#f5f5f5); cards and header are white.
- **Animation**: minimal — `.2s` ease transitions on hover/focus states (button color, input border, card shadow); a single spin keyframe for loading buttons. No entrance animations, no bounce.
- **Hover/press states**: hover lightens primary buttons one step (`--color-primary-hover`) and tints default/dashed button borders/text to primary; press darkens one step further (`--color-primary-active`). Ghost/text buttons get a faint fill (`--fill-tertiary`) on hover. No scale/shrink effects.
- **Borders**: 1px solid `--border-color` (#d9d9d9) on inputs/cards; `--border-secondary` (#f0f0f0) for internal dividers (card header rule, table rows).
- **Cards**: white background, 8px radius, 1px `--border-secondary` border, no shadow at rest; hoverable cards pick up `--shadow-card-hover` on hover only.
- **Transparency/blur**: none in the UI kit. Only the mask behind Modal uses `rgba(0,0,0,.45)`.
- **Imagery**: none provided or invented — see Iconography below.

## Iconography
No icon assets were provided. Icons are sourced from **Remix Icon** via CDN (`remixicon.css`) — flagged substitution: Remix Icon was chosen over Ant Design Icons because Ant's icon set ships only as an npm/React package (no drop-in CDN build usable in a plain `<script>` context), and Remix's dual outline style is visually closest to Ant's own icon aesthetic. Icons are used sparingly: search, notification bell, arrows, nav glyphs, status icons in Alert. No emoji, no unicode-character icons, no PNGs.

## Caveats & ask
This is a from-scratch system, not a recreation — no codebase, Figma, or brand kit was attached, so:
- **No real logo.** The "P" mark and "PulseFit" wordmark are placeholders. If you have a real brand mark, attach it and it'll replace these everywhere (brand card, thumbnail, sider header).
- **No PingFang SC font file** — the Chinese-friendly system stack (PingFang SC / Microsoft YaHei via OS fallback) is used as-is; if you want a specific licensed Chinese typeface, share the font files.
- **Chart is a simple bar chart**, not a full charting library — swap in your real charting solution (e.g. `@ant-design/charts`) when wiring this to live data.
- Only one screen (Analysis Dashboard) was built. Tell me which other screens matter most (member list, class schedule, coach roster, billing) and I'll build those next using this same component set.
