import { clampNumber, round200 } from "./utils";

/** Multi-point axis curve — port of Osnova workshop axisXf / segCtrl (simplified). */

export type AxisPoint = readonly [t: number, x: number];

/**
 * Auto handle = null (smooth).
 * Symmetric [outT, outX]; broken [outT, outX, inT, inX].
 * Corner = [0, 0] (zero-length handles → sharp join, no Bézier handles).
 */
export type AxisHandle =
  | null
  | [number, number]
  | [number, number, number, number];

const HANDLE_EPS = 1e-6;

export const CORNER_HANDLE: AxisHandle = [0, 0];

export function isCornerHandle(h: AxisHandle | undefined): boolean {
  if (!h) return false;
  const z = (n: number | undefined) => Math.abs(n ?? 0) < HANDLE_EPS;
  if (h.length > 2) return z(h[0]) && z(h[1]) && z(h[2]) && z(h[3]);
  return z(h[0]) && z(h[1]);
}

export function setAxisPointCorner(
  pts: AxisPoint[],
  handles: AxisHandle[],
  index: number,
  corner: boolean,
): AxisHandle[] {
  const hs = ensureAxisHandles(pts, handles);
  if (index < 0 || index >= pts.length) return hs;
  hs[index] = corner ? CORNER_HANDLE : null;
  return hs;
}

export const AXIS_X0 = -0.25;
export const AXIS_X1 = 1.25;
export const AXIS_POINTS_MIN = 2;
export const AXIS_POINTS_MAX = 12;

export function cloneAxisPoints(pts: AxisPoint[]): AxisPoint[] {
  return pts.map(([t, x]): AxisPoint => [t, x]);
}

export function cloneAxisHandles(handles: AxisHandle[]): AxisHandle[] {
  return handles.map((h): AxisHandle => {
    if (!h) return null;
    if (h.length > 2) return [h[0], h[1], h[2] ?? 0, h[3] ?? 0];
    return [h[0], h[1]];
  });
}

export function ensureAxisHandles(
  pts: AxisPoint[],
  handles?: AxisHandle[],
): AxisHandle[] {
  const next = handles ? cloneAxisHandles(handles) : [];
  while (next.length < pts.length) next.push(null);
  if (next.length > pts.length) next.length = pts.length;
  return next;
}

export function autoHandle(pts: AxisPoint[], j: number): [number, number] {
  const n = pts.length;
  const p0 = pts[Math.max(0, j - 1)]!;
  const p2 = pts[Math.min(n - 1, j + 1)]!;
  const m = (p2[1] - p0[1]) / Math.max(1e-6, p2[0] - p0[0]);
  const hh =
    (j < n - 1
      ? pts[j + 1]![0] - pts[j]![0]
      : pts[j]![0] - pts[j - 1]![0]) / 3;
  return [hh, m * hh];
}

/** Segment cubic controls for pts[i] → pts[i+1] */
export function segmentControls(
  pts: AxisPoint[],
  handles: AxisHandle[],
  i: number,
): [[number, number], [number, number]] {
  const n = pts.length;
  const t0 = pts[i]![0];
  const t1 = pts[i + 1]![0];
  const v0 = pts[i]![1];
  const v1 = pts[i + 1]![1];
  const h = Math.max(1e-6, t1 - t0);
  const Hi = handles[i];
  const Hj = handles[i + 1];

  let c1: [number, number];
  if (Hi) {
    c1 = [t0 + Hi[0]!, v0 + Hi[1]!];
  } else {
    const p0 = pts[Math.max(0, i - 1)]!;
    const pn = pts[Math.min(n - 1, i + 1)]!;
    const m0 = (pn[1] - p0[1]) / Math.max(1e-6, pn[0] - p0[0]);
    c1 = [t0 + h / 3, v0 + (m0 * h) / 3];
  }

  let c2: [number, number];
  if (Hj) {
    const hb = Hj.length > 2 ? 2 : 0;
    c2 = [t1 - Hj[hb]!, v1 - Hj[hb + 1]!];
  } else {
    const q1 = pts[Math.max(0, i)]!;
    const q2 = pts[Math.min(n - 1, i + 2)]!;
    const m1 = (q2[1] - q1[1]) / Math.max(1e-6, q2[0] - q1[0]);
    c2 = [t1 - h / 3, v1 - (m1 * h) / 3];
  }

  c1[0] = clampNumber(c1[0], t0, t1);
  c2[0] = clampNumber(c2[0], t0, t1);
  return [c1, c2];
}

/** Sample x at progress t ∈ [0,1] along the axis. sharp 0 = curve, 1 = polyline. */
export function sampleAxisX(
  pts: AxisPoint[],
  handles: AxisHandle[],
  t: number,
  sharp = 0,
): number {
  const tt = clampNumber(t, 0, 1);
  const n = pts.length;
  if (n < 2) return pts[0]?.[1] ?? 0;

  let i = 0;
  while (i < n - 2 && tt > pts[i + 1]![0]) i++;

  const t0 = pts[i]![0];
  const t1 = pts[i + 1]![0];
  const v0 = pts[i]![1];
  const v1 = pts[i + 1]![1];
  const [c1, c2] = segmentControls(pts, handles, i);
  const [c1t, c1x] = c1;
  const [c2t, c2x] = c2;

  let u = t1 > t0 ? (tt - t0) / (t1 - t0) : 0;
  for (let it = 0; it < 6; it++) {
    const mu = 1 - u;
    const tu =
      mu * mu * mu * t0 +
      3 * mu * mu * u * c1t +
      3 * mu * u * u * c2t +
      u * u * u * t1;
    const dtu =
      3 * mu * mu * (c1t - t0) +
      6 * mu * u * (c2t - c1t) +
      3 * u * u * (t1 - c2t);
    if (Math.abs(dtu) < 1e-6) break;
    u = clampNumber(u - (tu - tt) / dtu, 0, 1);
  }

  const lin = v0 + (v1 - v0) * u;
  const mu2 = 1 - u;
  const val =
    mu2 * mu2 * mu2 * v0 +
    3 * mu2 * mu2 * u * c1x +
    3 * mu2 * u * u * c2x +
    u * u * u * v1;
  return val * (1 - sharp) + lin * sharp;
}

