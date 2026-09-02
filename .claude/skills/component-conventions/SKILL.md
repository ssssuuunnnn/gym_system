---
name: component-conventions
description: Durable rules for authoring UI components in this repo (React + TypeScript + Ant Design v6) — where a component lives (shared frontend/src/components/ vs. page-scoped frontend/src/pages/<Page>/components/), reaching for Ant Design before hand-rolling, design tokens over literal values, dayjs for all date work, single shared sources for constants/helpers (no per-file copies), controlled props-driven components, and "one concept, one component". TRIGGER — use whenever creating or modifying any component (in frontend/src/components/, or a page-specific one), when deciding where a new component should live, when deciding whether to build a custom widget vs. compose an Ant Design one, or when reviewing a component for hardcoded values, duplicated helpers, or one-off design. Does NOT cover page/list-screen shape (see CLAUDE.md "Frontend conventions") or the layout shell (see the layout-conventions skill).
---

# Component conventions

Standing rules for **authoring UI components** in this repo — both the shared building blocks
(`frontend/src/components/`: `AppLayout`, `SlotPicker`, `StatusTag`, `calendar/*`) and
page-specific ones. Page-level list/form *screen* shape is in `CLAUDE.md` → "Frontend
conventions"; the layout shell has its own `layout-conventions` skill. These are rules to apply
every time you create or touch a component, not a log of a past change.

Stack: React 19, TypeScript, **Ant Design v6** (`antd` + `@ant-design/icons`), `dayjs`, Vite.
The antd theme is configured once in `frontend/src/App.tsx` (`ConfigProvider theme.token` +
`locale={zhTW}`), mirroring `gym-system-design/DESIGN_GUIDELINES.md` §1.6.

## 1. Where a component lives — shared vs. page-scoped

Decide by how many screens consume it:

- **Used by 2+ pages, or cross-cutting** (layout, shared pickers, status tags, the calendar
  atoms) → `frontend/src/components/` (a subfolder for a related set, e.g. `components/calendar/`).
- **Used by exactly one page** → co-locate it with that page under
  `frontend/src/pages/<Area>/<PageName>/components/`. Do **not** put a single-consumer component
  in the shared `frontend/src/components/` tree.

Adopting a page-scoped folder means that page becomes a directory rather than a flat file:

```
frontend/src/pages/admin/GroupCourseList/
  GroupCourseList.tsx        (or index.tsx — match whichever the repo settles on)
  components/
    CourseStatusTag.tsx
    CourseFilterBar.tsx
```

(The repo's pages are currently flat files — `pages/admin/GroupCourseList.tsx`. Convert a page
to a folder only when it actually grows a page-specific component; a page with none stays a
flat file.)

**Promotion**: when a second page needs a page-scoped component, move it to
`frontend/src/components/` (or a subfolder) in the same change, and update both importers.
Don't import across page folders (`pages/admin/A/components/...` from `pages/admin/B/...`) —
that's the signal it should be shared.

## 2. Reach for Ant Design before hand-rolling

Before building a custom component, check whether an antd component (or a thin composition of
them) already covers it. Only hand-roll when antd genuinely has no primitive for the need.

- Date range filter → `DatePicker.RangePicker`, **not** a bespoke popover calendar.
- Month/date panel → `DatePicker` panel or `<Calendar fullscreen={false}>`.
- The `components/calendar/` atoms (`TimeAxis`, `TimeSlotCell`, `EventBlock`, …) are a
  legitimate exception: scheduling needs a time ruler / clickable slot / absolutely-positioned
  event block that no antd primitive provides. `MiniCalendar` is a weaker case — antd's picker
  panel overlaps it; don't add new bespoke widgets that duplicate an antd component.
- When you do hand-roll, still compose antd where you can (buttons, inputs, tags, popconfirm)
  rather than restyling raw elements.

## 3. Design tokens, not literal values

Colors, radius, shadow, and border colors come from antd's theme — read them with
`const { token } = theme.useToken();`. This is already the norm across `components/calendar/*`.

