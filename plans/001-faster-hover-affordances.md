# 001 — Shorten hover reveals

- **Status**: DONE
- **Commit**: 58df21d (working tree was dirty when this plan was written; snippets below are from that tree, not from `git show HEAD`)
- **Severity**: MEDIUM
- **Category**: Purpose & frequency
- **Estimated scope**: 3 files, small

## Problem

Two hover reveals use motion budgets meant for opening a section. Both fire while scanning the panel, which is tens of times a session. Hover motion at that frequency should be drastically reduced.

The scrub toggle fades in over the section duration, 200ms:

```tsx
/* src/settings-panel/number.tsx:775 — current */
<FieldButton
  label={scrubOpen ? `Hide slider for ${label}` : `Show slider for ${label}`}
  expanded={scrubOpen}
  onClick={() => setScrubOpen((open) => !open)}
  className={cn(
    "absolute top-0 right-full mr-1",
    !reduceMotion && "transition-opacity",
    scrubOpen
      ? "opacity-100"
      : "opacity-100 fine-hover:pointer-events-none fine-hover:opacity-0 fine-hover:group-hover:pointer-events-auto fine-hover:group-hover:opacity-100",
  )}
  style={
    reduceMotion
      ? undefined
      : {
          transitionDuration: `${SECTION_MS}ms`,
          transitionTimingFunction: EASE_OUT,
        }
  }
>
```

`SECTION_MS` is 200. The slider body under the row (the `grid-template-rows` block starting near line 800) is a different interaction and stays on `SECTION_MS`.

The subsection grip slides the title by animating layout on hover:

```tsx
/* src/settings-panel/sections.tsx:441 — current */
<span
  aria-grabbed={dragging}
  aria-label={tx(PANEL_COPY.drag, locale)}
  className={cn(
    "inline-flex h-5 shrink-0 cursor-grab items-center justify-center overflow-hidden active:cursor-grabbing",
    !reduceMotion && "transition-[width,margin,opacity,transform]",
    dragging
      ? "w-5 mr-2 scale-100 opacity-100"
      : "w-5 mr-2 scale-100 opacity-100 fine-hover:mr-0 fine-hover:w-0 fine-hover:scale-95 fine-hover:opacity-0 fine-hover:group-hover/sub:mr-2 fine-hover:group-hover/sub:w-5 fine-hover:group-hover/sub:scale-100 fine-hover:group-hover/sub:opacity-100",
  )}
  style={
    reduceMotion
      ? undefined
      : {
          transitionDuration: `${CHEVRON_MS}ms`,
          transitionTimingFunction: EASE_OUT,
        }
  }
```

Width and margin are layout. The title eases sideways every time the pointer enters a subsection header. The collapsed grip (`fine-hover:w-0`) is intentional: without hover the title lines up with row labels. Keep that. Stop animating the layout change.

## Target

Scrub button opacity: **100ms** (bottom of the button-press budget, 100–160ms) and the existing strong ease-out.

```ts
/* src/settings-panel/chrome.ts — add next to CHEVRON_MS */
/** Hover reveal of a control that is already on screen. Not a section open. */
export const HOVER_REVEAL_MS = 100;
```

```tsx
/* number.tsx FieldButton style — target */
transitionDuration: `${HOVER_REVEAL_MS}ms`,
transitionTimingFunction: EASE_OUT,
```

Change that button's transition class from `transition-opacity` to `transition-[opacity,transform]` so a later press-scale on `FieldButton` is not wiped by `tailwind-merge`.

Grip: transition **opacity and transform only**. Width and margin still change (the `w-0` / `w-5` / `mr-*` classes stay) but they snap. Glyph fade stays `CHEVRON_MS` (150) and `EASE_OUT` (`cubic-bezier(0.23, 1, 0.32, 1)`).

```tsx
!reduceMotion && "transition-[opacity,transform]",
```

## Repo conventions to follow

Durations and the curve live in `src/settings-panel/chrome.ts`:

```ts
export const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
export const SECTION_MS = 200;
export const CHEVRON_MS = 150;
```

`number.tsx` already imports `EASE_OUT` and `SECTION_MS` from `./chrome`. Add `HOVER_REVEAL_MS` to that import. Do not hardcode another cubic-bezier.

`fine-hover:` is the pointer gate. Do not replace it with raw `:hover`.

## Steps

1. In `src/settings-panel/chrome.ts`, add `HOVER_REVEAL_MS = 100` immediately after `CHEVRON_MS`.
2. In `src/settings-panel/number.tsx`, import `HOVER_REVEAL_MS`. On the scrub `FieldButton` only, set `transition-[opacity,transform]` and `transitionDuration` to `` `${HOVER_REVEAL_MS}ms` ``. Leave the grid block below it on `SECTION_MS`.
3. In `src/settings-panel/sections.tsx`, change the grip transition class to `transition-[opacity,transform]`. Leave the width, margin, scale, and opacity classes as they are. Leave `CHEVRON_MS`.

## Boundaries

- Do not change section collapse, scrub track expand, chevron rotation, or dock search width.
- Do not add `active:scale` here. That is plan 002.
- Do not edit `AGENTS.md` or `README.md`.
- If the quoted blocks are not in the file, STOP.

## Verification

- **Mechanical**: `npm run check` exits 0.
- **Feel check** (playground, `npm run playground`):
  - Move across several number rows. The `settings-2` button appears with the row, not a beat later. At 10% in the Animations panel the opacity run is 100ms, ease-out (fast start).
  - Open the slider. Its height still takes about 200ms. Closing it is shorter than opening.
  - Hover a subsection header. The title jumps to make room; it does not slide. The grip glyph fades. Dragging the grip still works.
  - `prefers-reduced-motion: reduce`: both reveals snap, no fade.
- **Done when**: scrub hover is 100ms opacity, grip does not transition width or margin, section and slider timings are unchanged.
