/** One bar on the new timeline. Columns are 1–6, so six slots stay in settings. */
export const BAR_SLOTS = 6;

export type BarClip = { start: number; duration: number };

export const BAR_TIME_DEFAULTS: BarClip[] = Array.from({ length: BAR_SLOTS }, (_, index) => ({
  start: 500 + index * 80,
  duration: 300,
}));

export function barClip(times: readonly BarClip[] | undefined, index: number): BarClip {
  const fallback = BAR_TIME_DEFAULTS[index] ?? BAR_TIME_DEFAULTS[BAR_TIME_DEFAULTS.length - 1];
  const slot = times?.[index];
  return {
    start: slot != null && Number.isFinite(slot.start) ? slot.start : fallback.start,
    duration: slot != null && Number.isFinite(slot.duration) ? slot.duration : fallback.duration,
  };
}

export function writeBarClip(times: readonly BarClip[] | undefined, index: number, next: BarClip): BarClip[] {
  return Array.from({ length: BAR_SLOTS }, (_, i) => (i === index ? next : barClip(times, i)));
}
