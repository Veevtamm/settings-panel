"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { TOTAL_AUTO, staggerSpan, type LaidClip } from "../lib/player-clips";
import { clampNumber, cn } from "../lib/utils";
import { bindPointerDrag, pickerChrome } from "./chrome";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";
import { snapStep } from "./number";
import {
  LANE_PAD_PX,
  emitClips,
  layoutOf,
  segmentSpanMax,
  trackMarkerLeft,
  trackQFromClientX,
  trackX,
  usePlayerState,
  type PlayerClipsChange,
  type PlayerSegment,
} from "./player";
import type { PlayerController } from "./types";

const EDGE_HIT_PX = 12;
const DRAG_EXIT_PX = 24;

type LaneDrag =
  | { type: "in" | "out"; i: number }
  | { type: "body"; i: number; grab: number }
  | { type: "press"; i: number; grab: number }
  /** E1: line `k` ≥ 1 of a staggered phase — dragging it changes the step. */
  | { type: "step"; i: number; k: number; grab: number };

/**
 * Элементы — one lane per clip (chrome Field 28). Caption + duration sit left
 * in the field, not in the clip. Body drag slides the clip and shows start/end
 * badges; in/out handles trim one edge. Double-click the lane (the whole
 * field, not just the clip) = solo. A staggered phase adds one lane per line
 * under its own (E1); a moved clip leaves a dashed ghost at its default (C2).
 */
