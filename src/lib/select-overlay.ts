/** Open list cap — `max-h-48` on `PanelSelectList`. */
export const SELECT_LIST_MAX_PX = 192;
const VIEW_INSET = 8;

export type SelectOverlaySide = "below" | "above";

export type SelectOverlayPlace = {
  side: SelectOverlaySide;
  /** `ul` max-height so the list stays inside the viewport. */
  listMaxPx: number;
  /** CSS `bottom` when `side` is above (px from viewport bottom). */
  bottom: number;
};

/** Prefer open-below; flip above when the capped list does not fit under the trigger. */
export function placeSelectOverlay(
  triggerTop: number,
  triggerBottom: number,
  viewportH: number,
  listCapPx = SELECT_LIST_MAX_PX,
): SelectOverlayPlace {
  const spaceBelow = viewportH - triggerBottom - VIEW_INSET;
  const spaceAbove = triggerTop - VIEW_INSET;
  const side: SelectOverlaySide =
    spaceBelow >= listCapPx
      ? "below"
      : spaceAbove >= listCapPx || spaceAbove > spaceBelow
        ? "above"
        : "below";
  const room = side === "below" ? spaceBelow : spaceAbove;
  return {
    side,
    listMaxPx: Math.max(0, Math.min(listCapPx, room)),
    bottom: viewportH - triggerBottom,
  };
}
