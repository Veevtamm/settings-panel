"use client";

import { cn } from "../lib/utils";

export const GLASS = "var(--sp-glass)";
export const FIELD = "var(--sp-field)";
export const MUTED = "var(--sp-muted)";
/** Figma `text/dim` — ruler numbers, not row labels. */
export const DIM = "var(--sp-fg-dim)";
/** Panel / Icon fill — Figma `text/bright` (`--sp-fg`), not muted text. */
export const ICON = "var(--sp-fg)";
export const rowLabelClass =
    "block h-[20px] min-h-0 cursor-default select-none truncate text-[15px] font-sans leading-[20px] text-[color:var(--sp-label)]";
/** Figma `text/main` — timeline inspector (Panel / Label). */
export const rowLabelMainClass =
    "block h-[20px] min-h-0 cursor-default select-none truncate text-[15px] font-sans leading-[20px] text-[color:var(--sp-muted)]";
/** Value in Field / Hex / Coords: 14/18. Numbers — Mono, prose — Sans. */
export const fieldValueMono = "text-[14px] font-mono leading-[18px] tabular-nums";
export const fieldValueSans = "text-[14px] font-sans leading-[18px]";

/** Figma Panel Body 4809:3 — content column inside section pad */
export const PANEL_WIDTH = 348;
/** Width drag: Figma 348 is the floor (Bezier 328 + section pad). */
export const PANEL_WIDTH_MIN = 348;
export const PANEL_WIDTH_MAX = 560;
/** Height drag floor (one open section + chrome). Cap is remaining viewport. */
export const PANEL_HEIGHT_MIN = 200;
export const PANEL_RESIZE_HIT = 6;
/** Invisible grab along the window’s top edge (section pad), not a titlebar. */
export const PANEL_MOVE_EDGE = 8;

export function panelMaxHeightPx(
  dockBottom: boolean,
  dockY: number,
  vh: number,
) {
  const max = dockBottom
    ? dockY - PANEL_DOCK_GAP - DOCK_INSET
    : vh - dockY - DOCK_BAR_H - PANEL_DOCK_GAP - DOCK_INSET;
  return Math.max(PANEL_HEIGHT_MIN, max);
}

export function clampPanelWidth(width: number, vw: number) {
  const room = Math.max(PANEL_WIDTH_MIN, vw - 64);
  const max = Math.min(PANEL_WIDTH_MAX, room);
  return Math.min(max, Math.max(PANEL_WIDTH_MIN, width));
}

export function clampPanelHeight(height: number, maxHeight: number) {
  const cap = Math.max(PANEL_HEIGHT_MIN, maxHeight);
  return Math.min(cap, Math.max(PANEL_HEIGHT_MIN, height));
}

/** Gap between the dock bar and the docked panel. */
export const PANEL_DOCK_GAP = 8;
/** Snap back onto the dock bar when the panel is this close. */
export const PANEL_MAGNET_PX = 28;
/** ⓘ tooltip / flyouts above floating scene · spring · bezier · axis windows. */
export const PANEL_HINT_Z = 300;

/** Docked panel x: under the bar's center for `*-center`, flush with the bar's outer edge in corners. */
export function dockedPanelX(
  corner: DockCorner,
  barX: number,
  barW: number,
  panelW: number,
  vw: number,
) {
  const x = corner.endsWith("right")
    ? barX + barW - panelW
    : corner.endsWith("center")
      ? Math.round(barX + barW / 2 - panelW / 2)
      : barX;
  const maxX = Math.max(DOCK_INSET, vw - panelW - DOCK_INSET);
  return Math.min(maxX, Math.max(DOCK_INSET, x));
}

export function dockedPanelPos(
  corner: DockCorner,
  bar: { x: number; y: number; w: number },
  panelW: number,
  panelH: number,
  vw: number,
) {
  const x = dockedPanelX(corner, bar.x, bar.w, panelW, vw);
  return corner.startsWith("bottom")
    ? { x, y: bar.y - PANEL_DOCK_GAP - panelH }
    : { x, y: bar.y + DOCK_BAR_H + PANEL_DOCK_GAP };
}

export function clampPanelPos(
  x: number,
  y: number,
  w: number,
  h: number,
  vw: number,
  vh: number,
) {
  const maxX = Math.max(DOCK_INSET, vw - w - DOCK_INSET);
  const maxY = Math.max(DOCK_INSET, vh - h - DOCK_INSET);
  return {
    x: Math.min(maxX, Math.max(DOCK_INSET, x)),
    y: Math.min(maxY, Math.max(DOCK_INSET, y)),
  };
}

function aabbGap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
  return Math.hypot(dx, dy);
}

