"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  captionsAtQ,
  fitClipsToTotal,
  layoutClips,
  momentMs,
  type ClipInput,
} from "../lib/player-clips";
import { PIN_EPSILON } from "../lib/transition-player";
import { clampNumber, cn } from "../lib/utils";
import { SfSymbol, type SfSymbolName } from "../sf-symbol";
import {
  CHEVRON_MS,
  EASE_OUT,
  ICON,
  MUTED,
  SECTION_MS,
  pickerChrome,
} from "./chrome";
import { FieldButton, NumberField, SettingToggle } from "./fields";
import { useCopyFlash } from "./use-copy-flash";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";
import { snapStep } from "./number";
import { RowLabel, SectionCollapse } from "./row";
import type { PlayerController, PlayerState, ResetDotProps } from "./types";

/** ×1 → ×3 → ×5 → ×10 → ×1: slow-down steps, click cycles. */
const PLAYER_SPEEDS = [1, 3, 5, 10] as const;
/** Captions under Блоки hide when their segment is narrower than this (px). */
const PHASE_CAPTION_MIN_PX = 24;
/** Clip inset from the lane's outer edge (Figma Tools `344:3639`: 1px stroke + 2px = 3; clip 22 tall in 28). */
const PHASE_BAR_INSET = 3;
/** q=0 and q=1 sit this far inside the field so the 1px border doesn't clip them. */
const TRACK_PAD_PX = 2;
/** Pointer distance from a clip edge that reveals its in/out handle. */
const EDGE_HIT_PX = 12;
/** Leaving the lanes block by more than this ends the drag. */
const DRAG_EXIT_PX = 24;

export type PlayerSegment = {
  caption: string;
  kind: "phase" | "pause";
  max: number;
  value: number;
  start?: number;
};

type SegmentTimes = {
  caption: string;
  value: number;
  start?: number;
  kind?: "phase" | "pause";
};

export type PlayerClipsChange = {
  durations: number[];
  starts: (number | undefined)[];
  /** Timeline length — unchanged unless the ms field was edited. */
  total: number;
};

function inputsOf(segments: readonly SegmentTimes[]): ClipInput[] {
  return segments.map((segment) =>
    segment.start == null
      ? { duration: segment.value }
      : { duration: segment.value, start: segment.start },
  );
}

function layoutOf(segments: readonly SegmentTimes[]) {
  return layoutClips(inputsOf(segments));
}

function emitClips(
  layout: readonly { start: number; duration: number; packed: boolean }[],
  total: number,
): PlayerClipsChange {
  return {
    durations: layout.map((clip) => clip.duration),
    starts: layout.map((clip) => (clip.packed ? undefined : clip.start)),
    total,
  };
}

/** `?moment=<player id>:<q>` — one entry per player, so a page may park several transitions at once. */
export const MOMENT_QUERY = "moment";

export function momentUrl(playerId: string, q: number, href = window.location.href) {
  const url = new URL(href);
  const others = url.searchParams
    .getAll(MOMENT_QUERY)
    .filter((entry) => !entry.startsWith(`${playerId}:`));
  url.searchParams.delete(MOMENT_QUERY);
  for (const entry of others) url.searchParams.append(MOMENT_QUERY, entry);
  url.searchParams.append(MOMENT_QUERY, `${playerId}:${q.toFixed(3)}`);
  return url.toString();
}

/** q parked in the URL for this player, or null. */
export function readMoment(playerId: string, search = window.location.search) {
  for (const entry of new URLSearchParams(search).getAll(MOMENT_QUERY)) {
    const [id, raw] = entry.split(":");
    if (id !== playerId) continue;
    const q = Number(raw);
    return Number.isFinite(q) ? clampNumber(q, 0, 1) : null;
  }
  return null;
}

