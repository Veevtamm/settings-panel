# 004 — Hide the dock instantly on ⌘\\

- **Status**: DONE
- **Commit**: 58df21d (working tree was dirty when this plan was written; snippets below are from that tree, not from `git show HEAD`)
- **Severity**: HIGH
- **Category**: Purpose & frequency
- **Estimated scope**: 4 files, medium

## Problem

⌘\ is a keyboard shortcut. Keyboard-initiated actions get no animation. ⌘M and `focusPanel` already skip motion via `panelInstant`. ⌘\ does not.

The hide handler closes every window, then fades the dock for 220ms:

```tsx
/* src/settings-panel/shell.tsx:1389 — current handler, abbreviated */
if (hide) {
  closeDockPlayers();
  setPanelOpen(false);
  setSettingsOpen(false);
  setBezierOpen(false);
  setAxisOpen(false);
  setSpringOpen(false);
}
setDockHidden(hide);
```

```tsx
/* src/settings-panel/shell.tsx:1693 — current dock style */
opacity: dockHidden ? 0 : 1,
visibility: dockHidden ? "hidden" : "visible",
...(dockDragging || skipPanelMotion
  ? {}
  : {
      transitionProperty: "top, left, opacity, visibility",
      transitionDuration: `${PANEL_ENTER_MS}ms`,
      transitionTimingFunction: EASE_OUT,
    }),
```

`skipPanelMotion` is `reduceMotion || panelInstant`. The hide handler never sets `panelInstant`, so the dock fades. Click-open of the scene window already calls `setPanelInstant(false)` before animating, so a later click still gets the 220/160 pop.

Chrome windows do not read `panelInstant`. Their skip is only reduced motion:

```tsx
/* shell.tsx DockedChromeWindow — current, four times (settings, bezier, axis, spring) */
skip={reduceMotion}
```

`settingsMounted`, `bezierMounted`, `axisMounted`, and `springMounted` are `useDeferredMount(..., reduceMotion, reduceMotion ? 0 : PANEL_EXIT_MS)`. The scene window already uses `skipPanelMotion`.

The timeline is a sibling component. It will not see React state from the shell. On ⌘\ it still plays the 160ms exit in `src/settings-panel/timeline.tsx` (`useDeferredMount(open, reduceMotion, PANEL_EXIT_MS)` near line 470, and `panelPopClassName` / `panelPopStyle` with `skip: reduceMotion` near lines 1088 and 1105).

`AGENTS.md` currently requires the fade. This plan changes that sentence. The product decision to drop it was made when this plan was requested.

## Target

Pressing ⌘\ (and Ctrl+\\) hides and shows the dock with **no** opacity, visibility, or window animation. Clicking a dock button still uses enter 220ms / exit 160ms, `cubic-bezier(0.23, 1, 0.32, 1)`, `scale(0.98)` + 6px. Slot changes of the visible dock still transition `top` and `left` over 220ms. `prefers-reduced-motion` behavior stays.

`AGENTS.md`, in the hotkey paragraph (the sentence that contains `fade`):

Replace:

`При скрытии панель и плееры дока закрываются; fade `opacity`+`visibility` 220 ease-out; не persist.`

With:

`При скрытии панель, окна и плееры дока закрываются сразу, без fade; показ бара тоже сразу; не persist.`

Do not change the following sentence about click enter 220 / exit 160, or the sentence that ⌘M / `focusPanel` stay instant.

## Repo conventions to follow

⌘M already does the instant path:

```tsx
/* shell.tsx shortcut handler */
event.preventDefault();
setPanelInstant(true);
setPanelOpen((open) => {
  if (!open) closeDockPlayers();
  return !open;
});
```

`toggleScene` sets `setPanelInstant(false)` before a pointer open, so the next click animates. Do not remove those `setPanelInstant(false)` calls.

`useDeferredMount` in `src/settings-panel/row.tsx`: when its `reduceMotion` argument is true, close unmounts immediately.

## Steps

1. Add `src/settings-panel/panel-instant.ts` (with `"use client"`):

```ts
"use client";

let instant = false;

/** True through the current event's render and effect, then cleared. */
export function beginPanelInstant() {
  instant = true;
  requestAnimationFrame(() => {
    instant = false;
  });
}

export function isPanelInstant() {
  return instant;
}
```

The flag has to outlive the event handler and still be true in `useEffect`. `requestAnimationFrame` runs after `useEffect`. Do not clear it in a microtask.

2. In the ⌘\ handler in `shell.tsx`, call `beginPanelInstant()` and `setPanelInstant(true)` **before** closing windows and **before** `setDockHidden`, on both hide and show. Leave the close calls as they are. Do not set `panelInstant` false in this handler.

3. Point chrome mounts at `skipPanelMotion` (already `reduceMotion || panelInstant`):

```tsx
const settingsMounted = useDeferredMount(
  settingsOpen,
  skipPanelMotion,
  skipPanelMotion ? 0 : PANEL_EXIT_MS,
);
```

Same for `bezierMounted`, `axisMounted`, and `springMounted`. The scene `panelMounted` block already does this. Do not change it.

4. Pass `skip={skipPanelMotion}` to all four `DockedChromeWindow` usages (settings, bezier, axis, spring). Today they are `skip={reduceMotion}`.

5. In `timeline.tsx` `TimelineDock`, read `isPanelInstant()` during render:

```tsx
const instant = isPanelInstant();
const surfaceMounted = useDeferredMount(
  open,
  reduceMotion || instant,
  instant || reduceMotion ? 0 : PANEL_EXIT_MS,
);
```

Pass `skip: reduceMotion || instant` to both `panelPopClassName` and `panelPopStyle` for the dock body. Do not skip the pop when the user clicks the timer button. That click does not call `beginPanelInstant`, so `instant` is false and the 220/160 pop stays.

6. Replace the one `AGENTS.md` sentence in Target. Do not edit `README.md` or `README.ru.md`: they say the shortcut hides the dock and do not mention a fade.

## Boundaries

- Do not remove `top` / `left` from the dock transition. Search open and slot snaps still need it when `panelInstant` is false.
- Do not make click-open of the scene, settings, bezier, axis, spring, or timeline instant.
- Do not change `PANEL_ENTER_MS` or `PANEL_EXIT_MS`.
- Do not add a `setOpen` argument on `PlayerController`.
- If `beginPanelInstant` or `HOVER_REVEAL_MS` from plan 001 is already in the tree, do not delete the other.
- If the hide handler or the `fade` sentence cannot be found, STOP.

## Verification

- **Mechanical**: `npm run check` exits 0.
- **Feel check** (playground):
  - ⌘\ with the scene window, bezier or spring, and the timeline open. Dock and windows disappear on the same frame. No 220ms fade. Show is also instant. Animations panel shows no opacity transition on `[data-settings-panel]` for that key.
  - Click the scene button afterward. Enter is still 220ms, exit 160ms, from `scale(0.98)`, origin at the dock slot.
  - Open search, or drag the dock to another slot. The bar still eases `top`/`left`. That is not the shortcut.
  - Timeline opened from the timer button (not from ⌘\) still pops. Closing it from the timer still exits over 160ms.
  - `prefers-reduced-motion: reduce`: hide stays instant; click-open does not add movement.
- **Done when**: ⌘\ toggles the dock with no fade, pointer opens keep 220/160, and `AGENTS.md` no longer says the shortcut fades.