export function shouldMagnetPanel(
  panel: { x: number; y: number; w: number; h: number },
  docked: { x: number; y: number },
  buttons: { x: number; y: number; w: number; h: number },
  /** Scene: snap when overlapping the Dock Bar. Chrome windows: slot only. */
  magnetBar = true,
) {
  if (Math.hypot(panel.x - docked.x, panel.y - docked.y) < PANEL_MAGNET_PX) {
    return true;
  }
  if (!magnetBar) return false;
  // Docked scene sits PANEL_DOCK_GAP (8) from the bar — an AABB *gap* of 28
  // would keep it stuck while sliding parallel. Overlap = drop onto the bar.
  return aabbGap(panel, buttons) === 0;
}

export function isPanelMoveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-panel-no-move]")) return false;
  if (
    target.closest(
      "button, input, textarea, select, [role=slider], [role=radio], [role=switch], [contenteditable=true], canvas, [data-panel-resize], [aria-grabbed]",
    )
  ) {
    return false;
  }
  return Boolean(target.closest("[data-panel-move]"));
}

export const CURVE_SIZE = 328;
/** Vertical rhythm: glue 4 / in-section & dock 8 / between subsections 16 */
export const GAP_IN = 8;
export const DOCK_BTN = 34;
/** Expanded dock search field — wider than dropdown 176. */
export const DOCK_SEARCH_W = 240;
/** Dock Bar: 1px border + 4px pad around 34px buttons. */
export const DOCK_BAR_PAD = 4;
export const DOCK_BAR_H = DOCK_BTN + DOCK_BAR_PAD * 2 + 2;
/** Default dock inset — same as `top-3` / `left-3`. */
export const DOCK_INSET = 12;
/** Gear drag starts after this travel (px); below = click. */
export const DOCK_DRAG_PX = 4;

/** Kill native text selection for a window drag (capture before the 4px threshold). */
export function lockPanelTextSelect(el: HTMLElement, pointerId: number) {
  window.getSelection()?.removeAllRanges();
  document.documentElement.dataset.panelMoving = "";
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* already released */
  }
}

/** Primary button still down. Touch may report `buttons === 0` while held. */
export function pointerHeld(
  event: Pick<PointerEvent, "pointerType" | "buttons">,
) {
  return event.pointerType === "touch" || (event.buttons & 1) !== 0;
}

/**
 * Window pointer drag that cannot outlive the press: up / cancel / lost
 * capture, or a mouse/pen move with no buttons, all end it. Capture-phase so
 * a child `stopPropagation` cannot leave a ghost follow.
 */
export function bindPointerDrag(
  pointerId: number,
  handlers: {
    onMove: (event: PointerEvent) => void;
    onEnd: (event: PointerEvent) => void;
  },
) {
  let done = false;
  const finish = (event: PointerEvent) => {
    if (done) return;
    if (event.pointerId !== pointerId) return;
    done = true;
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", finish, true);
    window.removeEventListener("pointercancel", finish, true);
    window.removeEventListener("lostpointercapture", finish, true);
    handlers.onEnd(event);
  };
  const onMove = (event: PointerEvent) => {
    if (done || event.pointerId !== pointerId) return;
    if (!pointerHeld(event)) {
      finish(event);
      return;
    }
    handlers.onMove(event);
  };
  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("pointerup", finish, true);
  window.addEventListener("pointercancel", finish, true);
  window.addEventListener("lostpointercapture", finish, true);
  return () =>
    finish(new PointerEvent("pointercancel", { pointerId }));
}

export type DockCorner =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export const DOCK_CORNERS: readonly DockCorner[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

export const DEFAULT_DOCK_CORNER: DockCorner = "top-center";

/** Moment HUD top: under the bar when the bar holds top-center. */
export function momentHudTop(slot: DockCorner) {
  return slot === "top-center"
    ? DOCK_INSET + DOCK_BAR_H + GAP_IN
    : DOCK_INSET;
}

/** Button inside the Dock Bar: no own glass or border; active = fill. */
export function dockBarButtonClass(active = false) {
  return cn(
    "relative inline-flex size-[34px] shrink-0 items-center justify-center rounded px-0 font-sans outline-none",
    "transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
    "focus-visible:ring-1 focus-visible:ring-[color:var(--sp-line-focus)] active:scale-[0.97]",
    active
      ? "bg-[color:var(--sp-dock-fill)] text-[color:var(--sp-fg)] fine-hover:hover:bg-[color:var(--sp-dock-fill-hover)]"
      : "text-[color:var(--sp-muted)] fine-hover:hover:bg-[color:var(--sp-fill-hover)] fine-hover:hover:text-[color:var(--sp-fg)]",
  );
}

function viewportSize(vw?: number, vh?: number) {
  return {
    vw: vw ?? (typeof window === "undefined" ? 1280 : window.innerWidth),
    vh: vh ?? (typeof window === "undefined" ? 800 : window.innerHeight),
  };
}

export function clampDockPos(
  x: number,
  y: number,
  barW: number,
  vw?: number,
  vh?: number,
) {
  const size = viewportSize(vw, vh);
  const maxX = Math.max(DOCK_INSET, size.vw - barW - DOCK_INSET);
  const maxY = Math.max(DOCK_INSET, size.vh - DOCK_BAR_H - DOCK_INSET);
  return {
    x: Math.min(maxX, Math.max(DOCK_INSET, x)),
    y: Math.min(maxY, Math.max(DOCK_INSET, y)),
  };
}

export function dockPosForCorner(
  corner: DockCorner,
  barW: number,
  vw?: number,
  vh?: number,
) {
  const size = viewportSize(vw, vh);
  const right = Math.max(DOCK_INSET, size.vw - barW - DOCK_INSET);
  const center = Math.max(DOCK_INSET, Math.round((size.vw - barW) / 2));
  const bottom = Math.max(DOCK_INSET, size.vh - DOCK_BAR_H - DOCK_INSET);
  const x = corner.endsWith("right")
    ? right
    : corner.endsWith("center")
      ? center
      : DOCK_INSET;
  return { x, y: corner.startsWith("bottom") ? bottom : DOCK_INSET };
}

/**
 * Nearest of six slots. `x`/`y` is the bar's top-left — drop uses the pointer
 * as the bar center so a short drag toward an edge still leaves the middle.
 */
export function nearestDockCorner(
  x: number,
  y: number,
  barW: number,
  vw?: number,
  vh?: number,
): DockCorner {
  const size = viewportSize(vw, vh);
  const cx = x + barW / 2;
  const cy = y + DOCK_BAR_H / 2;
  let best: DockCorner = DEFAULT_DOCK_CORNER;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const corner of DOCK_CORNERS) {
    const slot = dockPosForCorner(corner, barW, size.vw, size.vh);
    const dx = cx - (slot.x + barW / 2);
    const dy = cy - (slot.y + DOCK_BAR_H / 2);
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = corner;
    }
  }
  return best;
}