/** `Reel · 651 ms — фаза 1` — HUD and copy share this line; URL is appended on copy. `total` = timeline ms. */
export function formatMoment(
  label: string,
  q: number,
  segments: readonly SegmentTimes[],
  total: number,
) {
  const names = captionsAtQ(
    layoutOf(segments),
    segments.map((segment) =>
      "kind" in segment && segment.kind === "pause" ? "" : segment.caption,
    ),
    q,
    total,
  );
  const ms = momentMs(total, q);
  return names.length
    ? `${label} · ${ms} ms — ${names.join(" + ")}`
    : `${label} · ${ms} ms`;
}

export function momentCopyText(
  label: string,
  playerId: string,
  q: number,
  segments: readonly SegmentTimes[],
  total: number,
) {
  return `${formatMoment(label, q, segments, total)}\n${momentUrl(playerId, q)}`;
}

export function usePlayerState(controller: PlayerController): PlayerState {
  return useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );
}

/** Boolean snapshot — q ticks while closed do not re-render the folded row. */
function usePlayerOpen(controller: PlayerController) {
  return useSyncExternalStore(
    controller.subscribe,
    () => controller.getState().open,
    () => controller.getState().open,
  );
}

function trackMarkerLeft(q: number) {
  return `calc(${TRACK_PAD_PX}px + (100% - ${TRACK_PAD_PX * 2}px) * ${q})`;
}

function PlayerTrack({
  ariaLabel,
  state,
  controller,
  total,
}: {
  ariaLabel: string;
  state: PlayerState;
  controller: PlayerController;
  total: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  function qFromClientX(clientX: number) {
    const el = trackRef.current;
    if (!el) return state.q;
    const rect = el.getBoundingClientRect();
    const inner = rect.width - TRACK_PAD_PX * 2;
    if (inner <= 0) return state.q;
    return clampNumber((clientX - rect.left - TRACK_PAD_PX) / inner, 0, 1);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-pin]")) return;
    event.preventDefault();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    controller.seek(qFromClientX(event.clientX));
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    controller.seek(qFromClientX(event.clientX));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={Number(state.q.toFixed(3))}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 0.1 : 0.01;
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          controller.seek(clampNumber(state.q - step, 0, 1));
        } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          controller.seek(clampNumber(state.q + step, 0, 1));
        } else if (event.key === " ") {
          event.preventDefault();
          if (state.playing) controller.pause();
          else controller.play(1);
        }
      }}
      className={cn(
        "h-[28px] w-full cursor-ew-resize touch-none select-none outline-none focus-visible:after:border-[color:var(--sp-line-focus)]",
        pickerChrome,
      )}
    >
      {state.solo ? (
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 h-[22px] -translate-y-1/2 rounded-[2px] bg-[color:var(--sp-fill-strong)]"
          style={{
            left: `calc(${state.solo.from * 100}% + ${PHASE_BAR_INSET}px)`,
            width: `calc(${(state.solo.to - state.solo.from) * 100}% - ${PHASE_BAR_INSET * 2}px)`,
          }}
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-l bg-[color:var(--sp-fill)]"
          style={{ width: trackMarkerLeft(state.q) }}
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 z-20 w-[2px] -translate-x-1/2 bg-[color:var(--sp-knob-off)]"
        style={{ left: trackMarkerLeft(state.q) }}
      />
      {state.pins.map((pin) => (
        <button
          key={pin}
          type="button"
          data-pin=""
          aria-label={`Момент ${momentMs(total, pin)} ms`}
          title={`${momentMs(total, pin)} ms`}
          onClick={() => controller.seek(pin)}
          className="absolute top-0 z-20 flex h-full w-[10px] -translate-x-1/2 items-center justify-center appearance-none border-0 bg-transparent p-0 outline-none"
          style={{ left: trackMarkerLeft(pin) }}
        >
          <span
            aria-hidden
            className="block h-[12px] w-[2px] rounded-[1px] bg-[color:var(--sp-knob-off)]"
          />
        </button>
      ))}
    </div>
  );
}

