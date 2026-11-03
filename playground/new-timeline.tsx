import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { pinNear } from "../src/lib/playhead";
import { evalNumberExpression } from "../src/lib/eval-number-expression";
import { movePanelRow, orderPanelRows, panelRowSlot, samePanelRowOrder } from "../src/lib/panel-rows";
import type { TransitionPlayer } from "../src/lib/transition-player";
import { bindPointerDrag, DOCK_DRAG_PX, EASE_OUT, SECTION_MS } from "../src/settings-panel/chrome";
import { PANEL_COPY, tx } from "../src/settings-panel/locale";
import { snapStep } from "../src/settings-panel/number";
import {
  momentCopyText,
  playerSegments,
  usePlayerState,
} from "../src/settings-panel/player";
import { useCopyFlash } from "../src/settings-panel/use-copy-flash";
import { usePrefersReducedMotion } from "../src/lib/prefers-reduced-motion";
import type { PlayerSetting } from "../src/settings-panel/types";
import { SfSymbol, type SfSymbolName } from "../src/sf-symbol";
import { barClip, writeBarClip } from "./bar-times";
import { P, type PlaygroundSettings as S } from "./params";

/** First pass of Figma `New / Timeline · центр шкалы` (1036:5143). */
const SPEEDS = [1, 3, 5, 10] as const;
const MIN_MS = P.reel.min ?? 10;
const STEP_MS = P.reel.step ?? 10;
const EDGE_PX = 12;

type Line = {
  id: string;
  label: string;
  duration: number;
  start: number;
  max: number;
  phase: "card" | "bars";
  index: number;
};

type LiftPiece = {
  html: string;
  className: string;
  width: number;
  height: number;
  left: number;
  offsetY: number;
};

function clampMs(value: number, min: number, max: number) {
  return Math.min(Math.max(min, value), max);
}

function tops(root: HTMLElement | null) {
  const from = new Map<string, number>();
  if (!root) return from;
  for (const node of root.querySelectorAll<HTMLElement>("[data-sort-id]")) {
    if (node.hasAttribute("data-tl-lift")) continue;
    from.set(node.dataset.sortId ?? "", node.getBoundingClientRect().top);
  }
  return from;
}

