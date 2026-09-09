import { clampNumber } from "./utils";

export type ClipInput = {
  duration: number;
  /** Absolute start. Omit = pack after the previous packed clip. */
  start?: number;
};

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
