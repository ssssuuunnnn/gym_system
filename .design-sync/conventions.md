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
