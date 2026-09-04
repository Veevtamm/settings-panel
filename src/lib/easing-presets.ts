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

export function easingForPreset(id: EasingPresetId) {
  if (id === "custom") return null;
  return EASING_PRESETS[id];
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
export function matchEasingPreset(value: string | CubicBezier): EasingPresetId {
  const target =
    typeof value === "string" ? parseBezierInput(value) : value;
  if (!target) return "custom";

  for (const [id, easing] of Object.entries(EASING_PRESETS)) {
    const preset = parseBezierInput(easing);
    if (preset && bezierEq(preset, target)) return id as EasingPresetId;
  }
  return "custom";
}