export function PhaseLanes({
  ariaLabel,
  segments,
  total,
  min,
  step,
  unit,
  onChange,
  controller,
  locale,
  captions = true,
  rowOrder,
  stretch = false,
  viewStart = 0,
  viewEnd,
  defaults,
  onResetPhase,
  collapsed,
  stepRows = false,
}: {
  ariaLabel: string;
  segments: readonly PlayerSegment[];
  total: number;
  min: number;
  step: number;
  unit?: string;
  onChange: (next: PlayerClipsChange) => void;
  controller: PlayerController;
  locale: PanelLocale;
  /** In-panel lanes print name + ms in the field. Dock inspector owns those. */
  captions?: boolean;
  /** Visual stack of source indices. Omit = schema order. Clip times stay on those indices. */
  rowOrder?: readonly number[];
  /** A4 Auto: clips may grow past the current span; persist `TOTAL_AUTO`, not a ceiling. */
  stretch?: boolean;
  /** B4: visible window. Omit = 0 … total. */
  viewStart?: number;
  viewEnd?: number;
  /** C2: default clips — a moved clip leaves a dashed ghost there. */
  defaults?: readonly LaidClip[];
  /** Click on the ghost. Without it the ghost is not drawn. */
  onResetPhase?: (index: number) => void;
  /** Staggered phases whose line lanes are folded. */
  collapsed?: ReadonlySet<number>;
  /** Empty lane under the lines, level with the inspector's «Шаг» row. */
  stepRows?: boolean;
}) {
  const state = usePlayerState(controller);
  const rootRef = useRef<HTMLDivElement>(null);
  const laneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragRef = useRef<LaneDrag | null>(null);
  const stopDragListen = useRef<(() => void) | null>(null);
  const pointer0 = useRef({ x: 0, moved: false });
  const moveRef = useRef<(clientX: number) => void>(() => {});
  const [hover, setHover] = useState<number | null>(null);
  const [hoverLine, setHoverLine] = useState<string | null>(null);
  /** Which clip edge the pointer is near — handles show only there (Figma `347:3739`). */
  const [nearEdge, setNearEdge] = useState<"in" | "out" | null>(null);
  const [drag, setDrag] = useState<LaneDrag | null>(null);
  const [hint, setHint] = useState<{
    items: { ms: number; x: number }[];
    y: number;
    theme: string;
  } | null>(null);
  const layout = layoutOf(segments);
  const rows = (
    rowOrder ?? segments.map((_, index) => index)
  ).filter((index) => segments[index]?.kind !== "pause");
  /** Lane scale = visible window (B4); clips still live on the full `total`. */
  const windowEnd = viewEnd ?? total;
  const viewSpan = Math.max(windowEnd - viewStart, 1);
  const safeScale = total > 0 ? total : 1;

  function tFromClientX(i: number, clientX: number) {
    const el = laneRefs.current[i];
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return viewStart + trackQFromClientX(rect, clientX, LANE_PAD_PX) * viewSpan;
  }

  function timeToViewQ(t: number) {
    return (t - viewStart) / viewSpan;
  }

  function showEdgeHints(i: number, times: readonly number[]) {
    const el = laneRefs.current[i];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setHint({
      items: times.map((ms) => {
        const t = snapStep(ms, step);
        return {
          ms: Math.round(t),
          x: trackX(rect, timeToViewQ(t), LANE_PAD_PX),
        };
      }),
      y: rect.top,
      theme:
        el.closest("[data-panel-theme]")?.getAttribute("data-panel-theme") ??
        "dark",
    });
  }

  function endDrag() {
    stopDragListen.current?.();
    stopDragListen.current = null;
    dragRef.current = null;
    setDrag(null);
    setHint(null);
  }

  function armDrag(pointerId: number) {
    stopDragListen.current?.();
    stopDragListen.current = bindPointerDrag(pointerId, {
      onMove(event) {
        const root = rootRef.current?.getBoundingClientRect();
        const outside =
          root != null &&
          (event.clientX < root.left - DRAG_EXIT_PX ||
            event.clientX > root.right + DRAG_EXIT_PX ||
            event.clientY < root.top - DRAG_EXIT_PX ||
            event.clientY > root.bottom + DRAG_EXIT_PX);
        if (outside) {
          endDrag();
          return;
        }
        moveRef.current(event.clientX);
      },
      onEnd() {
        stopDragListen.current = null;
        dragRef.current = null;
        setDrag(null);
        setHint(null);
      },
    });
  }

  function spanMin(i: number) {
    return staggerSpan(min, segments[i]?.stagger);
  }

  function ceilingOf() {
    return stretch
      ? Math.max(
          safeScale,
          segments.reduce((sum, segment) => sum + segmentSpanMax(segment), 0),
        )
      : safeScale;
  }

  function writeClip(i: number, start: number, duration: number) {
    const ceiling = ceilingOf();
    const floor = spanMin(i);
    const nextStart = clampNumber(snapStep(start, step), 0, Math.max(0, ceiling - floor));
    const nextDur = clampNumber(
      snapStep(duration, step),
      floor,
      Math.min(segmentSpanMax(segments[i]), ceiling - nextStart),
    );
    const end = nextStart + nextDur;
    onChange(
      emitClips(
        layout.map((clip, idx) =>
          idx === i
            ? {
                ...clip,
                packed: false,
                start: nextStart,
                duration: nextDur,
                end,
              }
            : clip,
        ),
        stretch ? TOTAL_AUTO : total,
        segments,
      ),
    );
    return { start: nextStart, duration: nextDur, end };
  }

  /** E1: new offset between lines; the parent clip grows or shrinks with it. */
  function writeStep(i: number, raw: number) {
    const segment = segments[i];
    const stagger = segment?.stagger;
    const clip = layout[i];
    if (!stagger || !clip || stagger.count < 2) return 0;
    const gaps = stagger.count - 1;
    const room = (ceilingOf() - clip.start - segment.value) / gaps;
    const next = clampNumber(
      snapStep(raw, step),
      0,
      Math.max(0, Math.min(stagger.stepMax, Math.floor(room / step) * step)),
    );
    const duration = segment.value + gaps * next;
    const steps = segments.map((item) => item.stagger?.step);
    steps[i] = next;
    onChange(
      emitClips(
        layout.map((item, idx) =>
          idx === i ? { ...item, duration, end: item.start + duration } : item,
        ),
        stretch ? TOTAL_AUTO : total,
        segments,
        steps,
      ),
    );
    return next;
  }

  function toggleSolo(i: number) {
    const clip = layout[i];
    if (!clip || clip.duration <= 0) return;
    if (state.solo?.phase === i) {
      controller.setSolo(null);
      controller.pause();
      return;
    }
    const from = clip.start / safeScale;
    controller.setSolo({ phase: i, from, to: clip.end / safeScale });
    controller.seek(from);
    controller.play(1);
  }

  /** Drag / trim on another clip leaves the full timeline; second double-click also clears. */
  function releaseSoloIfOther(i: number) {
    const solo = controller.getState().solo;
    if (solo == null || solo.phase === i) return;
    controller.setSolo(null);
    controller.pause();
  }

  function onBarDown(i: number, event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-phase-bar]")) return;
    event.preventDefault();
    releaseSoloIfOther(i);
    pointer0.current = { x: event.clientX, moved: false };
    const next: LaneDrag = {
      type: "press",
      i,
      grab: tFromClientX(i, event.clientX) - layout[i].start,
    };
    dragRef.current = next;
    setDrag(next);
    armDrag(event.pointerId);
  }

  function onHandleDown(
    i: number,
    edge: "in" | "out",
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    releaseSoloIfOther(i);
    pointer0.current = { x: event.clientX, moved: true };
    const next: LaneDrag = { type: edge, i };
    dragRef.current = next;
    setDrag(next);
    armDrag(event.pointerId);
    const clip = layout[i];
    showEdgeHints(i, [edge === "in" ? clip.start : clip.end]);
  }

  function edgeNear(i: number, clientX: number): "in" | "out" | null {
    const lane = laneRefs.current[i];
    if (!lane) return null;
    const clip = layout[i];
    const rect = lane.getBoundingClientRect();
    const left = trackX(rect, timeToViewQ(clip.start), LANE_PAD_PX);
    const right = trackX(rect, timeToViewQ(clip.end), LANE_PAD_PX);
    if (Math.abs(clientX - left) <= EDGE_HIT_PX) return "in";
    if (Math.abs(clientX - right) <= EDGE_HIT_PX) return "out";
    return null;
  }

  function onHoverMove(event: ReactPointerEvent<HTMLElement>) {
    if (dragRef.current) return;
    if (hover != null) setNearEdge(edgeNear(hover, event.clientX));
  }

  /** Drag step from a window pointermove; the drag lives on `window`, not on pointer capture. */
  function moveDrag(clientX: number) {
    const current = dragRef.current;
    if (!current) return;
    if (Math.abs(clientX - pointer0.current.x) > 4) pointer0.current.moved = true;
    const clip = layout[current.i];
    const t = snapStep(tFromClientX(current.i, clientX), step);
    if (current.type === "step") {
      const next = writeStep(
        current.i,
        (t - current.grab - clip.start) / current.k,
      );
      showEdgeHints(current.i, [clip.start + current.k * next]);
      return;
    }
    if (current.type === "press") {
      if (!pointer0.current.moved) return;
      const next: LaneDrag = { type: "body", i: current.i, grab: current.grab };
      dragRef.current = next;
      setDrag(next);
    }
    if (current.type === "press" || current.type === "body") {
      const start = clampNumber(
        t - current.grab,
        0,
        Math.max(0, safeScale - clip.duration),
      );
      const next = writeClip(current.i, start, clip.duration);
      showEdgeHints(current.i, [next.start, next.end]);
      return;
    }
    if (current.type === "in") {
      const start = clampNumber(t, 0, Math.max(0, clip.end - spanMin(current.i)));
      const next = writeClip(current.i, start, clip.end - start);
      showEdgeHints(current.i, [next.start]);
      return;
    }
    const duration = clampNumber(
      t - clip.start,
      spanMin(current.i),
      Math.min(segmentSpanMax(segments[current.i]), safeScale - clip.start),
    );
    const next = writeClip(current.i, clip.start, duration);
    showEdgeHints(current.i, [next.end]);
  }

  moveRef.current = moveDrag;
  const dragging = drag != null;

  useEffect(() => {
    if (!dragging) return;
    const kind =
      drag?.type === "in" || drag?.type === "out" || drag?.type === "step"
        ? "ew"
        : drag?.type === "body"
          ? "grab"
          : null;
    const html = document.documentElement;
    if (kind) html.dataset.phaseDrag = kind;
    return () => {
      delete html.dataset.phaseDrag;
    };
  }, [dragging, drag?.type]);

  function onLineDown(
    i: number,
    k: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (k === 0) {
      onBarDown(i, event);
      return;
    }
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    releaseSoloIfOther(i);
    const clip = layout[i];
    const lineStep = segments[i]?.stagger?.step ?? 0;
    pointer0.current = { x: event.clientX, moved: true };
    const next: LaneDrag = {
      type: "step",
      i,
      k,
      grab: tFromClientX(i, event.clientX) - (clip.start + k * lineStep),
    };
    dragRef.current = next;
    setDrag(next);
    armDrag(event.pointerId);
    showEdgeHints(i, [clip.start + k * lineStep]);
  }

  function lineLane(i: number, k: number) {
    const segment = segments[i];
    const stagger = segment.stagger;
    const clip = layout[i];
    if (!stagger || !clip) return null;
    const id = `${i}:${k}`;
    const lit =
      hoverLine === id ||
      (drag?.type === "step" && drag.i === i && drag.k === k);
    const start = clip.start + k * stagger.step;
    const name = `${stagger.caption} ${k + 1}`;
    return (
      <div
        key={id}
        role="group"
        aria-label={`${name} ${Math.round(start)}${unit ? ` ${unit}` : ""}`}
        onPointerEnter={() => {
          if (dragRef.current === null) setHoverLine(id);
        }}
        onPointerLeave={() => {
          if (dragRef.current === null) setHoverLine(null);
        }}
        onPointerDown={() => releaseSoloIfOther(i)}
        onDoubleClick={() => toggleSolo(i)}
        className={cn(
          "h-[28px] w-full select-none",
          pickerChrome,
          lit && "after:border-[color:var(--sp-line-strong)]",
        )}
      >
        {captions ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-[6px] left-[6px] z-[5] flex max-w-[calc(100%-12px)] items-center gap-3 font-sans text-[11px] leading-[14px] text-[color:var(--sp-fg-dim)]"
          >
            <span className="min-w-0 truncate uppercase">{name}</span>
            <span className="shrink-0 font-mono tabular-nums">
              {Math.round(segment.value)}
              {unit ? ` ${unit}` : ""}
            </span>
          </span>
        ) : null}
        <div
          onPointerDown={(event) => onLineDown(i, k, event)}
          className={cn(
            "absolute top-1/2 h-[22px] -translate-y-1/2 touch-none rounded-[2px]",
            k === 0 ? "cursor-grab" : "cursor-ew-resize",
            lit ? "bg-[color:var(--sp-fill-strong)]" : "bg-[color:var(--sp-fill)]",
          )}
          style={{
            left: trackMarkerLeft(timeToViewQ(start), LANE_PAD_PX),
            width: `calc((100% - ${LANE_PAD_PX * 2}px) * ${Math.max(segment.value / viewSpan, 0)})`,
          }}
        />
      </div>
    );
  }

  function showHandle(i: number, edge: "in" | "out") {
    if (drag) return drag.i === i && drag.type === edge;
    return hover === i && nearEdge === edge;
  }

  /** Figma `344:3655` / `344:3656`: 2×18 bar inset 2 inside the clip; hit area 10px wide. */
  function handleAt(i: number, edge: "in" | "out") {
    const clip = layout[i];
    const held = drag?.i === i && drag.type === edge;
    return (
      <button
        type="button"
        data-phase-bar=""
        role="slider"
        aria-label={`${segments[i].caption} ${edge}`}
        aria-valuemin={0}
        aria-valuemax={edge === "in" ? clip.end : clip.start + segmentSpanMax(segments[i])}
        aria-valuenow={edge === "in" ? clip.start : clip.end}
        onPointerDown={(event) => onHandleDown(i, edge, event)}
        data-panel-resize="x"
        className={cn(
          "absolute inset-y-0 z-20 m-0 w-[10px] cursor-ew-resize touch-none appearance-none border-0 bg-transparent p-0 outline-none",
          edge === "in" ? "left-0" : "right-0",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 block h-[18px] w-[2px] -translate-y-1/2 rounded-[2px]",
            edge === "in" ? "left-[2px]" : "right-[2px]",
            held ? "bg-[color:var(--sp-knob)]" : "bg-[color:var(--sp-knob-off)]",
          )}
        />
      </button>
    );
  }

  return (
    <div
      ref={rootRef}
      className="flex w-full flex-col gap-1 overflow-hidden"
      role="group"
      aria-label={ariaLabel}
    >
      {rows.map((i) => {
        const clip = layout[i];
        const segment = segments[i];
        if (!clip || !segment) return null;
        const active = hover === i || drag?.i === i;
        const solo = state.solo?.phase === i;
        const lit = active || solo;
        const startQ = timeToViewQ(clip.start);
        const spanQ = clip.duration / viewSpan;
        const stagger = segment.stagger;
        const lines =
          stagger != null && stagger.count > 1 && !collapsed?.has(i)
            ? stagger.count
            : 0;
        const base = onResetPhase ? defaults?.[i] : undefined;
        const moved =
          base != null &&
          (Math.abs(base.start - clip.start) > 0.5 ||
            Math.abs(base.duration - clip.duration) > 0.5);
        return (
          <div
            key={segment.id ?? `${segment.caption}-${i}`}
            className="flex flex-col gap-1"
          >
            <div
              ref={(el) => {
                laneRefs.current[i] = el;
              }}
              onPointerEnter={(event) => {
                if (dragRef.current !== null) return;
                setHover(i);
                setNearEdge(edgeNear(i, event.clientX));
              }}
              onPointerMove={onHoverMove}
              onPointerLeave={() => {
                if (dragRef.current !== null) return;
                setHover(null);
                setNearEdge(null);
              }}
              role="button"
              tabIndex={0}
              aria-pressed={solo}
              aria-label={`${segment.caption} ${Math.round(clip.duration)}${unit ? ` ${unit}` : ""}`}
              title={tx(solo ? PANEL_COPY.clearSolo : PANEL_COPY.soloPhase, locale)}
              onPointerDown={() => releaseSoloIfOther(i)}
              onDoubleClick={() => toggleSolo(i)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  toggleSolo(i);
                } else if (event.key === "Escape" && state.solo) {
                  event.preventDefault();
                  controller.setSolo(null);
                }
              }}
              className={cn(
                "h-[28px] w-full cursor-pointer select-none outline-none",
                pickerChrome,
                solo
                  ? "after:border-[color:var(--sp-line-focus)]"
                  : active && "after:border-[color:var(--sp-line-strong)]",
              )}
            >
              {captions ? (
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute top-[6px] left-[6px] z-[5] flex max-w-[calc(100%-12px)] items-center gap-3 font-sans text-[11px] leading-[14px] transition-colors duration-150",
                    solo
                      ? "text-[color:var(--sp-fg)]"
                      : active
                        ? "text-[color:var(--sp-label)]"
                        : "text-[color:var(--sp-fg-dim)]",
                  )}
                >
                  <span className="min-w-0 truncate uppercase">{segment.caption}</span>
                  <span className="shrink-0 font-mono tabular-nums">
                    {Math.round(clip.duration)}
                    {unit ? ` ${unit}` : ""}
                  </span>
                </span>
              ) : null}
              {moved && base ? (
                <div
                  role="button"
                  aria-label={tx(PANEL_COPY.resetClip, locale)}
                  title={tx(PANEL_COPY.resetClip, locale)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onResetPhase?.(i);
                  }}
                  className="absolute top-1/2 h-[22px] -translate-y-1/2 cursor-pointer rounded-[2px] border border-dashed border-[color:var(--sp-line-hover)] hover:border-[color:var(--sp-line-strong)]"
                  style={{
                    left: trackMarkerLeft(timeToViewQ(base.start), LANE_PAD_PX),
                    width: `calc((100% - ${LANE_PAD_PX * 2}px) * ${Math.max(base.duration / viewSpan, 0)})`,
                  }}
                />
              ) : null}
              <div
                onPointerDown={(event) => onBarDown(i, event)}
                className={cn(
                  "absolute top-1/2 h-[22px] min-w-0 -translate-y-1/2 cursor-grab touch-none overflow-hidden rounded-[2px]",
                  drag?.type === "body" && drag.i === i && "cursor-grabbing",
                  ((drag?.i === i && (drag.type === "in" || drag.type === "out")) ||
                    (hover === i && nearEdge != null)) &&
                    "cursor-ew-resize",
                  lit ? "bg-[color:var(--sp-fill-strong)]" : "bg-[color:var(--sp-fill)]",
                )}
                style={{
                  left: trackMarkerLeft(startQ, LANE_PAD_PX),
                  width: `calc((100% - ${LANE_PAD_PX * 2}px) * ${Math.max(spanQ, 0)})`,
                }}
              >
                {showHandle(i, "in") ? handleAt(i, "in") : null}
                {showHandle(i, "out") ? handleAt(i, "out") : null}
              </div>
            </div>
            {Array.from({ length: lines }, (_, k) => lineLane(i, k))}
            {lines > 0 && stepRows ? <div aria-hidden className="h-[28px]" /> : null}
          </div>
        );
      })}
      {hint
        ? createPortal(
            <>
              {hint.items.map((item) => (
                <div
                  key={`${item.ms}-${item.x}`}
                  role="tooltip"
                  data-panel-theme={hint.theme}
                  className="pointer-events-none fixed z-[120] -translate-x-1/2 -translate-y-full rounded-[8px] border border-[color:var(--sp-line-mid)] bg-[color:var(--sp-glass)] px-2 py-1 font-mono text-[11px] leading-[14px] tabular-nums text-[color:var(--sp-fg)] backdrop-blur-md"
                  style={{ left: item.x, top: hint.y - 4 }}
                >
                  {item.ms}
                </div>
              ))}
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
