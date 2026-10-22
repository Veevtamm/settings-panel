"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { closestPanelFont } from "../lib/panel-theme";
import {
  shiftClipGroup,
  TOTAL_AUTO,
  staggerSpan,
  type LaidClip,
} from "../lib/player-clips";
import { clampNumber, cn } from "../lib/utils";
import { SfSymbol, type SfSymbolName } from "../sf-symbol";
import { bindPointerDrag, fieldValueSans, GLASS, pickerChrome } from "./chrome";
import { NumberField } from "./fields";
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
  | { type: "body"; i: number; grab: number; origins: ReadonlyMap<number, number> }
  | { type: "press"; i: number; grab: number; origins: ReadonlyMap<number, number> }
  /** Drag the group's span bar: one delta for every member, durations stay. */
  | { type: "group"; i: number; grab: number; origins: ReadonlyMap<number, number> }
  /** E1: line `k` ≥ 1 of a staggered phase — dragging it changes the step. */
  | { type: "step"; i: number; k: number; grab: number };

/** Inspector row and its bar share one hover. */
export type LaneHover =
  | { kind: "group"; id: string }
  | { kind: "phase"; index: number }
  | { kind: "line"; index: number; line: number };

export function sameLaneHover(a: LaneHover | null, b: LaneHover | null) {
  if (a === b) return true;
  if (a == null || b == null || a.kind !== b.kind) return false;
  if (a.kind === "group" && b.kind === "group") return a.id === b.id;
  if (a.kind === "phase" && b.kind === "phase") return a.index === b.index;
  return a.kind === "line" && b.kind === "line" && a.index === b.index && a.line === b.line;
}

export type ClipMenuRequest = {
  phase: number;
  indices: number[];
  x: number;
  y: number;
  theme: string;
  font: string;
};

/** Theme and font from the row that was right-clicked, for the clip menu portal. */
export function clipMenuFromPointer(
  event: { clientX: number; clientY: number; currentTarget: Element },
  phase: number,
  indices: number[],
): ClipMenuRequest {
  const el = event.currentTarget;
  return {
    phase,
    indices,
    x: event.clientX,
    y: event.clientY,
    theme: el.closest("[data-panel-theme]")?.getAttribute("data-panel-theme") ?? "dark",
    font: closestPanelFont(el),
  };
}

/** Shift adds a clip or removes it on a second click. ⌘ does the same. Ctrl does too, except on macOS, where Ctrl-click is the context menu. */
function clipToggleModifier(event: {
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}) {
  if (event.shiftKey || event.metaKey) return true;
  const mac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform);
  return !mac && event.ctrlKey;
}

