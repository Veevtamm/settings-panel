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
