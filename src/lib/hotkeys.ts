/**
 * Panels bind `KeyboardEvent.code` (physical key) so ЙЦУКЕН / AZERTY
 * still hit the same caps as QWERTY. `event.key` is the layout character.
 */

export function isPhysicalKey(
  event: Pick<KeyboardEvent, "code">,
  codes: readonly string[],
) {
  return codes.includes(event.code);
}

/** Undo / redo: the Z cap, which is Я on JCUKEN. */
export const UNDO_CODES = ["KeyZ"] as const;

/** Scene panel ⌘M / Ctrl+M: the M cap (Ь on JCUKEN). */
export const SCENE_PANEL_CODES = ["KeyM"] as const;

/**
 * Hide dock: US `\` cap, ISO extra key left of Z, and the key that
 * currently types `\` (some layouts put it off `Backslash`).
 */
export const HIDE_DOCK_CODES = ["Backslash", "IntlBackslash"] as const;

export function isHideDockKey(
  event: Pick<KeyboardEvent, "code" | "key">,
) {
  return isPhysicalKey(event, HIDE_DOCK_CODES) || event.key === "\\";
}
