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
- `ui_kits/dashboard/` — Analysis Dashboard screen (`index.html`, `DashboardLayout.jsx`, `DashboardContent.jsx`).
- `thumbnail.html` — project tile.
- `SKILL.md` — portable skill file for Claude Code.

## Components (19)
Button · Input · Select · Checkbox · Radio · Switch · Card · Tag · Badge · Avatar · Statistic · Progress · Table · Tabs · Breadcrumb · Menu · Modal · Tooltip · Alert

These are the standard Ant Design primitive set, sized to what an Analysis Dashboard needs — no source defined a fixed inventory, so this is a from-scratch build rather than a recreation.

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
