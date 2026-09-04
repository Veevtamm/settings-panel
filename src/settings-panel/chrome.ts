"use client";

export const GLASS = "var(--sp-glass)";
export const FIELD = "var(--sp-field)";
export const MUTED = "var(--sp-muted)";
/** Panel / Icon fill — Figma `text/bright` (`--sp-fg`), not muted text. */
export const ICON = "var(--sp-fg)";
export const rowLabelClass =
    "block h-[20px] min-h-0 cursor-default select-none truncate text-[15px] font-sans leading-[20px] text-[color:var(--sp-label)]";
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
    ? dockY + DOCK_BTN - DOCK_INSET
    : vh - dockY - DOCK_INSET;
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

/** Gap between gear column and docked panel (`ml-1.5` / `mr-1.5`). */
export const PANEL_DOCK_GAP = 6;
/** Snap back onto the dock column when the panel is this close. */
export const PANEL_MAGNET_PX = 28;

export function dockedPanelPos(
  corner: DockCorner,
  gear: { x: number; y: number },
  panelW: number,
  panelH: number,
) {
  const gap = PANEL_DOCK_GAP;
  switch (corner) {
    case "top-right":
      return { x: gear.x - gap - panelW, y: gear.y };
    case "bottom-left":
      return {
        x: gear.x + DOCK_BTN + gap,
        y: gear.y + DOCK_BTN - panelH,
      };
    case "bottom-right":
      return { x: gear.x - gap - panelW, y: gear.y + DOCK_BTN - panelH };
    default:
      return { x: gear.x + DOCK_BTN + gap, y: gear.y };
  }
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
) {
  if (Math.hypot(panel.x - docked.x, panel.y - docked.y) < PANEL_MAGNET_PX) {
    return true;
  }
  return aabbGap(panel, buttons) < PANEL_MAGNET_PX;
}

export function isPanelMoveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-panel-no-move]")) return false;
  if (
    target.closest(
      "input, textarea, select, [role=slider], [contenteditable=true], canvas, [data-panel-resize], [aria-grabbed]",
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
/** Default dock inset — same as `top-3` / `left-3`. */
export const DOCK_INSET = 12;
/** Gear drag starts after this travel (px); below = click. */
export const DOCK_DRAG_PX = 4;

export type DockCorner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

function viewportSize(vw?: number, vh?: number) {
  return {
    vw: vw ?? (typeof window === "undefined" ? 1280 : window.innerWidth),
    vh: vh ?? (typeof window === "undefined" ? 800 : window.innerHeight),
  };
}

export function clampDockPos(
  x: number,
  y: number,
  vw?: number,
  vh?: number,
) {
  const size = viewportSize(vw, vh);
  const maxX = Math.max(DOCK_INSET, size.vw - DOCK_BTN - DOCK_INSET);
  const maxY = Math.max(DOCK_INSET, size.vh - DOCK_BTN - DOCK_INSET);
  return {
    x: Math.min(maxX, Math.max(DOCK_INSET, x)),
    y: Math.min(maxY, Math.max(DOCK_INSET, y)),
  };
}

export function dockPosForCorner(
  corner: DockCorner,
  vw?: number,
  vh?: number,
) {
  const size = viewportSize(vw, vh);
  const right = Math.max(DOCK_INSET, size.vw - DOCK_BTN - DOCK_INSET);
  const bottom = Math.max(DOCK_INSET, size.vh - DOCK_BTN - DOCK_INSET);
  switch (corner) {
    case "top-right":
      return { x: right, y: DOCK_INSET };
    case "bottom-left":
      return { x: DOCK_INSET, y: bottom };
    case "bottom-right":
      return { x: right, y: bottom };
    default:
      return { x: DOCK_INSET, y: DOCK_INSET };
  }
}

/** Nearest of the four corners — same rule as Next.js Dev Tools. */
export function nearestDockCorner(
  x: number,
  y: number,
  vw?: number,
  vh?: number,
): DockCorner {
  const size = viewportSize(vw, vh);
  const cx = x + DOCK_BTN / 2;
  const cy = y + DOCK_BTN / 2;
  const top = cy < size.vh / 2;
  const left = cx < size.vw / 2;
  return `${top ? "top" : "bottom"}-${left ? "left" : "right"}`;
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

export const SNAPSHOT_SLOTS = 5;

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
