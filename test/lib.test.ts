import { describe, expect, it } from "vitest";
import {
  formatBezierInput,
  parseBezierInput,
  sampleCubicBezier,
} from "../src/lib/cubic-bezier";
import { evalNumberExpression } from "../src/lib/eval-number-expression";
import { hexWithAlpha, normalizeHex } from "../src/lib/hex";
import {
  captionsAtQ,
  fitClipsToTotal,
  layoutClips,
  resolveTotal,
  staggerSpan,
  waapiSpan,
} from "../src/lib/player-clips";
import { parseSkipCells, serializeSkipCells } from "../src/lib/skip-cells";

describe("evalNumberExpression", () => {
  it("evaluates arithmetic with precedence and parentheses", () => {
    expect(evalNumberExpression("700/2", 0)).toBe(350);
    expect(evalNumberExpression("(3+1)*20", 0)).toBe(80);
    expect(evalNumberExpression("2+3*4", 0)).toBe(14);
    expect(evalNumberExpression("-5", 0)).toBe(-5);
  });

  it("treats a leading + as relative to the current value", () => {
    expect(evalNumberExpression("+50", 100)).toBe(150);
    expect(evalNumberExpression("+50-20", 100)).toBe(130);
  });

  it("accepts comma decimals", () => {
    expect(evalNumberExpression("0,5", 0)).toBe(0.5);
  });

  it("rejects garbage and division by zero", () => {
    expect(evalNumberExpression("", 1)).toBeNull();
    expect(evalNumberExpression("abc", 1)).toBeNull();
    expect(evalNumberExpression("(1+2", 1)).toBeNull();
    expect(evalNumberExpression("1/0", 1)).toBeNull();
  });
});

describe("normalizeHex", () => {
  it("uppercases and expands short hex", () => {
    expect(normalizeHex("#abc", "#000000")).toBe("#AABBCC");
    expect(normalizeHex(" #ff00aa ", "#000000")).toBe("#FF00AA");
  });

  it("falls back on invalid input", () => {
    expect(normalizeHex("red", "#111111")).toBe("#111111");
    expect(normalizeHex(42, "#111111")).toBe("#111111");
  });

  it("formats rgba with a clamped alpha", () => {
    expect(hexWithAlpha("#FF0000", 2)).toBe("rgba(255, 0, 0, 1)");
  });
});

describe("player clips", () => {
  it("packs clips without a start and keeps explicit starts", () => {
    const laid = layoutClips([
      { duration: 300 },
      { duration: 200 },
      { duration: 100, start: 50 },
    ]);
    expect(laid.map((clip) => [clip.start, clip.end])).toEqual([
      [0, 300],
      [300, 500],
      [50, 150],
    ]);
  });

  it("spans a stagger parent over all lines", () => {
    expect(staggerSpan(400, { count: 3, step: 50 })).toBe(500);
    expect(staggerSpan(400, { count: 1, step: 50 })).toBe(400);
  });

  it("resolves Auto total from clip ends", () => {
    const laid = layoutClips([{ duration: 300 }, { duration: 200 }]);
    expect(resolveTotal(0, laid, 0, true)).toBe(500);
    expect(resolveTotal(0, laid, 0, false)).toBe(0);
    expect(resolveTotal(900, laid, 0, true)).toBe(900);
  });

  it("trims clips to the timeline", () => {
    const laid = layoutClips([{ duration: 800, start: 400 }]);
    const [clip] = fitClipsToTotal(laid, 1000, 10);
    expect(clip).toMatchObject({ start: 400, end: 1000, duration: 600 });
  });

  it("names every phase under the playhead", () => {
    const laid = layoutClips([
      { duration: 500 },
      { duration: 500, start: 250 },
    ]);
    expect(captionsAtQ(laid, ["a", "b"], 0.3, 1000)).toEqual(["a", "b"]);
    expect(captionsAtQ(laid, ["a", "b"], 0.6, 1000)).toEqual(["b"]);
  });

  it("builds a WAAPI span that adds up to the total", () => {
    const span = waapiSpan(100, 300, 1000);
    expect(span.delay + span.duration + span.endDelay).toBe(1000);
  });
});

describe("skip cells", () => {
  it("round-trips the stored string", () => {
    const rows = parseSkipCells("2 | 4, 5 | - | 1");
    expect(rows).toEqual([[1], [3, 4], [], [0]]);
    expect(serializeSkipCells(rows)).toBe("2 | 4, 5 | - | 1");
  });
});

describe("cubic bezier", () => {
  it("samples the ends exactly and linear as identity", () => {
    const linear = { x1: 0, y1: 0, x2: 1, y2: 1 };
    expect(sampleCubicBezier(linear, 0.37)).toBeCloseTo(0.37, 4);
    expect(sampleCubicBezier({ x1: 0.22, y1: 1, x2: 0.36, y2: 1 }, 1)).toBe(1);
  });

  it("round-trips the coords input", () => {
    const curve = { x1: 0.22, y1: 1, x2: 0.36, y2: 1 };
    expect(formatBezierInput(curve)).toBe("0.22, 1, 0.36, 1");
    expect(parseBezierInput("0.22, 1, 0.36, 1")).toEqual(curve);
  });
});