function TransportRow({
  label,
  state,
  controller,
  segments,
  total,
  locale,
}: {
  label: string;
  state: PlayerState;
  controller: PlayerController;
  segments: readonly PlayerSegment[];
  total: number;
  locale: PanelLocale;
}) {
  const { copied, copy } = useCopyFlash();
  const pinned = state.pins.some((pin) => Math.abs(pin - state.q) < PIN_EPSILON);

  function cycleSpeed() {
    const at = PLAYER_SPEEDS.findIndex((speed) => speed === state.speed);
    controller.setSpeed(PLAYER_SPEEDS[(at < 0 ? 0 : at + 1) % PLAYER_SPEEDS.length]);
  }

  function copyMoment() {
    void copy(momentCopyText(label, controller.id, state.q, segments, total));
  }

  const transport: { icon: SfSymbolName; label: string; active: boolean; run: () => void }[] = [
    {
      icon: "skip-back",
      label: tx(PANEL_COPY.back, locale),
      active: state.playing && state.direction === -1,
      run: () => controller.play(-1),
    },
    // Play/pause like any player: paused → run forward (from the end = from the start), running → freeze
    state.playing
      ? {
          icon: "pause",
          label: tx(PANEL_COPY.freeze, locale),
          active: false,
          run: () => controller.pause(),
        }
      : {
          icon: "play",
          label: tx(PANEL_COPY.play, locale),
          active: false,
          run: () => controller.play(1),
        },
    {
      icon: "skip-forward",
      label: tx(PANEL_COPY.forward, locale),
      active: state.playing && state.direction === 1,
      run: () => controller.play(1),
    },
  ];

  return (
    <div className="grid h-[28px] grid-cols-[1fr_auto_1fr] items-center">
      <div className="flex items-center gap-1 justify-self-start">
        <SfSymbol name="timer" className="size-5" style={{ color: MUTED }} />
        <FieldButton
          label={tx(PANEL_COPY.speed(state.speed), locale)}
          active={state.speed !== 1}
          onClick={cycleSpeed}
          className="font-mono text-[12px] leading-none tabular-nums"
        >
          ×{state.speed}
        </FieldButton>
      </div>
      <div className="flex items-center gap-1">
        {transport.map((item) => (
          <FieldButton
            key={item.icon === "pause" ? "play" : item.icon}
            label={item.label}
            active={item.active}
            onClick={item.run}
          >
            <SfSymbol name={item.icon} className="size-5" />
          </FieldButton>
        ))}
      </div>
      <div className="flex items-center gap-1 justify-self-end">
        <FieldButton
          label={pinned ? tx(PANEL_COPY.unpin, locale) : tx(PANEL_COPY.pin, locale)}
          active={pinned}
          onClick={() => controller.togglePin()}
        >
          <SfSymbol name={pinned ? "pin-off" : "pin"} className="size-5" />
        </FieldButton>
        <FieldButton label={tx(PANEL_COPY.copyMoment, locale)} onClick={copyMoment}>
          <SfSymbol name={copied ? "check" : "file"} className="size-5" />
        </FieldButton>
      </div>
    </div>
  );
}

type LaneDrag =
  | { type: "in" | "out"; i: number }
  | { type: "body"; i: number; grab: number }
  | { type: "press"; i: number; grab: number };

/**
 * Блоки — one lane per phase (chrome Field 28). Caption + duration sit left
 * in the field, not in the clip. Body drag slides the clip and shows start/end
 * badges; in/out handles trim one edge. Double-click the lane (the whole
 * field, not just the clip) = solo.
 */