export function sampleAxisPath(
  pts: AxisPoint[],
  handles: AxisHandle[],
  samples = 100,
  sharp = 0,
): { t: number; x: number }[] {
  const out: { t: number; x: number }[] = [];
  for (let s = 0; s <= samples; s++) {
    const t = s / samples;
    out.push({ t, x: sampleAxisX(pts, handles, t, sharp) });
  }
  return out;
}

export function insertAxisMid(
  pts: AxisPoint[],
  handles: AxisHandle[],
  sharp = 0,
): { pts: AxisPoint[]; handles: AxisHandle[] } | null {
  if (pts.length >= AXIS_POINTS_MAX) return null;
  let bi = 0;
  let bl = -1;
  for (let j = 0; j < pts.length - 1; j++) {
    const l = pts[j + 1]![0] - pts[j]![0];
    if (l > bl) {
      bl = l;
      bi = j;
    }
  }
  const tm = round200((pts[bi]![0] + pts[bi + 1]![0]) / 2);
  const xm = round200(sampleAxisX(pts, handles, tm, sharp));
  const nextPts = cloneAxisPoints(pts);
  const nextH = ensureAxisHandles(pts, handles);
  nextPts.splice(bi + 1, 0, [tm, xm]);
  nextH.splice(bi + 1, 0, null);
  return { pts: nextPts, handles: nextH };
}

export function removeAxisBest(
  pts: AxisPoint[],
  handles: AxisHandle[],
): { pts: AxisPoint[]; handles: AxisHandle[] } | null {
  if (pts.length <= AXIS_POINTS_MIN) return null;
  let bi = 1;
  let bd = Infinity;
  for (let j = 1; j < pts.length - 1; j++) {
    const t0 = pts[j - 1]![0];
    const t1 = pts[j + 1]![0];
    const u = t1 > t0 ? (pts[j]![0] - t0) / (t1 - t0) : 0.5;
    const lin = pts[j - 1]![1] + (pts[j + 1]![1] - pts[j - 1]![1]) * u;
    const d = Math.abs(pts[j]![1] - lin);
    if (d < bd) {
      bd = d;
      bi = j;
    }
  }
  const nextPts = cloneAxisPoints(pts);
  const nextH = ensureAxisHandles(pts, handles);
  nextPts.splice(bi, 1);
  nextH.splice(bi, 1);
  return { pts: nextPts, handles: nextH };
}

export function setAxisPointCount(
  pts: AxisPoint[],
  handles: AxisHandle[],
  count: number,
  sharp = 0,
): { pts: AxisPoint[]; handles: AxisHandle[] } {
  const target = clampNumber(Math.round(count), AXIS_POINTS_MIN, AXIS_POINTS_MAX);
  let nextPts = cloneAxisPoints(pts);
  let nextH = ensureAxisHandles(pts, handles);
  while (nextPts.length < target) {
    const inserted = insertAxisMid(nextPts, nextH, sharp);
    if (!inserted) break;
    nextPts = inserted.pts;
    nextH = inserted.handles;
  }
  while (nextPts.length > target) {
    const removed = removeAxisBest(nextPts, nextH);
    if (!removed) break;
    nextPts = removed.pts;
    nextH = removed.handles;
  }
  return { pts: nextPts, handles: nextH };
}

/** Move a knot. Endpoints: t fixed, X free.
 *  Middles: t between neighbors (stable order), X free for zigzags.
 *  Stale handles on the moved knot are cleared → auto, so X edits aren’t fought. */
export function moveAxisPoint(
  pts: AxisPoint[],
  handles: AxisHandle[],
  index: number,
  nextT: number,
  nextX: number,
): { pts: AxisPoint[]; handles: AxisHandle[]; index: number } {
  const last = pts.length - 1;
  const x = round200(clampNumber(nextX, AXIS_X0, AXIS_X1));
  const out = cloneAxisPoints(pts);
  const hs = cloneAxisHandles(ensureAxisHandles(pts, handles));

  const keepCorner = isCornerHandle(hs[index]);
  const afterMove: AxisHandle = keepCorner ? CORNER_HANDLE : null;

  if (index === 0 || index === last) {
    out[index] = [out[index]![0], x];
    hs[index] = afterMove;
    return { pts: out, handles: hs, index };
  }

  const t = round200(
    clampNumber(nextT, out[index - 1]![0] + 0.02, out[index + 1]![0] - 0.02),
  );
  out[index] = [t, x];
  hs[index] = afterMove;
  return { pts: out, handles: hs, index };
}
