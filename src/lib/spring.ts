/** G8: damped spring from 0 to 1 — the same model as CSS / Motion springs. */

export type SpringConfig = { stiffness: number; damping: number; mass: number };

export type SpringPreset = SpringConfig & {
  id: string;
  ru: string;
  en: string;
};

/** Templates in the spring dropdown. A curve that matches none of them is «Своя». */
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

/** Last moment the spring is farther than `SPRING_REST` from 1, in ms. */
export function springSettleMs(config: SpringConfig) {
  let last = 0;
  for (let ms = 0; ms <= MAX_MS; ms += 1) {
    if (Math.abs(1 - springValue(config, ms / 1000)) > SPRING_REST) last = ms;
  }
  return last + 1;
}

/** CSS `linear()` easing over `springSettleMs` — pair with that duration. */
export function springLinearEasing(config: SpringConfig, points = 48) {
  const duration = springSettleMs(config) / 1000;
  const stops = Array.from({ length: points + 1 }, (_, i) =>
    Number(springValue(config, (duration * i) / points).toFixed(4)),
  );
  stops[points] = 1;
  return `linear(${stops.join(", ")})`;
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