function PhaseLanes({
  ariaLabel,
  segments,
  total,
  min,
  step,
  unit,
  onChange,
  controller,
  locale,
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
}) {
  const state = usePlayerState(controller);
  const rootRef = useRef<HTMLDivElement>(null);
  const laneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragRef = useRef<LaneDrag | null>(null);
  const pointer0 = useRef({ x: 0, moved: false });
  const [hover, setHover] = useState<number | null>(null);
  /** Which clip edge the pointer is near — handles show only there (Figma `347:3739`). */
  const [nearEdge, setNearEdge] = useState<"in" | "out" | null>(null);
  const [drag, setDrag] = useState<LaneDrag | null>(null);
  const [hint, setHint] = useState<{
    items: { ms: number; x: number }[];
    y: number;
    theme: string;
  } | null>(null);
  const layout = layoutOf(segments);
  /** Lane scale = the timeline; clips stop at its right edge, the length changes only via the ms field. */
  const safeScale = total > 0 ? total : 1;

  function tFromClientX(i: number, clientX: number) {
    const el = laneRefs.current[i];
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return clampNumber((clientX - rect.left) / rect.width, 0, 1) * safeScale;
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
          x: rect.left + (t / safeScale) * rect.width,
        };
      }),
      y: rect.top,
      theme:
        el.closest("[data-panel-theme]")?.getAttribute("data-panel-theme") ??
        "dark",
    });
  }

  function endDrag() {
    dragRef.current = null;
    setDrag(null);
    setHint(null);
  }

  function writeClip(i: number, start: number, duration: number) {
    const nextStart = clampNumber(snapStep(start, step), 0, Math.max(0, safeScale - min));
    const nextDur = clampNumber(
      snapStep(duration, step),
      min,
      Math.min(segments[i].max, safeScale - nextStart),
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
        total,
      ),
    );
    return { start: nextStart, duration: nextDur, end };
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
    const clip = layout[i];
    showEdgeHints(i, [edge === "in" ? clip.start : clip.end]);
  }

  function edgeNear(i: number, clientX: number): "in" | "out" | null {
    const lane = laneRefs.current[i];
    if (!lane) return null;
    const clip = layout[i];
    const rect = lane.getBoundingClientRect();
    const left = rect.left + (clip.start / safeScale) * rect.width;
    const right = rect.left + (clip.end / safeScale) * rect.width;
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
      const start = clampNumber(t, 0, Math.max(0, clip.end - min));
      const next = writeClip(current.i, start, clip.end - start);
      showEdgeHints(current.i, [next.start]);
      return;
    }
    const duration = clampNumber(
      t - clip.start,
      min,
      Math.min(segments[current.i].max, safeScale - clip.start),
    );
    const next = writeClip(current.i, clip.start, duration);
    showEdgeHints(current.i, [next.end]);
  }

  const moveRef = useRef(moveDrag);
  moveRef.current = moveDrag;
  const dragging = drag != null;

  useEffect(() => {
    if (!dragging) return;
    const kind =
      drag?.type === "in" || drag?.type === "out"
        ? "ew"
        : drag?.type === "body"
          ? "grab"
          : null;
    const html = document.documentElement;
    if (kind) html.dataset.phaseDrag = kind;
    const onWindowMove = (event: PointerEvent) => {
      const root = rootRef.current?.getBoundingClientRect();
      const outside =
        root != null &&
        (event.clientX < root.left - DRAG_EXIT_PX ||
          event.clientX > root.right + DRAG_EXIT_PX ||
          event.clientY < root.top - DRAG_EXIT_PX ||
          event.clientY > root.bottom + DRAG_EXIT_PX);
      if (event.buttons === 0 || outside) {
        endDrag();
        return;
      }
      moveRef.current(event.clientX);
    };
    const onWindowUp = () => endDrag();
    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowUp);
    window.addEventListener("pointercancel", onWindowUp);
    return () => {
      delete html.dataset.phaseDrag;
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerup", onWindowUp);
      window.removeEventListener("pointercancel", onWindowUp);
    };
  }, [dragging, drag?.type]);

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
        aria-valuemax={edge === "in" ? clip.end : clip.start + segments[i].max}
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
      className="flex w-full flex-col gap-1"
      role="group"
      aria-label={ariaLabel}
    >
      {layout.map((clip, i) => {
        const segment = segments[i];
        if (segment.kind === "pause") return null;
        const active = hover === i || drag?.i === i;
        const solo = state.solo?.phase === i;
        const lit = active || solo;
        const left = (clip.start / safeScale) * 100;
        const width = (clip.duration / safeScale) * 100;
        return (
          <div
            key={`${segment.caption}-${i}`}
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
                left: `calc(${left}% + ${PHASE_BAR_INSET}px)`,
                width: `calc(${Math.max(width, 0)}% - ${PHASE_BAR_INSET * 2}px)`,
              }}
            >
              {showHandle(i, "in") ? handleAt(i, "in") : null}
              {showHandle(i, "out") ? handleAt(i, "out") : null}
            </div>
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

export function SettingPlayer({
  label,
  segments,
  total,
  min = 0,
  step = 10,
  unit = "ms",
  controller,
  onChange,
  reduceMotion,
  locale = "ru",
  modified,
  onResetValue,
  info,
  icon,
  onIconChange,
}: {
  label: string;
  segments: readonly PlayerSegment[];
  /** Timeline length in ms — the phases live inside it. */
  total: number;
  min?: number;
  step?: number;
  unit?: string;
  controller: PlayerController;
  onChange: (next: PlayerClipsChange) => void;
  reduceMotion: boolean;
  locale?: PanelLocale;
} & ResetDotProps) {
  const open = usePlayerOpen(controller);
  const [phasesOpen, setPhasesOpen] = useState(true);
  const layout = layoutOf(segments);
  const maxTotal = Math.max(
    total,
    segments.reduce((sum, s) => sum + s.max, 0),
  );
  const aria = unit ? `${label} (${unit})` : label;

  /** The ms field sets the timeline length; phases keep their times and only get trimmed if they no longer fit. */
  function applyTotal(nextTotal: number) {
    const clamped = clampNumber(snapStep(nextTotal, step), min, maxTotal);
    onChange(emitClips(fitClipsToTotal(layout, clamped, min), clamped));
  }

  return (
    <div className={cn("flex flex-col", open && "gap-2")}>
      <div
        className="group flex h-[28px] items-center justify-between gap-4"
        data-setting-row=""
      >
        <RowLabel
          label={label}
          modified={modified}
          onResetValue={onResetValue}
          info={info}
          icon={icon}
          onIconChange={onIconChange}
          locale={locale}
        />
        <div className="relative flex shrink-0 items-center">
          <FieldButton
            label={open ? tx(PANEL_COPY.closePlayer(label), locale) : tx(PANEL_COPY.openPlayer(label), locale)}
            expanded={open}
            onClick={() => controller.setOpen(!open)}
            className={cn(
              "absolute top-0 right-full mr-1",
              !reduceMotion && "transition-opacity",
              open
                ? "opacity-100"
                : "opacity-100 fine-hover:pointer-events-none fine-hover:opacity-0 fine-hover:group-hover:pointer-events-auto fine-hover:group-hover:opacity-100",
            )}
            style={
              reduceMotion
                ? undefined
                : {
                    transitionDuration: `${SECTION_MS}ms`,
                    transitionTimingFunction: EASE_OUT,
                  }
            }
          >
            <SfSymbol name="circle-play" className="size-5" />
          </FieldButton>
          <NumberField
            ariaLabel={aria}
            max={maxTotal}
            min={min}
            onCommit={applyTotal}
            step={step}
            unit={unit}
            value={total}
          />
        </div>
      </div>
      <div
        className={cn(
          "grid",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          !reduceMotion && "transition-[grid-template-rows,opacity]",
        )}
        style={{
          opacity: open ? 1 : 0,
          ...(reduceMotion
            ? {}
            : {
                transitionDuration: open
                  ? `${SECTION_MS}ms`
                  : `${Math.round(SECTION_MS * 0.7)}ms`,
                transitionTimingFunction: EASE_OUT,
              }),
        }}
        inert={open ? undefined : true}
      >
        <div className="min-h-0 overflow-hidden">
          {open ? (
            <SettingPlayerOpen
              controller={controller}
              label={label}
              locale={locale}
              min={min}
              phasesOpen={phasesOpen}
              onChange={onChange}
              onPhasesOpen={setPhasesOpen}
              reduceMotion={reduceMotion}
              segments={segments}
              step={step}
              total={total}
              unit={unit}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SettingPlayerOpen({
  controller,
  label,
  locale,
  min,
  phasesOpen,
  onChange,
  onPhasesOpen,
  reduceMotion,
  segments,
  step,
  total,
  unit,
}: {
  controller: PlayerController;
  label: string;
  locale: PanelLocale;
  min: number;
  phasesOpen: boolean;
  onChange: (next: PlayerClipsChange) => void;
  onPhasesOpen: (open: boolean) => void;
  reduceMotion: boolean;
  segments: readonly PlayerSegment[];
  step: number;
  total: number;
  unit?: string;
}) {
  const layout = layoutOf(segments);
  const layoutKey = segments
    .map((segment) => `${segment.start ?? "p"}:${segment.value}`)
    .join("|");

  useEffect(() => {
    const solo = controller.getState().solo;
    if (solo == null || total <= 0) return;
    const clip = layout[solo.phase];
    if (!clip) {
      controller.setSolo(null);
      return;
    }
    const from = clip.start / total;
    const to = clip.end / total;
    if (
      Math.abs(from - solo.from) < 0.0005 &&
      Math.abs(to - solo.to) < 0.0005
    ) {
      return;
    }
    controller.setSolo({ phase: solo.phase, from, to });
  }, [controller, layout, layoutKey, total]);

  const phasesTitle = tx(PANEL_COPY.phases, locale);

  return (
    <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
      <SettingPlayerTransport
        controller={controller}
        label={label}
        locale={locale}
        reduceMotion={reduceMotion}
        segments={segments}
        total={total}
      />
      <div className="flex flex-col">
        <div className="flex h-[28px] items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onPhasesOpen(!phasesOpen)}
            aria-expanded={phasesOpen}
            className="flex min-w-0 flex-1 cursor-pointer items-center text-left outline-none"
          >
            <span
              className="truncate font-sans text-[15px] leading-[20px] select-none"
              style={{ color: MUTED }}
            >
              {phasesTitle}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onPhasesOpen(!phasesOpen)}
            aria-expanded={phasesOpen}
            aria-label={
              phasesOpen
                ? tx(PANEL_COPY.collapse(phasesTitle), locale)
                : tx(PANEL_COPY.expand(phasesTitle), locale)
            }
            className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center outline-none"
          >
            <SfSymbol
              name="chevron-up"
              className={cn(
                "size-5",
                !reduceMotion && "transition-transform",
                !phasesOpen && "rotate-180",
              )}
              style={
                reduceMotion
                  ? { color: ICON }
                  : {
                      color: ICON,
                      transitionDuration: `${CHEVRON_MS}ms`,
                      transitionTimingFunction: EASE_OUT,
                    }
              }
            />
          </button>
        </div>
        <SectionCollapse open={phasesOpen} reduceMotion={reduceMotion}>
          <div className="pt-1">
            <PhaseLanes
              ariaLabel={tx(PANEL_COPY.playerPhases(label), locale)}
              segments={segments}
              total={total}
              min={min}
              step={step}
              unit={unit}
              onChange={onChange}
              controller={controller}
              locale={locale}
            />
          </div>
        </SectionCollapse>
      </div>
    </div>
  );
}

function SettingPlayerTransport({
  controller,
  label,
  locale,
  reduceMotion,
  segments,
  total,
  track = true,
}: {
  controller: PlayerController;
  label: string;
  locale: PanelLocale;
  reduceMotion: boolean;
  segments: readonly PlayerSegment[];
  total: number;
  track?: boolean;
}) {
  const state = usePlayerState(controller);
  return (
    <>
      {track ? (
        <PlayerTrack
          ariaLabel={tx(PANEL_COPY.playerPosition(label), locale)}
          state={state}
          controller={controller}
          total={total}
        />
      ) : null}
      <TransportRow
        label={label}
        state={state}
        controller={controller}
        segments={segments}
        total={total}
        locale={locale}
      />
      <SettingToggle
        label={tx(PANEL_COPY.scrollView, locale)}
        value={state.scrollView}
        onChange={(next) => controller.setScrollView(next)}
        onLabel={tx(PANEL_COPY.on, locale)}
        offLabel={tx(PANEL_COPY.off, locale)}
        reduceMotion={reduceMotion}
      />
    </>
  );
}
