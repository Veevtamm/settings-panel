"use client";

import {
  useCallback,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { CubicBezier } from "./lib/cubic-bezier";
import { clamp01, sampleCubicBezier } from "./lib/cubic-bezier";
import { cn } from "./lib/utils";

const DEFAULT_SIZE = 168;
const PAD_RATIO = 18 / 168;

type EasingCurveEditorProps = {
  value: CubicBezier;
  onChange: (next: CubicBezier) => void;
  size?: number;
  gridStep?: 0.25 | 0.2;
  accent?: string;
  className?: string;
  /** Linear time 0–1 for live Replay preview; null hides playhead */
  playhead?: number | null;
};

export function EasingCurveEditor({
  value,
  onChange,
  size = DEFAULT_SIZE,
  gridStep = 0.25,
  accent = "#ff760d",
  className = "",
  playhead = null,
}: EasingCurveEditorProps) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState<"p1" | "p2" | null>(null);

  const pad = Math.round(PAD_RATIO * size);
  const inner = size - 2 * pad;
  const handleR = Math.max(2.5, (3 * size) / DEFAULT_SIZE);
  const strokeMain = Math.max(1.25, (1.5 * size) / DEFAULT_SIZE);
  const playR = Math.max(3, (3.5 * size) / DEFAULT_SIZE);
  const yMax = Math.max(1, value.y1, value.y2) + 0.1;
  const yMin = Math.min(0, value.y1, value.y2) - 0.1;
  const ySpan = Math.max(0.2, yMax - yMin);

  const toData = (t: number, v: number) => ({
    x: pad + t * inner,
    y: pad + ((yMax - v) / ySpan) * inner,
  });

  const p0 = toData(0, 0);
  const p1 = toData(value.x1, value.y1);
  const p2 = toData(value.x2, value.y2);
  const p3 = toData(1, 1);
  const dPath = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`;
  const dHelp1 = `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`;
  const dHelp2 = `M ${p3.x} ${p3.y} L ${p2.x} ${p2.y}`;

  const playT = playhead == null ? null : clamp01(playhead);
  const playPt =
    playT == null ? null : toData(playT, sampleCubicBezier(value, playT));

  const pickFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const el = svgRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const mx = ((clientX - rect.left) / rect.width) * size;
      const my = ((clientY - rect.top) / rect.height) * size;
      const t = clamp01((mx - pad) / inner);
      const v = yMax - ((my - pad) / inner) * ySpan;
      return { t, v };
    },
    [inner, pad, size, yMax, ySpan],
  );

  const onPointerDown = (which: "p1" | "p2") => (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(which);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragging) return;
    const pt = pickFromEvent(e.clientX, e.clientY);
    if (!pt) return;

    if (dragging === "p1") {
      onChange({ ...value, x1: pt.t, y1: pt.v });
    } else {
      onChange({ ...value, x2: pt.t, y2: pt.v });
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(null);
  };

  const gridLines: ReactNode[] = [];
  for (let s = gridStep; s < 1; s += gridStep) {
    const x0 = toData(s, 0);
    const x1 = toData(s, 1);
    const y0 = toData(0, s);
    const y1 = toData(1, s);
    const key = `g-${s}`;
    gridLines.push(
      <line
        key={`${key}-v`}
        className="stroke-[color:var(--sp-plot-grid)]"
        strokeWidth={0.5}
        x1={x0.x}
        x2={x1.x}
        y1={x0.y}
        y2={x1.y}
      />,
    );
    gridLines.push(
      <line
        key={`${key}-h`}
        className="stroke-[color:var(--sp-plot-grid)]"
        strokeWidth={0.5}
        x1={y0.x}
        x2={y1.x}
        y1={y0.y}
        y2={y1.y}
      />,
    );
  }

  return (
    <svg
      ref={svgRef}
      className={cn("h-auto w-full touch-none", className)}
      id={id}
      style={{ touchAction: "none" }}
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect
        className="fill-[color:var(--sp-plot-bg)]"
        height={inner}
        rx={2}
        width={inner}
        x={pad}
        y={pad}
      />
      {gridLines}
      <line
        className="stroke-[color:var(--sp-plot-diag)]"
        strokeDasharray="4 4"
        strokeWidth={0.75}
        x1={p0.x}
        x2={p3.x}
        y1={p0.y}
        y2={p3.y}
      />
      <path
        className="stroke-[color:var(--sp-plot-help)]"
        d={dHelp1}
        fill="none"
        strokeWidth={1}
      />
      <path
        className="stroke-[color:var(--sp-plot-help)]"
        d={dHelp2}
        fill="none"
        strokeWidth={1}
      />
      <path
        d={dPath}
        fill="none"
        stroke={accent}
        strokeLinecap="round"
        strokeWidth={strokeMain}
      />
      {playPt ? (
        <>
          <line
            className="stroke-[color:var(--sp-plot-play)]"
            strokeDasharray="2 3"
            strokeWidth={0.75}
            x1={playPt.x}
            x2={playPt.x}
            y1={pad}
            y2={pad + inner}
          />
          <circle
            aria-hidden
            className="stroke-[color:var(--sp-plot-handle)]"
            cx={playPt.x}
            cy={playPt.y}
            fill={accent}
            r={playR}
            strokeWidth={1.25}
          />
        </>
      ) : null}
      <circle
        aria-label="First control point"
        className="cursor-grab fill-[color:var(--sp-plot-handle)]"
        cx={p1.x}
        cy={p1.y}
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown("p1")}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        r={handleR}
        stroke={accent}
        strokeWidth={1.5}
        style={{ touchAction: "none" }}
      />
      <circle
        aria-label="Second control point"
        className="cursor-grab fill-[color:var(--sp-plot-handle)]"
        cx={p2.x}
        cy={p2.y}
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown("p2")}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        r={handleR}
        stroke={accent}
        strokeWidth={1.5}
        style={{ touchAction: "none" }}
      />
    </svg>
  );
}
