/** G8: damped spring from 0 to 1 — the same model as CSS / Motion springs. */

export type SpringConfig = { stiffness: number; damping: number; mass: number };

export type SpringPreset = SpringConfig & {
  id: string;
  ru: string;
  en: string;
};

/** Templates in the spring dropdown. A curve that matches none of them is «Custom». */
export const SPRING_PRESET_GROUPS: {
  key: "smooth" | "snappy" | "overshoot";
  presets: readonly SpringPreset[];
}[] = [
  {
    key: "smooth",
    presets: [
      { id: "gentle", ru: "Мягкая", en: "Gentle", stiffness: 120, damping: 22, mass: 1 },
      { id: "smooth", ru: "Плавная", en: "Smooth", stiffness: 170, damping: 26, mass: 1 },
    ],
  },
  {
    key: "snappy",
    presets: [
      { id: "snappy", ru: "Быстрая", en: "Snappy", stiffness: 400, damping: 36, mass: 1 },
      { id: "stiff", ru: "Жёсткая", en: "Stiff", stiffness: 700, damping: 48, mass: 1 },
    ],
  },
  {
    key: "overshoot",
    presets: [
      { id: "bounce", ru: "Упругая", en: "Bouncy", stiffness: 280, damping: 12, mass: 1 },
      { id: "wobble", ru: "Качели", en: "Wobble", stiffness: 180, damping: 8, mass: 1 },
    ],
  },
];

export function springPresetById(id: string): SpringPreset | undefined {
  for (const group of SPRING_PRESET_GROUPS) {
    const found = group.presets.find((preset) => preset.id === id);
    if (found) return found;
  }
  return undefined;
}

export function matchSpringPreset(value: SpringConfig): string {
  const near = (a: number, b: number) => Math.abs(a - b) < 0.05;
  for (const group of SPRING_PRESET_GROUPS) {
    for (const preset of group.presets) {
      if (
        near(preset.stiffness, value.stiffness) &&
        near(preset.damping, value.damping) &&
        near(preset.mass, value.mass)
      ) {
        return preset.id;
      }
    }
  }
  return "custom";
}

/** Settled = within 0.1% of the target. */
export const SPRING_REST = 0.001;
const MAX_MS = 10_000;

/** Position at `t` seconds, starting at 0 with zero velocity. */
export function springValue({ stiffness, damping, mass }: SpringConfig, t: number) {
  const k = Math.max(stiffness, 1e-6);
  const m = Math.max(mass, 1e-6);
  const w0 = Math.sqrt(k / m);
  const zeta = Math.max(damping, 0) / (2 * Math.sqrt(k * m));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return (
      1 -
      Math.exp(-zeta * w0 * t) *
        (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
    );
  }
  if (zeta === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const root = Math.sqrt(zeta * zeta - 1);
  const r1 = -w0 * (zeta - root);
  const r2 = -w0 * (zeta + root);
  return 1 + (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r1 - r2);
}

function springOutside(config: SpringConfig, ms: number) {
  return Math.abs(1 - springValue(config, ms / 1000)) > SPRING_REST;
}

/** Last millisecond still outside the rest band, plus one.
 *  Same sample as a 1 ms scan. Underdamped motion uses the decay envelope
 *  so the walk stays on the tail; once a critically damped or overdamped
 *  spring is inside the band it stays there, so that sample is a binary search.
 */
export function springSettleMs(config: SpringConfig) {
  const k = Math.max(config.stiffness, 1e-6);
  const m = Math.max(config.mass, 1e-6);
  const w0 = Math.sqrt(k / m);
  const zeta = Math.max(config.damping, 0) / (2 * Math.sqrt(k * m));
  if (!(zeta > 0) || !Number.isFinite(w0)) {
    let last = 0;
    for (let ms = 0; ms <= MAX_MS; ms += 1) {
      if (springOutside(config, ms)) last = ms;
    }
    return last + 1;
  }
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const amp = Math.hypot(1, (zeta * w0) / wd);
    const tStar = Math.log(amp / SPRING_REST) / (zeta * w0);
    let hi = Math.min(MAX_MS, Math.max(0, Math.ceil(tStar * 1000)));
    while (hi < MAX_MS && springOutside(config, hi)) hi += 1;
    let ms = hi;
    while (ms > 0 && !springOutside(config, ms)) ms -= 1;
    return ms + 1;
  }
  if (!springOutside(config, 0)) return 1;
  if (springOutside(config, MAX_MS)) return MAX_MS + 1;
  let lo = 0;
  let hi = MAX_MS;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (springOutside(config, mid)) lo = mid;
    else hi = mid;
  }
  return lo + 1;
}

/** One settle pass, then the CSS `linear()` that spans it. */
export function springCssTransition(config: SpringConfig, points = 48) {
  const settleMs = springSettleMs(config);
  const duration = settleMs / 1000;
  const stops = Array.from({ length: points + 1 }, (_, i) =>
    Number(springValue(config, (duration * i) / points).toFixed(4)),
  );
  stops[points] = 1;
  return { settleMs, easing: `linear(${stops.join(", ")})` };
}

/** CSS `linear()` easing over `springSettleMs` — pair with that duration. */
export function springLinearEasing(config: SpringConfig, points = 48) {
  return springCssTransition(config, points).easing;
}

export function formatSpring({ stiffness, damping, mass }: SpringConfig) {
  return `stiffness ${stiffness}, damping ${damping}, mass ${mass}`;
}

export function readSprings(
  settings: unknown,
): Record<string, SpringConfig> | undefined {
  if (settings == null || typeof settings !== "object") return undefined;
  const springs = (settings as { springs?: unknown }).springs;
  if (springs == null || typeof springs !== "object") return undefined;
  return springs as Record<string, SpringConfig>;
}