function playFlip(root: HTMLElement | null, from: Map<string, number> | undefined) {
  if (!root || !from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const nodes: HTMLElement[] = [];
  for (const node of root.querySelectorAll<HTMLElement>("[data-sort-id]")) {
    if (node.hasAttribute("data-tl-lift")) continue;
    const prev = from.get(node.dataset.sortId ?? "");
    if (prev == null) continue;
    const dy = prev - node.getBoundingClientRect().top;
    if (Math.abs(dy) < 0.5) continue;
    node.style.transition = "none";
    node.style.transform = `translateY(${dy}px)`;
    nodes.push(node);
  }
  if (nodes.length === 0) return;
  root.getBoundingClientRect();
  for (const node of nodes) {
    node.style.transition = `transform ${SECTION_MS}ms ${EASE_OUT}`;
    node.style.transform = "";
  }
  window.setTimeout(() => {
    for (const node of nodes) node.style.transition = "";
  }, SECTION_MS);
}

function IconButton({
  label,
  pressed,
  onClick,
  name,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  name: SfSymbolName;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex size-6 items-center justify-center rounded ${pressed ? "bg-white text-black" : "bg-black text-white"}`}
    >
      <SfSymbol name={name} className="size-4" strokeWidth={1.8} />
    </button>
  );
}

function TimeValue({
  value,
  unit,
  min,
  max,
  onCommit,
}: {
  value: number;
  unit?: string;
  min: number;
  max: number;
  onCommit: (next: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const shown = editing ? draft : String(value);

  function commit(raw: string) {
    const parsed = evalNumberExpression(raw, value);
    if (parsed == null) return;
    onCommit(Math.min(max, Math.max(min, parsed)));
  }

  return (
    <span className="inline-flex h-[18px] shrink-0 items-center gap-1 tabular-nums">
      <span className="relative inline-flex h-[18px] items-center">
        <span className="text-[14px] leading-4 text-white">{shown || "0"}</span>
        <input
          value={shown}
          aria-label={unit ? `${value} ${unit}` : String(value)}
          onFocus={(event) => {
            setDraft(String(value));
            setEditing(true);
            event.currentTarget.select();
          }}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => {
            const raw = event.currentTarget.value.trim();
            if (raw !== "") commit(raw);
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            else if (event.key === "Escape") {
              setEditing(false);
              event.currentTarget.blur();
            } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              const dir = event.key === "ArrowUp" ? 1 : -1;
              const times = event.shiftKey ? 10 : 1;
              onCommit(Math.min(max, Math.max(min, value + dir * STEP_MS * times)));
              setEditing(false);
            }
          }}
          className="absolute inset-0 m-0 h-full w-full cursor-text appearance-none border-0 bg-transparent p-0 text-[14px] leading-none text-transparent caret-white outline-none"
        />
      </span>
      {unit ? <span className="text-[14px] leading-4 text-white/50">{unit}</span> : null}
    </span>
  );
}

function rulerMarks(total: number) {
  const marks: { at: number; major: boolean; label: boolean }[] = [];
  const minor = 250;
  const last = Math.floor(total / minor) * minor;
  for (let at = 0; at <= last; at += minor) {
    const major = at % 500 === 0;
    marks.push({ at, major, label: major });
  }
  if (marks[marks.length - 1]?.at !== total) marks.push({ at: total, major: true, label: true });
  return marks;
}

export function NewTimeline({
  settings,
  locale,
  player,
  onChange,
}: {
  settings: S;
  locale: "ru" | "en";
  player: TransitionPlayer;
  onChange: (patch: Partial<S>) => void;
}) {
  const state = usePlayerState(player);
  const { copied, copy } = useCopyFlash();
  const [elementsOpen, setElementsOpen] = useState(true);
  const total = Math.max(1, settings.reelTotalMs);
  const reel: PlayerSetting<S> = {
    ...P.reel,
    phases: P.reel.phases.map((phase) =>
      phase.stagger ? { ...phase, stagger: { ...phase.stagger, count: settings.columns } } : phase,
    ) as typeof P.reel.phases,
    controller: player,
  };
  const segments = playerSegments(reel, settings, locale);
  const lines: Line[] = segments.flatMap((segment): Line[] => {
    const stagger = segment.stagger;
    if (stagger == null || stagger.count < 2) {
      return [{
        id: segment.id ?? segment.caption,
        label: segment.caption,
        duration: segment.value,
        start: segment.start ?? 0,
        max: segment.max ?? 2000,
        phase: "card",
        index: 0,
      }];
    }
    return Array.from({ length: stagger.count }, (_, index) => {
      const clip = barClip(settings.barTimes, index);
      return {
        id: `${segment.id ?? segment.caption}-${index}`,
        label: `${stagger.caption} ${index + 1}`,
        duration: clip.duration,
        start: clip.start,
        max: segment.max ?? 2000,
        phase: "bars" as const,
        index,
      };
    });
  });
  const [order, setOrder] = useState<string[]>([]);
  const ordered = orderPanelRows(lines, order.length > 0 ? order : undefined);
  const pinned = pinNear(state.pins, state.q);
  const q = Math.min(1, Math.max(0, state.q));
  const reduce = usePrefersReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const rowListRef = useRef<HTMLDivElement>(null);
  const laneListRef = useRef<HTMLDivElement>(null);
  const orderRef = useRef(order);
  orderRef.current = order;
  const flipFrom = useRef<{ rows: Map<string, number>; lanes: Map<string, number> } | null>(null);
  const rowLiftRef = useRef<HTMLDivElement>(null);
  const laneLiftRef = useRef<HTMLDivElement>(null);
  const liftMeta = useRef<{ row: LiftPiece; lane: LiftPiece; y: number } | null>(null);
  const [lift, setLift] = useState<{ row: LiftPiece; lane: LiftPiece } | null>(null);
  const dragging = useRef(false);

  useLayoutEffect(() => {
    const meta = liftMeta.current;
    if (!lift || !meta) return;
    placeLifts(meta.y);
  }, [lift]);

  useLayoutEffect(() => {
    const from = flipFrom.current;
    flipFrom.current = null;
    if (!from || reduce) return;
    playFlip(rowListRef.current, from.rows);
    playFlip(laneListRef.current, from.lanes);
  }, [order, reduce]);

  function placeLifts(clientY: number) {
    const meta = liftMeta.current;
    const row = rowLiftRef.current;
    const lane = laneLiftRef.current;
    if (!meta || !row || !lane) return;
    meta.y = clientY;
    row.style.top = `${clientY - meta.row.offsetY}px`;
    lane.style.top = `${clientY - meta.lane.offsetY}px`;
  }

  function piece(node: HTMLElement, clientY: number): LiftPiece {
    const rect = node.getBoundingClientRect();
    return {
      html: node.innerHTML,
      className: node.className,
      width: rect.width,
      height: rect.height,
      left: rect.left,
      offsetY: clientY - rect.top,
    };
  }

  function clearLift() {
    for (const node of rootRef.current?.querySelectorAll<HTMLElement>("[data-tl-lift]") ?? []) {
      delete node.dataset.tlLift;
    }
    liftMeta.current = null;
    setLift(null);
    delete document.documentElement.dataset.phaseDrag;
  }

  function shiftOrder(next: string[]) {
    if (samePanelRowOrder(orderRef.current.length > 0 ? orderRef.current : ordered.map((line) => line.id), next)) return;
    flipFrom.current = { rows: tops(rowListRef.current), lanes: tops(laneListRef.current) };
    orderRef.current = next;
    setOrder(next);
  }

  function moveOrder(id: string, clientY: number) {
    const root = rowListRef.current;
    if (!root) return;
    const boxes = [...root.querySelectorAll<HTMLElement>("[data-tl-row]")].map((node) => {
      const rect = node.getBoundingClientRect();
      return { id: node.dataset.tlRow ?? "", top: rect.top, bottom: rect.bottom };
    });
    const hit = panelRowSlot(boxes, id, clientY);
    const current = boxes.map((box) => box.id);
    const next = hit ? movePanelRow(current, id, hit.index) : current;
    if (hit && !samePanelRowOrder(current, next)) shiftOrder(next);
  }

  function beginReorder(id: string, clientY: number) {
    if (ordered.length < 2 || liftMeta.current) return;
    const row = rowListRef.current?.querySelector<HTMLElement>(`[data-tl-row="${CSS.escape(id)}"]`);
    const lane = laneListRef.current?.querySelector<HTMLElement>(`[data-tl-lane="${CSS.escape(id)}"]`);
    if (!row || !lane) return;
    const rowPiece = piece(row, clientY);
    const lanePiece = piece(lane, clientY);
    row.dataset.tlLift = "";
    lane.dataset.tlLift = "";
    document.documentElement.dataset.phaseDrag = "grab";
    liftMeta.current = { row: rowPiece, lane: lanePiece, y: clientY };
    setLift({ row: rowPiece, lane: lanePiece });
  }

  function msAt(lane: HTMLElement, clientX: number) {
    const rect = lane.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return clampMs((clientX - rect.left) / rect.width, 0, 1) * total;
  }

  function clipEdge(lane: HTMLElement, line: Line, clientX: number): "in" | "out" | null {
    const rect = lane.getBoundingClientRect();
    const width = (line.duration / total) * rect.width;
    if (width < EDGE_PX * 2) return null;
    const left = rect.left + (line.start / total) * rect.width;
    const right = left + width;
    if (clientX < left - 2 || clientX > right + 2) return null;
    if (Math.abs(clientX - left) <= EDGE_PX) return "in";
    if (Math.abs(clientX - right) <= EDGE_PX) return "out";
    return null;
  }

  function overClip(lane: HTMLElement, line: Line, clientX: number) {
    const rect = lane.getBoundingClientRect();
    const left = rect.left + (line.start / total) * rect.width;
    const right = left + (line.duration / total) * rect.width;
    return clientX >= left && clientX <= right;
  }

  function applyLine(line: Line, start: number, duration: number) {
    const dur = clampMs(snapStep(duration, STEP_MS), MIN_MS, Math.min(line.max, total));
    if (line.phase === "card") {
      onChange({
        reelInStartMs: clampMs(snapStep(start, STEP_MS), 0, Math.max(0, total - dur)),
        reelInMs: dur,
      });
      return;
    }
    onChange({
      barTimes: writeBarClip(settings.barTimes, line.index, {
        start: clampMs(snapStep(start, STEP_MS), 0, Math.max(0, total - dur)),
        duration: dur,
      }),
    });
  }

  function armRowReorder(id: string, event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, button, a")) return;
    event.stopPropagation();
    const y0 = event.clientY;
    const x0 = event.clientX;
    let moving = false;
    bindPointerDrag(event.pointerId, {
      onMove(ev) {
        if (!moving && Math.hypot(ev.clientX - x0, ev.clientY - y0) < DOCK_DRAG_PX) return;
        if (!moving) {
          moving = true;
          dragging.current = true;
          beginReorder(id, ev.clientY);
        }
        placeLifts(ev.clientY);
        moveOrder(id, ev.clientY);
      },
      onEnd() {
        dragging.current = false;
        clearLift();
      },
    });
  }

  function commitDuration(line: Line, next: number) {
    applyLine(line, line.start, next);
  }

  function onLaneDown(line: Line, event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const lane = event.currentTarget;
    const x0 = event.clientX;
    const y0 = event.clientY;
    const onClip = overClip(lane, line, x0);
    const edge = onClip ? clipEdge(lane, line, x0) : null;
    const grab = msAt(lane, x0) - line.start;
    const originStart = line.start;
    const originDuration = line.duration;
    const originEnd = originStart + originDuration;
    let mode: "pending" | "seek" | "move" | "in" | "out" | "reorder" = "pending";
    event.preventDefault();
    event.stopPropagation();
    bindPointerDrag(event.pointerId, {
      onMove(ev) {
        const dx = ev.clientX - x0;
        const dy = ev.clientY - y0;
        if (mode === "pending") {
          if (Math.hypot(dx, dy) < DOCK_DRAG_PX) return;
          if (Math.abs(dy) > Math.abs(dx)) mode = "reorder";
          else if (!onClip) mode = "seek";
          else if (edge === "in") mode = "in";
          else if (edge === "out") mode = "out";
          else mode = "move";
          dragging.current = true;
          if (mode === "reorder") beginReorder(line.id, ev.clientY);
          else document.documentElement.dataset.phaseDrag = mode === "move" ? "grab" : "ew";
        }
        if (mode === "reorder") {
          placeLifts(ev.clientY);
          moveOrder(line.id, ev.clientY);
          return;
        }
        const t = snapStep(msAt(lane, ev.clientX), STEP_MS);
        if (mode === "seek") player.seek(t / total);
        else if (mode === "move") applyLine(line, clampMs(t - grab, 0, Math.max(0, total - originDuration)), originDuration);
        else if (mode === "in") {
          const start = clampMs(t, 0, originEnd - MIN_MS);
          applyLine(line, start, originEnd - start);
        } else if (mode === "out") {
          const end = clampMs(t, originStart + MIN_MS, total);
          applyLine(line, originStart, end - originStart);
        }
      },
      onEnd() {
        if (mode === "pending" && !onClip) player.seek(msAt(lane, x0) / total);
        dragging.current = false;
        clearLift();
      },
    });
  }

  function scrub(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    const el = event.currentTarget;
    const qAt = (clientX: number) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    };
    event.preventDefault();
    player.seek(qAt(event.clientX));
    bindPointerDrag(event.pointerId, {
      onMove: (ev) => player.seek(qAt(ev.clientX)),
      onEnd: () => {},
    });
  }

  function cycleSpeed() {
    const at = SPEEDS.findIndex((speed) => speed === state.speed);
    player.setSpeed(SPEEDS[(at < 0 ? 0 : at + 1) % SPEEDS.length]);
  }

  const backLabel = tx(PANEL_COPY.back, locale);
  const forwardLabel = tx(PANEL_COPY.forward, locale);
  const playLabel = tx(state.playing ? PANEL_COPY.freeze : PANEL_COPY.play, locale);

  return (
    <section ref={rootRef} data-chrome="" className="flex w-[min(944px,calc(100vw-24px))] flex-col gap-1 rounded-2xl bg-white p-2 text-black">
      <div className="flex w-full items-center">
        <div className="flex w-60 shrink-0 items-center gap-1 px-1">
          <SfSymbol name="contrast" className="size-4" strokeWidth={1.8} />
          <p className="text-[14px] leading-4">{tx(PANEL_COPY.dockTimeline, locale)}</p>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center">
          <span />
          <div className="flex items-center gap-1">
            <IconButton label={backLabel} pressed={state.playing && state.direction === -1} onClick={() => player.play(-1)} name="skip-back" />
            <IconButton
              label={playLabel}
              onClick={() => (state.playing ? player.pause() : player.play(1))}
              name={state.playing ? "pause" : "play"}
            />
            <IconButton label={forwardLabel} pressed={state.playing && state.direction === 1} onClick={() => player.play(1)} name="skip-forward" />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              aria-label={tx(PANEL_COPY.speed(state.speed), locale)}
              onClick={cycleSpeed}
              className="flex h-6 items-center justify-center rounded bg-black px-1.5 text-[14px] leading-4 text-white tabular-nums"
            >
              ×{state.speed}
            </button>
            <div className="flex items-center gap-1">
              <IconButton
                label={tx(pinned ? PANEL_COPY.unpin : PANEL_COPY.pin, locale)}
                pressed={pinned}
                onClick={() => player.togglePin()}
                name="pin"
              />
              <IconButton
                label={tx(PANEL_COPY.copyMoment, locale)}
                pressed={copied}
                onClick={() => void copy(momentCopyText(tx(P.reel.label, locale), player.id, state.q, segments, total, "ms"))}
                name={copied ? "check" : "file"}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="flex w-full items-start">
        <div className="flex w-60 shrink-0 flex-col gap-2">
          <div className="flex h-8 items-center justify-between rounded-lg bg-black px-1">
            <span className="truncate text-[14px] leading-4 text-white">{tx(PANEL_COPY.animationTime, locale)}</span>
            <TimeValue
              value={settings.reelTotalMs}
              unit="ms"
              min={MIN_MS}
              max={20000}
              onCommit={(reelTotalMs) => onChange({ reelTotalMs })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              aria-expanded={elementsOpen}
              onClick={() => setElementsOpen((open) => !open)}
              className="flex h-4 items-center px-1 text-left text-[14px] leading-4"
            >
              <span className="min-w-0 flex-1 truncate">{tx(PANEL_COPY.phases, locale)}</span>
              <SfSymbol name={elementsOpen ? "chevron-up" : "chevron-down"} className="size-4" strokeWidth={1.8} />
            </button>
            {elementsOpen ? (
              <div ref={rowListRef} className="overflow-hidden rounded-lg bg-black">
                {ordered.map((line) => (
                  <div
                    key={line.id}
                    data-row=""
                    data-sort-id={line.id}
                    data-tl-row={line.id}
                    onPointerDown={(event) => armRowReorder(line.id, event)}
                    className="flex h-8 cursor-grab touch-none items-center justify-between px-1 select-none"
                  >
                    <span className="min-w-0 flex-1 truncate text-[14px] leading-4 text-white">{line.label}</span>
                    <TimeValue
                      value={line.duration}
                      min={MIN_MS}
                      max={line.max}
                      onCommit={(next) => commitDuration(line, next)}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="rounded-lg bg-black p-1">
            <div
              role="slider"
              tabIndex={0}
              aria-label={tx(PANEL_COPY.animationTime, locale)}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={Math.round(q * total)}
              onPointerDown={scrub}
              onKeyDown={(event) => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                event.preventDefault();
                const dir = event.key === "ArrowRight" ? 1 : -1;
                const step = (event.shiftKey ? 100 : STEP_MS) / total;
                player.seek(q + dir * step);
              }}
              className="relative h-6 cursor-ew-resize touch-none overflow-hidden rounded border border-white outline-none"
            >
              <div className="absolute inset-y-[-1px] left-[-1px] bg-white" style={{ width: `calc(${q * 100}% + 1px)` }} />
              {state.pins.map((pin) => (
                <span
                  key={pin}
                  className="absolute top-[7px] h-2 w-0.5 rounded-[1px] bg-white"
                  style={{ left: `calc(${pin * 100}% - 1px)` }}
                />
              ))}
              <span className="absolute top-[7px] h-2 w-0.5 rounded-[1px] bg-white/50" style={{ left: `calc(${q * 100}% - 1px)` }} />
            </div>
          </div>
          {elementsOpen ? (
            <div className="relative h-[22px]">
              {rulerMarks(total).map((mark) => (
                <span key={mark.at}>
                  <i
                    className={`absolute bottom-0 w-px bg-black/40 ${mark.major ? "h-1.5" : "h-1"}`}
                    style={{ left: `${(mark.at / total) * 100}%` }}
                  />
                  {mark.label ? (
                    <span
                      className="absolute top-1 text-[11px] leading-3 text-black/50 tabular-nums"
                      style={{
                        left: `${(mark.at / total) * 100}%`,
                        transform: mark.at === 0 ? undefined : mark.at === total ? "translateX(-100%)" : "translateX(-50%)",
                      }}
                    >
                      {mark.at}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}
          {elementsOpen ? (
            <div ref={laneListRef} className="flex flex-col gap-2 rounded-lg bg-black p-1">
              {ordered.map((line) => (
                  <div
                    key={line.id}
                    data-sort-id={line.id}
                    data-tl-lane={line.id}
                    role="slider"
                    tabIndex={0}
                    aria-label={line.label}
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={Math.round(line.start)}
                    aria-valuetext={`${Math.round(line.start)}–${Math.round(line.start + line.duration)}`}
                    onPointerDown={(event) => onLaneDown(line, event)}
                    onPointerMove={(event) => {
                      if (dragging.current) return;
                      const lane = event.currentTarget;
                      const edge = overClip(lane, line, event.clientX) ? clipEdge(lane, line, event.clientX) : null;
                      lane.style.cursor = edge ? "ew-resize" : overClip(lane, line, event.clientX) ? "grab" : "ew-resize";
                    }}
                    className="relative h-6 cursor-ew-resize touch-none overflow-hidden rounded border border-white"
                  >
                    <span
                      data-clip=""
                      className="pointer-events-none absolute top-[2px] h-[18px] rounded-[2px] bg-white"
                      style={{
                        left: `${(line.start / total) * 100}%`,
                        width: `${(line.duration / total) * 100}%`,
                      }}
                    />
                  </div>
              ))}
            </div>
          ) : null}
          {lift
            ? createPortal(
                <>
                  <div
                    ref={rowLiftRef}
                    className="pointer-events-none fixed z-[110] origin-top-left scale-[1.03] overflow-hidden rounded-lg bg-black shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
                    style={{ left: lift.row.left, width: lift.row.width, height: lift.row.height }}
                  >
                    <div className={lift.row.className} dangerouslySetInnerHTML={{ __html: lift.row.html }} />
                  </div>
                  <div
                    ref={laneLiftRef}
                    className="pointer-events-none fixed z-[110] origin-top-left scale-[1.03] shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
                    style={{ left: lift.lane.left, width: lift.lane.width, height: lift.lane.height }}
                  >
                    <div className={lift.lane.className} dangerouslySetInnerHTML={{ __html: lift.lane.html }} />
                  </div>
                </>,
                document.body,
              )
            : null}
        </div>
      </div>
    </section>
  );
}