/**
 * Элементы — one lane per clip (chrome Field 28). Caption + duration sit left
 * in the field, not in the clip. Body drag slides the clip and shows start/end
 * badges; in/out handles trim one edge. Shift-click adds a clip or removes
 * it on a second click (⌘, and Ctrl off macOS, do the same); dragging a selected clip moves the
 * whole group by the same delta. Double-click the lane (the whole
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
  onEditCurve,
  curveOptions,
  curveSections,
  curveValue,
  onPickCurve,
  clipGroups,
  groupLeads,
  foldedGroups,
  onMakeStep,
  onGroup,
  onUngroup,
  laneHover = null,
  onLaneHover,
  openMenuRef,
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
  /** Right-click opens the Bezier window. Skipped when `onPickCurve` assigns from the list. */
  onEditCurve?: (phase: number) => void;
  /** Templates and saved curves. With `onPickCurve`, the menu picks one instead of opening the editor. */
  curveOptions?: readonly { id: string; label: string }[];
  curveSections?: readonly {
    title: string;
    options: readonly { id: string; label: string }[];
  }[];
  /** Matched preset id for a phase, or `"custom"`. */
  curveValue?: (phase: number) => string | undefined;
  onPickCurve?: (indices: number[], presetId: string) => void;
  /** User groups of phase ids. Right-click on a multi-selection can make or clear one. */
  clipGroups?: readonly { id: string; name: string; keys: readonly string[] }[];
  /** Phase index that draws the group span bar, level with the inspector header. */
  groupLeads?: ReadonlySet<number>;
  /** Folded user groups: only the span bar stays. */
  foldedGroups?: ReadonlySet<string>;
  onMakeStep?: (indices: number[], gap: number) => void;
  onGroup?: (indices: number[]) => void;
  onUngroup?: (indices: number[]) => void;
  /** Hover shared with the inspector row for the same phase, line, or group. */
  laneHover?: LaneHover | null;
  onLaneHover?: (next: LaneHover | null) => void;
  /** Inspector rows open the same menu as the bars. */
  openMenuRef?: { current: ((menu: ClipMenuRequest) => void) | null };
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
    font: string;
  } | null>(null);
  const [clipMenu, setClipMenu] = useState<{
    i: number;
    indices: number[];
    x: number;
    y: number;
    theme: string;
    font: string;
  } | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set());

  useEffect(() => {
    if (!openMenuRef) return;
    openMenuRef.current = (menu) => {
      setSelected(new Set(menu.indices));
      setClipMenu({
        i: menu.phase,
        indices: menu.indices,
        x: menu.x,
        y: menu.y,
        theme: menu.theme,
        font: menu.font,
      });
    };
    return () => {
      openMenuRef.current = null;
    };
  }, [openMenuRef]);

  useEffect(() => {
    if (selected.size === 0) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      setSelected(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);
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
      font: closestPanelFont(el),
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

  function originsFor(indices: Iterable<number>) {
    const origins = new Map<number, number>();
    for (const index of indices) {
      const clip = layout[index];
      if (clip) origins.set(index, clip.start);
    }
    return origins;
  }

  function onBarDown(i: number, event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-phase-bar]")) return;
    if (clipToggleModifier(event)) {
      event.preventDefault();
      event.stopPropagation();
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        return next;
      });
      return;
    }
    event.preventDefault();
    releaseSoloIfOther(i);
    const group = selected.has(i) && selected.size > 1 ? selected : new Set([i]);
    if (group.size === 1) setSelected(group);
    pointer0.current = { x: event.clientX, moved: false };
    const next: LaneDrag = {
      type: "press",
      i,
      grab: tFromClientX(i, event.clientX) - layout[i].start,
      origins: originsFor(group),
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
    if (current.type === "group") {
      if (!pointer0.current.moved) return;
      const span0 = Math.min(...current.origins.values());
      const shifted = shiftClipGroup(
        layout,
        current.origins,
        snapStep(t - current.grab - span0, step),
        safeScale,
      );
      onChange(emitClips(shifted, stretch ? TOTAL_AUTO : total, segments));
      const start = Math.min(
        ...shifted.flatMap((item, index) =>
          current.origins.has(index) ? [item.start] : [],
        ),
      );
      const end = Math.max(
        ...shifted.flatMap((item, index) =>
          current.origins.has(index) ? [item.end] : [],
        ),
      );
      showEdgeHints(current.i, [start, end]);
      return;
    }
    if (current.type === "press") {
      if (!pointer0.current.moved) return;
      const next: LaneDrag = {
        type: "body",
        i: current.i,
        grab: current.grab,
        origins: current.origins,
      };
      dragRef.current = next;
      setDrag(next);
    }
    if (current.type === "press" || current.type === "body") {
      if (current.origins.size > 1) {
        const origin = current.origins.get(current.i) ?? clip.start;
        const shifted = shiftClipGroup(
          layout,
          current.origins,
          snapStep(t - current.grab - origin, step),
          safeScale,
        );
        onChange(emitClips(shifted, stretch ? TOTAL_AUTO : total, segments));
        const moved = shifted[current.i];
        if (moved) showEdgeHints(current.i, [moved.start, moved.end]);
        return;
      }
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
        : drag?.type === "body" || drag?.type === "group"
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
      (laneHover?.kind === "line" && laneHover.index === i && laneHover.line === k) ||
      (drag?.type === "step" && drag.i === i && drag.k === k);
    const start = clip.start + k * stagger.step;
    const name = `${stagger.caption} ${k + 1}`;
    return (
      <div
        key={id}
        role="group"
        aria-label={`${name} ${Math.round(start)}${unit ? ` ${unit}` : ""}`}
        onPointerEnter={() => {
          if (dragRef.current === null) {
            setHoverLine(id);
            onLaneHover?.({ kind: "line", index: i, line: k });
          }
        }}
        onPointerLeave={() => {
          if (dragRef.current === null) {
            setHoverLine(null);
            onLaneHover?.(null);
          }
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
        const active =
          hover === i ||
          (laneHover?.kind === "phase" && laneHover.index === i) ||
          drag?.i === i;
        const solo = state.solo?.phase === i;
        const picked = selected.has(i);
        const groupDrag =
          (drag?.type === "body" || drag?.type === "press") &&
          drag.origins.has(i);
        const lit = active || solo || groupDrag;
        const startQ = timeToViewQ(clip.start);
        const spanQ = clip.duration / viewSpan;
        const stagger = segment.stagger;
        const lines =
          stagger != null && stagger.count > 1 && !collapsed?.has(i)
            ? stagger.count
            : 0;
        const userGroup = clipGroups?.find((group) =>
          group.keys.includes(segmentKey(segment, i)),
        );
        const groupFolded = userGroup != null && foldedGroups?.has(userGroup.id);
        if (groupFolded && !groupLeads?.has(i)) return null;
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
            {groupLeads?.has(i) && userGroup ? (
              <GroupSpanLane
                name={userGroup.name}
                start={Math.min(
                  ...rows.flatMap((index) =>
                    userGroup.keys.includes(segmentKey(segments[index], index))
                      ? [layout[index]?.start ?? Infinity]
                      : [],
                  ),
                )}
                end={Math.max(
                  ...rows.flatMap((index) =>
                    userGroup.keys.includes(segmentKey(segments[index], index))
                      ? [layout[index]?.end ?? -Infinity]
                      : [],
                  ),
                )}
                viewSpan={viewSpan}
                timeToViewQ={timeToViewQ}
                picked={rows
                  .filter((index) =>
                    userGroup.keys.includes(segmentKey(segments[index], index)),
                  )
                  .every((index) => selected.has(index))}
                unit={unit}
                laneRef={
                  groupFolded
                    ? (el) => {
                        laneRefs.current[i] = el;
                      }
                    : undefined
                }
                hot={laneHover?.kind === "group" && laneHover.id === userGroup.id}
                onPointerEnter={() => {
                  if (dragRef.current === null) {
                    onLaneHover?.({ kind: "group", id: userGroup.id });
                  }
                }}
                onPointerLeave={() => {
                  if (dragRef.current === null) onLaneHover?.(null);
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  const memberIndices = rows.filter((index) =>
                    userGroup.keys.includes(segmentKey(segments[index], index)),
                  );
                  const origins = originsFor(memberIndices);
                  const span0 = Math.min(...origins.values());
                  setSelected(new Set(memberIndices));
                  releaseSoloIfOther(i);
                  pointer0.current = { x: event.clientX, moved: false };
                  const next: LaneDrag = {
                    type: "group",
                    i,
                    grab: tFromClientX(i, event.clientX) - span0,
                    origins,
                  };
                  dragRef.current = next;
                  setDrag(next);
                  armDrag(event.pointerId);
                }}
                onContextMenu={(event) => {
                  if (!onEditCurve && !onPickCurve && !onMakeStep && !onGroup) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const memberIndices = rows.filter((index) =>
                    userGroup.keys.includes(segmentKey(segments[index], index)),
                  );
                  setSelected(new Set(memberIndices));
                  const el = event.currentTarget;
                  setClipMenu({
                    i,
                    indices: memberIndices,
                    x: event.clientX,
                    y: event.clientY,
                    theme:
                      el.closest("[data-panel-theme]")?.getAttribute("data-panel-theme") ??
                      "dark",
                    font: closestPanelFont(el),
                  });
                }}
              />
            ) : null}
            {groupFolded ? null : stagger != null && stagger.count > 1 ? (
              <GroupSpanLane
                name={segment.caption}
                start={clip.start}
                end={clip.end}
                viewSpan={viewSpan}
                timeToViewQ={timeToViewQ}
                picked={picked}
                unit={unit}
                laneRef={(el) => {
                  laneRefs.current[i] = el;
                }}
                hot={lit}
                onPointerEnter={() => {
                  if (dragRef.current === null) {
                    onLaneHover?.({ kind: "phase", index: i });
                  }
                }}
                onPointerLeave={() => {
                  if (dragRef.current === null) onLaneHover?.(null);
                }}
                onPointerDown={(event) => onBarDown(i, event)}
                onContextMenu={(event) => {
                  if (!onEditCurve && !onPickCurve && !onMakeStep && !onGroup) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setSelected(new Set([i]));
                  const el = event.currentTarget;
                  setClipMenu({
                    i,
                    indices: [i],
                    x: event.clientX,
                    y: event.clientY,
                    theme:
                      el.closest("[data-panel-theme]")?.getAttribute("data-panel-theme") ??
                      "dark",
                    font: closestPanelFont(el),
                  });
                }}
              />
            ) : groupFolded ? null : (
            <div
              ref={(el) => {
                laneRefs.current[i] = el;
              }}
              onPointerEnter={(event) => {
                if (dragRef.current !== null) return;
                setHover(i);
                setNearEdge(edgeNear(i, event.clientX));
                onLaneHover?.({ kind: "phase", index: i });
              }}
              onPointerMove={onHoverMove}
              onPointerLeave={() => {
                if (dragRef.current !== null) return;
                setHover(null);
                setNearEdge(null);
                onLaneHover?.(null);
              }}
              role="button"
              tabIndex={0}
              aria-pressed={solo}
              aria-label={`${segment.caption} ${Math.round(clip.duration)}${unit ? ` ${unit}` : ""}`}
              title={tx(solo ? PANEL_COPY.clearSolo : PANEL_COPY.soloPhase, locale)}
              onPointerDown={(event) => {
                releaseSoloIfOther(i);
                if (event.target === event.currentTarget) setSelected(new Set());
              }}
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
                onContextMenu={(event) => {
                  if (!onEditCurve && !onPickCurve && !onMakeStep && !onGroup) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const indices =
                    selected.has(i) && selected.size > 1 ? [...selected] : [i];
                  if (indices.length === 1) setSelected(new Set(indices));
                  const el = event.currentTarget;
                  setClipMenu({
                    i,
                    indices,
                    x: event.clientX,
                    y: event.clientY,
                    theme:
                      el.closest("[data-panel-theme]")?.getAttribute("data-panel-theme") ??
                      "dark",
                    font: closestPanelFont(el),
                  });
                }}
                data-selected={picked ? "" : undefined}
                className={cn(
                  "absolute top-1/2 h-[22px] min-w-0 -translate-y-1/2 cursor-grab touch-none overflow-hidden rounded-[2px]",
                  drag?.type === "body" && drag.i === i && "cursor-grabbing",
                  ((drag?.i === i && (drag.type === "in" || drag.type === "out")) ||
                    (hover === i && nearEdge != null)) &&
                    "cursor-ew-resize",
                  picked && "shadow-[inset_0_0_0_1px_var(--sp-line-focus)]",
                  lit || picked
                    ? "bg-[color:var(--sp-fill-strong)]"
                    : "bg-[color:var(--sp-fill)]",
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
            )}
            {groupFolded
              ? null
              : Array.from({ length: lines }, (_, k) => lineLane(i, k))}
            {lines > 0 && stepRows ? <div aria-hidden className="h-[28px]" /> : null}
          </div>
        );
      })}
      {clipMenu ? (
        <ClipCurveMenu
          x={clipMenu.x}
          y={clipMenu.y}
          theme={clipMenu.theme}
          font={clipMenu.font}
          items={clipMenuItems({
            phase: clipMenu.i,
            indices: clipMenu.indices,
            segments,
            layout,
            ceiling: total,
            grid: step,
            unit,
            groups: clipGroups,
            locale,
            onEditCurve,
            curveOptions,
            curveSections,
            curveValue,
            onPickCurve,
            onMakeStep,
            onGroup,
            onUngroup,
            close: () => setClipMenu(null),
          })}
          onClose={() => setClipMenu(null)}
        />
      ) : null}
      {hint
        ? createPortal(
            <>
              {hint.items.map((item) => (
                <div
                  key={`${item.ms}-${item.x}`}
                  role="tooltip"
                  data-panel-theme={hint.theme}
                  data-panel-font={hint.font}
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

function segmentKey(segment: PlayerSegment, index: number) {
  return segment.id ?? String(index);
}

type ClipMenuItem = {
  icon: SfSymbolName;
  label: string;
  onPick?: () => void;
  /** Template or saved curve. The list stays inside the menu. */
  curves?: {
    value: string;
    valueLabel: string;
    options: readonly { id: string; label: string }[];
    sections?: readonly {
      title: string;
      options: readonly { id: string; label: string }[];
    }[];
    onPick: (id: string) => void;
  };
  /** Typed step. Commits live; Enter closes the menu. */
  step?: {
    value: number;
    min: number;
    max: number;
    step: number;
    unit?: string;
    onCommit: (value: number) => void;
  };
};

/** Current interval shown in «Сделать шаг»: line step of one stagger, or the start gap of a selection. */
function stepMenuField(
  indices: readonly number[],
  segments: readonly PlayerSegment[],
  layout: readonly LaidClip[],
  ceiling: number,
  grid: number,
): { value: number; min: number; max: number; step: number } | null {
  if (indices.length === 1) {
    const segment = segments[indices[0]];
    if (segment?.stagger != null && segment.stagger.count > 1) {
      return {
        value: segment.stagger.step,
        min: 0,
        max: segment.stagger.stepMax,
        step: grid,
      };
    }
  }
  const ordered = [...new Set(indices)].filter((index) => layout[index] != null);
  ordered.sort((a, b) => layout[a].start - layout[b].start || a - b);
  if (ordered.length < 2) return null;
  const span = layout[ordered[ordered.length - 1]].start - layout[ordered[0]].start;
  const gaps = ordered.length - 1;
  const value =
    span > grid / 2
      ? span / gaps
      : layout[ordered[0]].duration;
  return {
    value: Math.round(value),
    min: 0,
    max: Math.max(grid, ceiling),
    step: grid,
  };
}

function clipMenuItems({
  phase,
  indices,
  segments,
  layout,
  ceiling,
  grid,
  unit,
  groups,
  locale,
  onEditCurve,
  curveOptions,
  curveSections,
  curveValue,
  onPickCurve,
  onMakeStep,
  onGroup,
  onUngroup,
  close,
}: {
  phase: number;
  indices: readonly number[];
  segments: readonly PlayerSegment[];
  layout: readonly LaidClip[];
  ceiling: number;
  grid: number;
  unit?: string;
  groups?: readonly { keys: readonly string[] }[];
  locale: PanelLocale;
  onEditCurve?: (phase: number) => void;
  curveOptions?: readonly { id: string; label: string }[];
  curveSections?: readonly {
    title: string;
    options: readonly { id: string; label: string }[];
  }[];
  curveValue?: (phase: number) => string | undefined;
  onPickCurve?: (indices: number[], presetId: string) => void;
  onMakeStep?: (indices: number[], gap: number) => void;
  onGroup?: (indices: number[]) => void;
  onUngroup?: (indices: number[]) => void;
  close: () => void;
}): ClipMenuItem[] {
  const ids = indices.map((index) =>
    segments[index] ? segmentKey(segments[index], index) : String(index),
  );
  const group = groups?.find((item) => ids.every((id) => item.keys.includes(id)));
  const whole =
    group != null && group.keys.length === ids.length && ids.length >= 2;
  const items: ClipMenuItem[] = [];
  const curveId = curveValue?.(phase);
  if (onPickCurve && curveOptions && curveOptions.length > 0 && curveId != null) {
    const current = curveOptions.find((option) => option.id === curveId);
    items.push({
      icon: "spline",
      label: tx(PANEL_COPY.editCurve, locale),
      curves: {
        value: curveId,
        valueLabel: current?.label ?? tx(PANEL_COPY.customCurve, locale),
        options: curveOptions,
        sections: curveSections,
        onPick: (id) => onPickCurve([...indices], id),
      },
    });
  } else if (onEditCurve) {
    items.push({
      icon: "spline",
      label: tx(PANEL_COPY.editCurve, locale),
      onPick: () => {
        close();
        onEditCurve(phase);
      },
    });
  }
  const stepField = stepMenuField(indices, segments, layout, ceiling, grid);
  if (stepField && onMakeStep) {
    items.push({
      icon: "align-horizontal-space-around",
      label: tx(PANEL_COPY.makeStep, locale),
      step: {
        ...stepField,
        unit,
        onCommit: (value) => onMakeStep([...indices], value),
      },
    });
  }
  if (ids.length >= 2 && onGroup && !whole) {
    items.push({
      icon: "folder",
      label: tx(PANEL_COPY.groupClips, locale),
      onPick: () => {
        close();
        onGroup([...indices]);
      },
    });
  }
  if (group && onUngroup && ids.length >= 2) {
    items.push({
      icon: "x",
      label: tx(PANEL_COPY.ungroupClips, locale),
      onPick: () => {
        close();
        onUngroup([...indices]);
      },
    });
  }
  return items;
}

/** Parent bar of a user group: the union of its clips, same lane as the inspector header. */
function GroupSpanLane({
  name,
  start,
  end,
  viewSpan,
  timeToViewQ,
  picked,
  unit,
  laneRef,
  hot = false,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  onContextMenu,
}: {
  name: string;
  start: number;
  end: number;
  viewSpan: number;
  timeToViewQ: (t: number) => number;
  picked: boolean;
  unit?: string;
  laneRef?: (el: HTMLDivElement | null) => void;
  hot?: boolean;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const duration = Math.max(0, end - start);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return (
    <div
      ref={laneRef}
      role="group"
      aria-label={`${name} ${Math.round(duration)}${unit ? ` ${unit}` : ""}`}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className={cn(
        "h-[28px] w-full select-none",
        pickerChrome,
        hot && "after:border-[color:var(--sp-line-strong)]",
      )}
    >
      <div
        onPointerDown={onPointerDown}
        onContextMenu={onContextMenu}
        data-selected={picked ? "" : undefined}
        className={cn(
          "absolute top-1/2 h-[22px] min-w-0 -translate-y-1/2 cursor-grab touch-none rounded-[2px]",
          picked && "shadow-[inset_0_0_0_1px_var(--sp-line-focus)]",
          picked || hot ? "bg-[color:var(--sp-fill-strong)]" : "bg-[color:var(--sp-fill)]",
        )}
        style={{
          left: trackMarkerLeft(timeToViewQ(start), LANE_PAD_PX),
          width: `calc((100% - ${LANE_PAD_PX * 2}px) * ${Math.max(duration / viewSpan, 0)})`,
        }}
      />
    </div>
  );
}

/** Right-click menu on a clip bar. */
function ClipCurveMenu({
  x,
  y,
  theme,
  font,
  items,
  onClose,
}: {
  x: number;
  y: number;
  theme: string;
  font: string;
  items: readonly ClipMenuItem[];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [curvesOpen, setCurvesOpen] = useState(false);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const pad = 8;
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad) {
      left = window.innerWidth - pad - rect.width;
    }
    if (top + rect.height > window.innerHeight - pad) top = y - rect.height;
    setPos({
      left: Math.max(pad, left),
      top: Math.max(pad, top),
    });
  }, [x, y]);

  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onContext = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        event.preventDefault();
        return;
      }
      onClose();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("contextmenu", onContext);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  if (items.length === 0) return null;
  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      data-settings-panel=""
      data-panel-theme={theme}
      data-panel-font={font}
      className="fixed z-[130] box-content flex w-max flex-col rounded-lg border border-[color:var(--sp-line)] p-1 font-sans backdrop-blur-[8px]"
      style={{ left: pos.left, top: pos.top, background: GLASS }}
    >
      {items.map((item, index) =>
        item.curves ? (
          <div key={item.label} className="flex flex-col">
            <button
              type="button"
              aria-expanded={curvesOpen}
              onClick={() => setCurvesOpen((open) => !open)}
              className={cn(
                "flex h-7 items-center gap-2 rounded px-1.5 text-left outline-none",
                fieldValueSans,
                "text-[color:var(--sp-muted)] transition-colors duration-150 fine-hover:hover:bg-[color:var(--sp-fill-hover)] fine-hover:hover:text-[color:var(--sp-fg)]",
              )}
            >
              <SfSymbol name={item.icon} className="size-5 shrink-0" />
              <span className="whitespace-nowrap">{item.label}</span>
              <span className="ml-auto whitespace-nowrap pl-3 pr-1 text-[color:var(--sp-fg)]">
                {item.curves.valueLabel}
              </span>
            </button>
            {curvesOpen ? (
              <div className="max-h-48 overflow-y-auto">
                {(item.curves.sections ?? [{ title: "", options: item.curves.options }]).map(
                  (section) => (
                    <div
                      key={section.title || "curves"}
                      className={cn(
                        "flex flex-col",
                        section.title && "mt-1 border-t border-[color:var(--sp-section-line)] pt-1",
                      )}
                    >
                      {section.options.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          role="menuitem"
                          aria-checked={option.id === item.curves?.value}
                          onClick={() => {
                            item.curves?.onPick(option.id);
                            onClose();
                          }}
                          className={cn(
                            "flex h-7 w-full items-center rounded px-1.5 text-left outline-none",
                            fieldValueSans,
                            option.id === item.curves?.value
                              ? "text-[color:var(--sp-fg)]"
                              : "text-[color:var(--sp-muted)]",
                            "transition-colors duration-150 fine-hover:hover:bg-[color:var(--sp-fill-hover)] fine-hover:hover:text-[color:var(--sp-fg)]",
                          )}
                        >
                          <span className="whitespace-nowrap pl-7">{option.label}</span>
                        </button>
                      ))}
                    </div>
                  ),
                )}
              </div>
            ) : null}
          </div>
        ) : item.step ? (
          <div
            key={item.label}
            role="group"
            aria-label={item.label}
            onKeyDown={(event) => {
              if (event.key === "Enter") onClose();
            }}
            className={cn(
              "flex h-7 items-center gap-2 rounded px-1.5",
              fieldValueSans,
              "text-[color:var(--sp-muted)]",
            )}
          >
            <SfSymbol name={item.icon} className="size-5 shrink-0" />
            <span className="min-w-0 flex-1 pr-1 whitespace-nowrap">{item.label}</span>
            <NumberField
              ariaLabel={item.label}
              max={item.step.max}
              min={item.step.min}
              onCommit={item.step.onCommit}
              step={item.step.step}
              unit={item.step.unit}
              value={item.step.value}
            />
          </div>
        ) : (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          autoFocus={index === 0}
          onClick={item.onPick}
          className={cn(
            "flex h-7 items-center gap-2 rounded px-1.5 text-left outline-none",
            fieldValueSans,
            "text-[color:var(--sp-muted)] transition-colors duration-150 fine-hover:hover:bg-[color:var(--sp-fill-hover)] fine-hover:hover:text-[color:var(--sp-fg)] focus-visible:bg-[color:var(--sp-fill-hover)] focus-visible:text-[color:var(--sp-fg)]",
          )}
        >
          <SfSymbol name={item.icon} className="size-5 shrink-0" />
          <span className="pr-1 whitespace-nowrap">{item.label}</span>
        </button>
        ),
      )}
    </div>,
    document.body,
  );
}
