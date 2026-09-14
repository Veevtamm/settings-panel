import { parseBezierInput, type CubicBezier } from "./cubic-bezier";

export const EASING_PRESETS = {
  linear: "linear",
  ease: "ease",
  "ease-in": "ease-in",
  "ease-out": "ease-out",
  "ease-in-out": "ease-in-out",
  easeOutQuad: "cubic-bezier(0.5, 1, 0.89, 1)",
  easeOutCubic: "cubic-bezier(0.33, 1, 0.68, 1)",
  easeOutQuart: "cubic-bezier(0.25, 1, 0.5, 1)",
  easeOutExpo: "cubic-bezier(0.16, 1, 0.3, 1)",
  easeInOutQuart: "cubic-bezier(0.76, 0, 0.24, 1)",
  easeInOutExpo: "cubic-bezier(0.87, 0, 0.13, 1)",
  easeInOutBack: "cubic-bezier(0.68, -0.6, 0.32, 1.6)",
} as const;

export type EasingPresetId = keyof typeof EASING_PRESETS | "custom";

/** Scene-only curves appended to the Bezier preset list. Do not add these to `EASING_PRESETS`. */
export type ExtraEasingPreset = {
  id: string;
  label: string;
  easing: string;
};

/** Labels as in Figma Motion Panel preset list */
export const EASING_PRESET_LABELS: Record<EasingPresetId, string> = {
  custom: "Custom bezier",
  linear: "Linear",
  ease: "Ease",
  "ease-in": "Ease-In",
  "ease-out": "Ease-Out",
  "ease-in-out": "Ease-In-Out",
  easeOutQuad: "Ease-Out Quad",
  easeOutCubic: "Ease-Out Cubic",
  easeOutQuart: "Ease-Out Quart",
  easeOutExpo: "Ease-Out Expo",
  easeInOutQuart: "Ease-In-Out Quart",
  easeInOutExpo: "Ease-In-Out Expo",
  easeInOutBack: "Ease-In-Out Back",
};

/** Flat order for the open preset list (Custom first, then groups) */
export const EASING_PRESET_LIST: EasingPresetId[] = [
  "custom",
  "linear",
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "easeOutQuad",
  "easeOutCubic",
  "easeOutQuart",
  "easeOutExpo",
  "easeInOutQuart",
  "easeInOutExpo",
  "easeInOutBack",
];

export const EASING_PRESET_GROUPS: {
  title: string;
  ids: Exclude<EasingPresetId, "custom">[];
}[] = [
  {
    title: "CSS",
    ids: ["linear", "ease", "ease-in", "ease-out", "ease-in-out"],
  },
  {
    title: "Out",
    ids: ["easeOutQuad", "easeOutCubic", "easeOutQuart", "easeOutExpo"],
  },
  {
    title: "In Out",
    ids: ["easeInOutQuart", "easeInOutExpo", "easeInOutBack"],
  },
];

export function extraEasingPresets(
  extras: readonly ExtraEasingPreset[] = [],
): ExtraEasingPreset[] {
  return extras.filter(
    (extra) => extra.id !== "custom" && !(extra.id in EASING_PRESETS),
  );
}

export function easingPresetOptions(
  extras: readonly ExtraEasingPreset[] = [],
): { id: string; label: string }[] {
  return [
    ...EASING_PRESET_LIST.map((id) => ({
      id,
      label: EASING_PRESET_LABELS[id],
    })),
    ...extraEasingPresets(extras).map((extra) => ({
      id: extra.id,
      label: extra.label,
    })),
  ];
}

export function easingForPreset(
  id: string,
  extras: readonly ExtraEasingPreset[] = [],
) {
  if (id === "custom") return null;
  if (id in EASING_PRESETS) {
    return EASING_PRESETS[id as keyof typeof EASING_PRESETS];
  }
  return extraEasingPresets(extras).find((extra) => extra.id === id)?.easing ?? null;
}

/** 16×16 preset glyph path for a cubic-bezier (same frame as built-in icons). */
export function presetCurvePath(curve: CubicBezier) {
  const x = (t: number) => 0.75 + t * 14;
  const y = (t: number) => 14.75 - t * 14;
  return `M0.75 14.75C${x(curve.x1)} ${y(curve.y1)} ${x(curve.x2)} ${y(curve.y2)} 14.75 0.75`;
}

function approxEq(a: number, b: number) {
  return Math.abs(a - b) < 1e-4;
}

function bezierEq(a: CubicBezier, b: CubicBezier) {
  return (
    approxEq(a.x1, b.x1) &&
    approxEq(a.y1, b.y1) &&
    approxEq(a.x2, b.x2) &&
    approxEq(a.y2, b.y2)
  );
}

/** Match by curve values — keywords and cubic-bezier() both resolve. */
export function matchEasingPreset(
  value: string | CubicBezier,
  extras: readonly ExtraEasingPreset[] = [],
): string {
  const target =
    typeof value === "string" ? parseBezierInput(value) : value;
  if (!target) return "custom";

  for (const [id, easing] of Object.entries(EASING_PRESETS)) {
    const preset = parseBezierInput(easing);
    if (preset && bezierEq(preset, target)) return id;
  }
  for (const extra of extraEasingPresets(extras)) {
    const preset = parseBezierInput(extra.easing);
    if (preset && bezierEq(preset, target)) return extra.id;
  }
  return "custom";
}
