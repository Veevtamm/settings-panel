import { formatBezierInput, type CubicBezier } from "./cubic-bezier";
import type { ExtraEasingPreset } from "./easing-presets";

/** A curve the user saved from the Bezier window. Lives in `${panelId}:curves`. */
export type SavedCurve = {
  id: string;
  label: string;
  /** `x1, y1, x2, y2` — `parseBezierInput` reads it. */
  easing: string;
};

const LABEL_MAX = 40;

export function parseSavedCurves(raw: unknown): SavedCurve[] {
  if (!Array.isArray(raw)) return [];
  const curves: SavedCurve[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id.trim() : "";
    const label = typeof rec.label === "string" ? rec.label.trim() : "";
    const easing = typeof rec.easing === "string" ? rec.easing.trim() : "";
    if (!id || !label || !easing || id === "custom") continue;
    curves.push({ id, label: label.slice(0, LABEL_MAX), easing });
  }
  return curves;
}

export function savedCurveExtras(
  curves: readonly SavedCurve[],
): ExtraEasingPreset[] {
  return curves.map((curve) => ({
    id: curve.id,
    label: curve.label,
    easing: curve.easing,
  }));
}

/** Adds a named copy of `curve`. Empty names are ignored. */
export function appendSavedCurve(
  curves: readonly SavedCurve[],
  label: string,
  curve: CubicBezier,
): SavedCurve[] {
  const name = label.trim().slice(0, LABEL_MAX);
  if (!name) return [...curves];
  let id = `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  while (curves.some((item) => item.id === id)) {
    id = `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
  return [...curves, { id, label: name, easing: formatBezierInput(curve) }];
}
