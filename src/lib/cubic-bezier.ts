export type CubicBezier = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

const KEYWORD_BEZIER: Record<string, CubicBezier> = {
  linear: { x1: 0, y1: 0, x2: 1, y2: 1 },
  ease: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  "ease-in": { x1: 0.42, y1: 0, x2: 1, y2: 1 },
  "ease-out": { x1: 0, y1: 0, x2: 0.58, y2: 1 },
  "ease-in-out": { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
};

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function cubicBezierToCss(c: CubicBezier): string {
  return `cubic-bezier(${c.x1}, ${c.y1}, ${c.x2}, ${c.y2})`;
}

/** Unit cubic (0,0)→(1,1) with control points — one dimension */
function bezier1d(t: number, p1: number, p2: number): number {
  const u = 1 - t;
  return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t;
}

function bezier1dDerivative(t: number, p1: number, p2: number): number {
  const u = 1 - t;
  return 3 * u * u * p1 + 6 * u * t * (p2 - p1) + 3 * t * t * (1 - p2);
}

/**
 * CSS `cubic-bezier` sample: given linear time x ∈ [0,1], return eased y.
 * Solves Bézier-x for parameter t, then evaluates Bézier-y.
 */
export function sampleCubicBezier(c: CubicBezier, x: number): number {
  const target = clamp01(x);
  let t = target;
  for (let i = 0; i < 8; i++) {
    const xEst = bezier1d(t, c.x1, c.x2);
    const dx = bezier1dDerivative(t, c.x1, c.x2);
    if (Math.abs(dx) < 1e-6) break;
    t = clamp01(t - (xEst - target) / dx);
  }
  return bezier1d(t, c.y1, c.y2);
}

export function formatBezierInput(c: CubicBezier): string {
  return [c.x1, c.y1, c.x2, c.y2]
    .map((value) => {
      if (!Number.isFinite(value)) return "0";
      return value.toFixed(4).replace(/\.?0+$/, "");
    })
    .join(", ");
}

export function parseEasingValue(
  value: unknown,
  fallback: CubicBezier,
): CubicBezier {
  if (typeof value === "string") {
    return parseBezierInput(value) ?? fallback;
  }

  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const parsed = bezierFromNums(rec.x1, rec.y1, rec.x2, rec.y2);
    if (parsed) return parsed;
  }

  return fallback;
}

function bezierFromNums(
  x1: unknown,
  y1: unknown,
  x2: unknown,
  y2: unknown,
): CubicBezier | null {
  const nums = [x1, y1, x2, y2].map((part) => Number(part));
  if (nums.some((num) => !Number.isFinite(num))) return null;
  return {
    x1: clamp01(nums[0]!),
    y1: nums[1]!,
    x2: clamp01(nums[2]!),
    y2: nums[3]!,
  };
}

export function parseBezierInput(raw: string): CubicBezier | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const keyword = KEYWORD_BEZIER[trimmed.toLowerCase()];
  if (keyword) return keyword;

  const paren = /^cubic-bezier\s*\(\s*([^)]+?)\s*\)\s*$/i.exec(trimmed);
  const inner = paren ? paren[1] : trimmed;
  const parts = inner
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== 4) return null;
  return bezierFromNums(parts[0], parts[1], parts[2], parts[3]);
}
