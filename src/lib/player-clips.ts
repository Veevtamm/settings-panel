import { clampNumber } from "./utils";

export type ClipInput = {
  duration: number;
  /** Absolute start. Omit = pack after the previous packed clip. */
  start?: number;
};

/** E1: `count` lines, each `step` later than the previous. */
export type ClipStagger = { count: number; step: number };

/** Parent clip length: one line + the offset of the last line. */
export function staggerSpan(duration: number, stagger?: ClipStagger) {
  if (stagger == null || stagger.count < 2) return duration;
  return duration + (stagger.count - 1) * stagger.step;
}

export type LaidClip = {
  start: number;
  duration: number;
  end: number;
  packed: boolean;
};

export function layoutClips(segments: readonly ClipInput[]): LaidClip[] {
  let cursor = 0;
  return segments.map((segment) => {
    const duration = Math.max(0, segment.duration);
    const packed = segment.start == null;
    const start = packed ? cursor : Math.max(0, segment.start ?? 0);
    if (packed) cursor += duration;
    return { start, duration, end: start + duration, packed };
  });
}

/** Furthest clip end — the timeline itself is a separate value and may be longer. */
export function clipsTotal(layout: readonly LaidClip[]): number {
  return layout.reduce((max, clip) => Math.max(max, clip.end), 0);
}

/**
 * Stored `totalKey` ≤ 0 means Auto (A4): the length is max(clip end), not a
 * ceiling. Existing scenes keep a positive total and stay manual.
 */
export const TOTAL_AUTO = 0;

export function isTotalAuto(stored: number) {
  return !Number.isFinite(stored) || stored <= 0;
}

export function autoTotal(layout: readonly LaidClip[], min = 0) {
  return Math.max(clipsTotal(layout), min);
}

/** Visual / WAAPI length: Auto → span of clips, else the stored ceiling. */
export function resolveTotal(
  stored: number,
  layout: readonly LaidClip[],
  min = 0,
  allowAuto = false,
) {
  if (allowAuto && isTotalAuto(stored)) return autoTotal(layout, min);
  return Math.max(stored, min);
}

/**
 * Move several clips by one delta. The group stops at 0 and at `ceiling`,
 * and the gaps between the clips stay put. Clips outside `origins` are left
 * alone.
 */
export function shiftClipGroup(
  layout: readonly LaidClip[],
  origins: ReadonlyMap<number, number>,
  delta: number,
  ceiling: number,
): LaidClip[] {
  if (origins.size === 0) return layout.slice();
  let minDelta = Number.NEGATIVE_INFINITY;
  let maxDelta = Number.POSITIVE_INFINITY;
  for (const [index, origin] of origins) {
    const clip = layout[index];
    if (!clip) continue;
    const maxStart = Math.max(0, ceiling - clip.duration);
    minDelta = Math.max(minDelta, -origin);
    maxDelta = Math.min(maxDelta, maxStart - origin);
  }
  const applied =
    minDelta > maxDelta ? 0 : clampNumber(delta, minDelta, maxDelta);
  return layout.map((clip, index) => {
    const origin = origins.get(index);
    if (origin == null) return clip;
    const start = origin + applied;
    return { ...clip, packed: false, start, end: start + clip.duration };
  });
}

function snapGrid(value: number, grid: number) {
  if (!(grid > 0)) return value;
  return Math.round(value / grid) * grid;
}

/**
 * Space clips evenly. The gap is the distance from the first start to the
 * last; when they already share a start, the gap is the first clip's duration.
 * The run stays inside `ceiling`.
 */
export function evenClipStarts(
  layout: readonly LaidClip[],
  indices: readonly number[],
  grid: number,
  ceiling: number,
): LaidClip[] {
  const ordered = [...new Set(indices)].filter((index) => layout[index] != null);
  ordered.sort((a, b) => layout[a].start - layout[b].start || a - b);
  if (ordered.length < 2) return layout.slice();
  const firstStart = layout[ordered[0]].start;
  const lastStart = layout[ordered[ordered.length - 1]].start;
  const gaps = ordered.length - 1;
  const span = lastStart - firstStart;
  let step =
    span > grid / 2
      ? Math.max(grid, snapGrid(span / gaps, grid))
      : Math.max(grid, snapGrid(layout[ordered[0]].duration, grid));
  const lastDuration = layout[ordered[ordered.length - 1]].duration;
  const maxStep = Math.max(0, (ceiling - lastDuration - firstStart) / gaps);
  if (step > maxStep) step = maxStep;
  const starts = new Map<number, number>();
  ordered.forEach((index, k) => {
    const start = firstStart + k * step;
    const room = Math.max(0, ceiling - layout[index].duration);
    starts.set(index, clampNumber(start, 0, room));
  });
  return layout.map((clip, index) => {
    const start = starts.get(index);
    if (start == null) return clip;
    return { ...clip, packed: false, start, end: start + clip.duration };
  });
}

/** Place selected clips on a fixed start interval. The first stays; clip k starts `gap` later. */
export function spaceClipStarts(
  layout: readonly LaidClip[],
  indices: readonly number[],
  gap: number,
  ceiling: number,
): LaidClip[] {
  const ordered = [...new Set(indices)].filter((index) => layout[index] != null);
  ordered.sort((a, b) => layout[a].start - layout[b].start || a - b);
  if (ordered.length < 2) return layout.slice();
  const firstStart = layout[ordered[0]].start;
  const starts = new Map<number, number>();
  ordered.forEach((index, k) => {
    const start = firstStart + k * gap;
    const room = Math.max(0, ceiling - layout[index].duration);
    starts.set(index, clampNumber(start, 0, room));
  });
  return layout.map((clip, index) => {
    const start = starts.get(index);
    if (start == null) return clip;
    return { ...clip, packed: false, start, end: start + clip.duration };
  });
}

/** Clips trimmed to a timeline of `total` ms: start ≤ total − min, end ≤ total. */
export function fitClipsToTotal(
  layout: readonly LaidClip[],
  total: number,
  min: number,
): LaidClip[] {
  return layout.map((clip) => {
    if (clip.end <= total) return clip;
    const start = clampNumber(clip.start, 0, Math.max(0, total - min));
    const duration = Math.max(min, Math.min(clip.duration, total - start));
    return { ...clip, packed: false, start, duration, end: start + duration };
  });
}

/** Captions whose window contains t. Overlap → several names. */
export function captionsAtQ(
  layout: readonly LaidClip[],
  captions: readonly string[],
  q: number,
  total: number,
): string[] {
  if (total <= 0) {
    const first = captions[0];
    return first ? [first] : [];
  }
  const t = clampNumber(q, 0, 1) * total;
  const hit: string[] = [];
  layout.forEach((clip, i) => {
    const name = captions[i];
    if (!name) return;
    const inside =
      clip.end >= total
        ? t >= clip.start && t <= clip.end
        : t >= clip.start && t < clip.end;
    if (inside && name) hit.push(name);
  });
  return hit;
}

export function momentMs(total: number, q: number) {
  return Math.round(clampNumber(q, 0, 1) * total);
}

/** delay + duration + endDelay = total, so one currentTime is the shared clock. */
export function waapiSpan(start: number, duration: number, total: number) {
  const st = Math.max(0, start);
  const dur = Math.max(1, duration);
  const end = st + dur;
  const tot = Math.max(total, end, 1);
  return {
    delay: st,
    duration: dur,
    endDelay: Math.max(0, tot - end),
    fill: "both" as const,
  };
}
