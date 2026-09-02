# design-sync notes

## Source shape (important)

`gym-system` is an **application**, not a design-system repo. There is no Storybook and
no component-library build — `frontend/` is a React + Ant Design app whose `npm run build`
emits an app bundle, not importable component modules. The `/design-sync` converter does
not apply here.

## What gets synced

`ds-bundle/` is assembled by hand:

1. **Base** = a verbatim copy of `gym-system-design/project/` — an existing Claude Design
   export of the **PulseFit Design System** (namespace `PulseFitDesignSystem_325e30`,
   bundle `@ds-bundle` format 4). 19 primitives, `tokens/`, `guidelines/`, `ui_kits/dashboard/`.
   `screenshots/` is dropped (unreferenced, large); `.thumbnail` + `_adherence.oxlintrc.json` kept.
2. **Added group `components/app/`** — StatusTag, SlotPicker, AppLayout, ported from
   `frontend/src/components/*.tsx` into the bundle's plain-`React.createElement` + `var(--*)` idiom:
   - `StatusTag` composes `window.PulseFitDesignSystem_325e30.Tag`. Status→color mapping:
     待確認→warning, 已確認→success, 已拒絕→error, 已取消→default (richer than the app's
     original, which only colored 已確認).
   - `SlotPicker` — direct port; hardcoded grays swapped for `--gray-*` / `--color-warning` tokens.
   - `AppLayout` — rewritten as a **controlled** component (props for role/username/activeKey/
     onNavigate/onLogout/scrolled instead of react-router + zustand). Uses the DS `Menu` + `Button`.
     Antd icons swapped for Remix Icon (`ri-*`) class names.
3. **Hand-patched**: `_ds_bundle.js` (3 component blocks + 3 `__ds_ns.*` exports + header JSON
   components/sourceHashes), `_ds_manifest.json` (components + one `App Components` card),
   `readme.md` (19→22, + conventions header prepended from `.design-sync/conventions.md`).

## Re-sync procedure

No converter. To update: re-copy `gym-system-design/project/` over `ds-bundle/` (preserving
`components/app/` and the hand-patches), or re-apply the 3 patches to a fresh export, then
re-verify the `App Components` card renders and re-upload with DesignSync.

## Verification

The 3 new previews (`components/app/app.card.html`) must be visually checked before upload —
the 19 primitives + guidelines were already verified by whoever produced the original export.