/**
 * Product-chrome motion (panel is a tool, not the gallery hero).
 * Strong ease-out; enter slightly longer than exit.
 */
export const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
export const PANEL_ENTER_MS = 220;
export const PANEL_EXIT_MS = 160;
export const SECTION_MS = 200;
/** Chevron / small icon rotate — shorter than section body. */
export const CHEVRON_MS = 150;
export const HINT_DELAY_MS = 120;
export const HINT_POP_MS = 140;
export const HINT_SESSION_MS = 600;
export const COPY_DONE_MS = 1400;
export const SUBSECTION_DRAG_PX = 6;
export const SUBSECTION_HEADER_PX = 16;
/** Section header row — Figma Section Header 20. */
export const SECTION_HEADER_PX = 20;
/** Closed `SectionBlock`: `p-2` (8+8) + header 20. Placeholder while reordering. */
export const SECTION_CLOSED_PX = 36;

export const fieldChrome =
  "border border-[color:var(--sp-line-mid)] transition-[border-color,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] fine-hover:hover:border-[color:var(--sp-line-strong)] focus-visible:border-[color:var(--sp-line-focus)] focus-visible:outline-none";

/** 86 track: 28+1+28+1+28 cells. Stroke is an overlay so cell fills do not cover it. */
export const pickerChrome =
  "relative overflow-hidden rounded bg-[color:var(--sp-field)] after:pointer-events-none after:absolute after:inset-0 after:z-10 after:rounded after:border after:border-[color:var(--sp-line-mid)] after:transition-[border-color] after:duration-150 after:ease-[cubic-bezier(0.23,1,0.32,1)] fine-hover:hover:after:border-[color:var(--sp-line-strong)] focus-within:after:border-[color:var(--sp-line-focus)]";
export const pickEase =
  "transition-[background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]";
export const pickActive =
  "bg-[color:var(--sp-fill)] text-[color:var(--sp-fg)] fine-hover:hover:bg-[color:var(--sp-fill-strong)] focus-visible:bg-[color:var(--sp-fill-strong)] focus-visible:text-[color:var(--sp-fg)]";
export const pickIdle =
  "text-[color:var(--sp-fg-dim)] fine-hover:hover:bg-[color:var(--sp-fill-hover)] fine-hover:hover:text-[color:var(--sp-muted)] focus-visible:bg-[color:var(--sp-fill)] focus-visible:text-[color:var(--sp-fg)]";

export const SNAPSHOT_SLOTS = 3;
/** Numbered preset cells with 1px rules: 28×N + (N−1). */
export const SNAPSHOT_TRACK_W = 28 * SNAPSHOT_SLOTS + (SNAPSHOT_SLOTS - 1);

export const SCRUB_MAX_TICK_STOPS = 14;
export const SCRUB_PAD_X = 4;
export const SCRUB_TICK_PAD_X = 5;
export const SCRUB_DRAG_W = 4;
export const SCRUB_DRAG_H = 20;
export const SCRUB_TICK_H = 10;
export const SCRUB_TICK_W = 2;
/** Notch at the default value: the drag snaps to it within this radius (px). */
export const SCRUB_SNAP_PX = 5;
export const SCRUB_NOTCH_H = 12;
/** Parameter enum dropdown — Figma 176, not leftover fill. Preset stays flex-1. */
export const ENUM_DROPDOWN_W = 176;
