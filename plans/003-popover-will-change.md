# 003 — Drop will-change on open popovers

- **Status**: DONE
- **Commit**: 58df21d (working tree was dirty when this plan was written; snippets below are from that tree, not from `git show HEAD`)
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 2 files, small

## Problem

The color popover and the icon picker keep `will-change` and identity transforms while they are open, on top of `backdrop-blur`. An open panel window must not keep `transform` or `will-change`: the blur layer sits beside the glass as a dark ghost. These two popovers still do.

```tsx
/* src/settings-panel/color.tsx:191 — current */
className={cn(
  "fixed z-[110] flex flex-col gap-2 rounded-lg border border-[color:var(--sp-line)] p-2 backdrop-blur-[8px]",
  reduceMotion
    ? open
      ? "opacity-100"
      : "pointer-events-none opacity-0"
    : cn(
        "transition-[opacity,transform] will-change-[opacity,transform]",
        open
          ? "translate-y-0 scale-100 opacity-100"
          : cn(
              "pointer-events-none scale-[0.98] opacity-0",
              side === "below" ? "-translate-y-1.5" : "translate-y-1.5",
            ),
      ),
)}
```

`src/settings-panel/icon-picker.tsx` around line 118 is the same pattern (`will-change-[opacity,transform]`, open state `translate-y-0 scale-100 opacity-100`, closed state `scale-[0.98]` plus `translate-y-1.5` / `-translate-y-1.5`).

Enter is 220ms, exit is 160ms, curve `EASE_OUT`, origin is already the trigger (`transformOrigin: ${originX}px ${originY}px`). Keep all of that.

## Target

`will-change` is gone in both states. The open state sets opacity only: no `translate-y-0`, no `scale-100`. The closed state keeps `scale-[0.98]`, the 6px translate (`1.5` = 6px), and opacity 0. The transition class stays on both the open and closed states so the browser can interpolate. Reduced motion stays opacity-only.

```tsx
/* both popovers — target shape */
className={cn(
  /* existing layout classes, including backdrop-blur, unchanged */,
  !reduceMotion && "transition-[opacity,transform]",
  reduceMotion
    ? open
      ? "opacity-100"
      : "pointer-events-none opacity-0"
    : open
      ? "opacity-100"
      : cn(
          "pointer-events-none scale-[0.98] opacity-0",
          side === "below" ? "-translate-y-1.5" : "translate-y-1.5",
        ),
)}
```

Leave the `style` block as it is: `transformOrigin`, and

```tsx
transitionDuration: open ? `${PANEL_ENTER_MS}ms` : `${PANEL_EXIT_MS}ms`,
transitionTimingFunction: EASE_OUT,
```

with `PANEL_ENTER_MS` = 220 and `PANEL_EXIT_MS` = 160.

## Repo conventions to follow

Scene window pop in `src/settings-panel/motion-ui.tsx`: when open, the class is `opacity-100` with no transform utilities. When closed: `scale-[0.98]` and `translate-y-1.5` / `-translate-y-1.5`. No `will-change`.

```tsx
/* motion-ui.tsx panelPopClassName — imitate this */
return cn(
  "transition-[opacity,transform]",
  open
    ? "opacity-100"
    : fromBottom
      ? "pointer-events-none translate-y-1.5 scale-[0.98] opacity-0"
      : "pointer-events-none -translate-y-1.5 scale-[0.98] opacity-0",
);
```

## Steps

1. Rewrite the `className` branch in `src/settings-panel/color.tsx` to the target shape. Do not edit the style object, the origin math, or the popover contents.
2. Do the same in `src/settings-panel/icon-picker.tsx`. Keep that file's layout classes (`overflow-hidden`, width, and the rest). Only the motion classes change.

## Boundaries

- Do not change durations, easing, scale amount, or `transformOrigin`.
- Do not add `will-change` anywhere else, and do not remove `backdrop-blur`.
- Do not touch dropdowns, the transfer menu, or dock tooltips.
- If either file no longer has `will-change-[opacity,transform]`, STOP.

## Verification

- **Mechanical**: `npm run check` exits 0.
- **Feel check** (playground, a color row and an icon picker if one is on the page):
  - Open the popover. It still grows from the swatch / trigger (`scale(0.98)` + 6px), 220ms, ease-out. It does not grow from the center of the screen.
  - While it stays open, DevTools computed style on the popover: `will-change` is `auto`. `transform`, `translate`, and `scale` are `none` (Tailwind v4 splits translate and scale from `transform`).
  - No dark slab sitting beside the glass. Compare with the scene window, which already has this fix.
  - Close it. Exit is shorter than enter (160 vs 220). Spam open/close: it reverses from the current state, it does not restart from zero.
  - `prefers-reduced-motion: reduce`: opacity snaps, no translate and no scale.
- **Done when**: neither open popover lists `will-change` or an identity translate/scale, and the enter/exit distances are unchanged.
