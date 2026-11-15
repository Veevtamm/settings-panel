# 002 — Press scale on field buttons

- **Status**: DONE
- **Commit**: 58df21d (working tree was dirty when this plan was written; snippets below are from that tree, not from `git show HEAD`)
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 1 file, small

## Problem

`FieldButton` is the 28px control inside rows (scrub, curve, and the same chrome elsewhere). Pressing it does not move. The dock button, the toggle, and the cell widget already scale to 0.97.

```tsx
/* src/settings-panel/fields.tsx:125 — current */
className={cn(
  "group/field-btn flex size-[28px] shrink-0 items-center justify-center rounded outline-none",
  fieldChrome,
  pickEase,
  active || expanded
    ? cn(pickActive, "border-[color:var(--sp-line-strong)]")
    : "bg-[color:var(--sp-field)] text-[color:var(--sp-muted)] fine-hover:hover:bg-[color:var(--sp-fill-hover)] fine-hover:hover:text-[color:var(--sp-fg)]",
  className,
)}
```

`fieldChrome` and `pickEase` transition border, background, and color. They do not transition `transform`, and there is no `active:scale`.

Do not add the scale to `fieldChrome`. That string is also used on text fields.

## Target

Match the dock button, which is the press exemplar in this repo. Scale **0.97**. Transition transform together with the colors already in motion, **150ms**, curve `cubic-bezier(0.23, 1, 0.32, 1)`.

The audit catalog's press line is `transform 160ms ease-out` and `scale(0.97)`. This package already uses 150ms for the same press, and 150 is inside the 100–160ms budget. Use 150, not a new 160.

```tsx
/* fields.tsx FieldButton className — add after pickEase, before className */
"transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
"motion-reduce:transition-none",
"active:scale-[0.97]",
```

`cn` is `tailwind-merge`. This transition must come **after** `fieldChrome` and `pickEase` and **before** `className`, so it replaces their shorter `transition-*` utilities, and a caller can still override.

The icon swap inside the expanded button (opacity on the glyph and on `x`) stays as it is.

## Repo conventions to follow

```ts
/* src/settings-panel/chrome.ts:242 — dockBarButtonClass */
"transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
"focus-visible:ring-1 focus-visible:ring-[color:var(--sp-line-focus)] active:scale-[0.97]",
```

Toggle uses the same scale and `motion-reduce:transition-none` in `src/settings-panel/fields.tsx` near the switch (`active:scale-[0.97]` around line 507).

Curve string stays the literal already used in `dockBarButtonClass`. Do not introduce a CSS variable.

## Steps

1. On the `FieldButton` `<button>` in `src/settings-panel/fields.tsx`, add the three classes from Target after `pickEase` and before `className`.
2. Do not edit call sites. Plan 001 changes the scrub button's own `transition-*` class to `transition-[opacity,transform]`; leave that alone if it is already there. If it is still `transition-opacity`, do not "fix" it in this plan.

## Boundaries

- Do not scale chevrons, the eye, row labels, or the dock. The dock already scales.
- Do not change `fieldChrome` or `pickEase` themselves.
- Do not add a dependency.
- If `FieldButton` no longer matches the snippet, STOP.

## Verification

- **Mechanical**: `npm run check` exits 0.
- **Feel check** (playground):
  - Press and hold a 28px field button (scrub `settings-2`, or a curve button if the playground has one). It scales to 0.97 and eases back. It must not start from `scale(0)`.
  - Release mid-press: it returns from the current scale, it does not jump to 0 and replay.
  - A number text field does not scale when clicked.
  - `prefers-reduced-motion: reduce`: no scale transition (`motion-reduce:transition-none`). The control still works.
- **Done when**: `FieldButton` has `active:scale-[0.97]` and a 150ms transform transition, and inputs that share `fieldChrome` do not.
