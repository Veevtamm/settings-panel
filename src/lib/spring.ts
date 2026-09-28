/** G8: damped spring from 0 to 1 — the same model as CSS / Motion springs. */

export type SpringConfig = { stiffness: number; damping: number; mass: number };

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