- **No hardcoded hex / `rgba()` / named colors** in component style. Use `token.colorPrimary`,
  `token.colorPrimaryBg`, `token.colorError`, `token.colorText` / `colorTextSecondary` /
  `colorTextTertiary` / `colorTextQuaternary`, `token.colorBorder` / `colorBorderSecondary`,
  `token.colorFillTertiary` / `colorFillAlter`, `token.colorWhite`, and the scale tokens
  `token.blue1/3/6/8`, `token.purple*`, `token.gold*`, `token.green*`.
- Radius: `token.borderRadius` / `borderRadiusSM` / `borderRadiusLG`. A pill uses
  `borderRadius: 100` — fine as a literal, but prefer a shared constant if it recurs.
- Font family: `token.fontFamily`.
- **Font sizes**: antd has no token below 14px. Small literals (`11`/`12`/`13`) are acceptable,
  but if the same size + role repeats across files, hoist it to a shared constant (see §4).
- Spacing/gaps as small literals (`4`/`8`/`12`/`16`) is fine — they already match the 4px scale.

## 4. One shared source for constants and helpers — no per-file copies

A component must not redeclare a helper or constant that another component already needs.
Put shared pieces in a small module next to the components that use them (e.g.
`frontend/src/components/calendar/shared.ts`) and import from there.

This applies to:

- **Date helpers** — use `dayjs` (already a dependency, used throughout the frontend). Do not
  hand-write `pad()`, `keyOf()`, week-start math, or `'YYYY-MM-DD'` string building. `dayjs`
  covers formatting, parsing, `.startOf('week')`, `.add()`, `.isSame()`, etc.
- **Weekday / month labels** — one exported constant, not a fresh `['一','二',…]` /
  `WEEKDAY_LABEL` / `DAYS` array per file.
- **Shared maps** — e.g. the event `tone` → token map used by both `EventBlock` and
  `EventChip` should be defined once.
- **Shared scale values** — e.g. the calendar `hourHeight` ("the single source of the vertical
  ruler", per the READMEs) should be one exported default, not a literal `52` re-typed as each
  component's own prop default.
- **Repeated copy strings** — `'還有 N 筆'`, `'年'`/`'月'`, etc. centralize when reused.

**Known existing debt** (consolidate when you next touch these files — a separate cleanup task,
not required up front): `pad()` is copied in `MiniCalendar` / `TimeAxis` / `NowIndicator`;
`TONES` is copied in `EventBlock` / `EventChip`; the `hourHeight = 52` default is repeated in
4 calendar files; weekday-label arrays exist separately in `MiniCalendar`, `SlotPicker` (`DAYS`),
`pages/admin/CourseList.tsx` and `pages/admin/GroupCourseList.tsx` (`WEEKDAY_LABEL`).

## 5. Controlled and props-driven

Follow the pattern the `calendar/` atoms already model well:

- Data and callbacks come in via a typed `Props` interface with per-prop JSDoc. Export the
  interface.
- Hold as little internal state as possible — transient UI state only (e.g. `hover` in
  `TimeSlotCell`). Anything the parent needs to know or control (selected range, current month,
  anchor date) is a prop + callback, not internal state.
- Accept a `style?: CSSProperties` escape hatch and spread it last, as the atoms do.

## 6. One concept, one component

Don't build a second component (or a second palette/state-union) for a concept that already
has one. Extend the canonical one.

- Weekly grid: `SlotPicker.tsx` is canonical (週一–週六 × 10:00–21:00). Extend its `SlotState`
  union rather than making a parallel grid.
- Event colours: the `calendar/` `EventTone` union (`blue` 團體課程 / `purple` 私人教練 /
  `gold` 場租包場 / `gray` 維護 / `green` 完成) is the vocabulary for booking types. `SlotPicker`
  currently carries its own grey-scale `SlotState` for overlapping concepts — if these ever need
  to agree, unify on one source rather than adding a third.

## 7. File and style conventions

- One component per file; filename = component name (`EventBlock.tsx` exports `EventBlock`).
  Match the export style of siblings in the same folder (the `calendar/` atoms use named
  exports; `AppLayout` / `StatusTag` use default exports — follow the neighbours).
- Inline `style={{…}}` objects are the repo norm — no CSS modules, no styled-components. Extract
  a shared style constant only when it is genuinely repeated.
- All UI copy, identifiers, and comments in **Traditional Chinese**.
- A folder of related components gets a short `README.md` (see `components/calendar/README.md`)
  — keep it current when you add or change a component there.
