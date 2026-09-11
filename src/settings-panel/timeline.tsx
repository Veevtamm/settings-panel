"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  fitClipsToTotal,
  layoutClips,
  type ClipInput,
} from "../lib/player-clips";
import {
  readPanelSettings,
  subscribePanelTheme,
  usePanelLocale,
  usePanelTheme,
} from "../lib/panel-theme";
import { clampNumber, cn } from "../lib/utils";
import { usePrefersReducedMotion } from "../lib/prefers-reduced-motion";
import { SfSymbol } from "../sf-symbol";
import {
  DOCK_BTN,
  DOCK_INSET,
  DIM,
  GAP_IN,
  GLASS,
  ICON,
  MUTED,
  SUBSECTION_DRAG_PX,
  CHEVRON_MS,
  EASE_OUT,
  type DockCorner,
} from "./chrome";
import { FieldButton, NumberField, SettingEnumDropdown } from "./fields";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";
import { snapStep } from "./number";
import {
  LANE_PAD_PX,
  PhaseLanes,
  PlayerTrack,
  TransportRow,
  trackMarkerLeft,
  usePlayerState,
  type PlayerClipsChange,
  type PlayerSegment,
} from "./player";
import type { PlayerController, PlayerSetting } from "./types";

const INSPECTOR = 328;
/** Inspector / lane row 28 + `gap-1`. */
const ELEMENT_ROW_PX = 32;

function segmentId(segment: PlayerSegment, index: number) {
  return segment.id ?? String(index);
}

function movableIds(segments: readonly PlayerSegment[]): string[] {
  return segments.flatMap((segment, index) =>
    segment.kind === "pause" ? [] : [segmentId(segment, index)],
  );
}

function mergeOrder(
  saved: readonly string[] | undefined,
  ids: readonly string[],
) {
  const known = new Set(ids);
  const kept = (saved ?? []).filter((id) => known.has(id));
  const rest = ids.filter((id) => !kept.includes(id));
  return [...kept, ...rest];
}

function indicesFor(
  segments: readonly PlayerSegment[],
  orderIds: readonly string[],
): number[] {
  const movable = segments.flatMap((segment, index) =>
    segment.kind === "pause" ? [] : [{ index, id: segmentId(segment, index) }],
  );
  const byId = new Map(movable.map((item) => [item.id, item.index]));
  const seen = new Set<number>();
  const next: number[] = [];
  for (const id of orderIds) {
    const index = byId.get(id);
    if (index == null || seen.has(index)) continue;
    seen.add(index);
    next.push(index);
  }
  for (const item of movable) {
    if (!seen.has(item.index)) next.push(item.index);
  }
  return next;
}

function readTimelineOrder(panelId: string, playerId: string): string[] | undefined {
  try {
    const raw = localStorage.getItem(`${panelId}:timeline-order`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    const list = (parsed as Record<string, unknown>)[playerId];
    if (!Array.isArray(list) || list.some((item) => typeof item !== "string")) {
      return undefined;
    }
    return list as string[];
  } catch {
    return undefined;
  }
}

function writeTimelineOrder(
  panelId: string,
  playerId: string,
  orderIds: readonly string[],
) {
  try {
    const raw = localStorage.getItem(`${panelId}:timeline-order`);
    const parsed = raw != null ? (JSON.parse(raw) as unknown) : {};
    const file =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? { ...(parsed as Record<string, string[]>) }
        : {};
    file[playerId] = [...orderIds];
    localStorage.setItem(`${panelId}:timeline-order`, JSON.stringify(file));
  } catch {
    /* quota / private mode */
  }
}

function inputsOf(segments: readonly PlayerSegment[]): ClipInput[] {
  return segments.map((segment) =>
    segment.start == null
      ? { duration: segment.value }
      : { duration: segment.value, start: segment.start },
  );
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

function rulerMarks(total: number) {
  const step = 100;
  const majorEvery = 500;
  const marks: { ms: number; major: boolean }[] = [];
  for (let t = 0; t <= total; t += step) {
    /** Drop a grid step that would sit on `total` (1550: no 1500 label). */
    if (t > 0 && t < total && total - t < step) continue;
    marks.push({ ms: t, major: t % majorEvery === 0 || t === 0 });
  }
  if (marks[marks.length - 1]?.ms !== total) {
    marks.push({ ms: total, major: true });
  }
  return marks;
}

function useDockCorner(panelId: string | undefined, fallback: DockCorner) {
  return useSyncExternalStore(
    (onChange) => (panelId ? subscribePanelTheme(panelId, onChange) : () => {}),
    () =>
      (panelId ? readPanelSettings(panelId).dockCorner : undefined) ?? fallback,
    () => fallback,
  );
}

const dockBtnClass =
  "inline-flex size-[34px] shrink-0 items-center justify-center rounded-md border px-0 font-sans backdrop-blur-[8px] outline-none transition-[border-color,background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:border-[color:var(--sp-line-focus)] focus-visible:ring-1 focus-visible:ring-[color:var(--sp-line-mid)] active:scale-[0.97]";

export function SettingsTimelineDockButton({
  controller,
  locale = "ru",
  className,
}: {
  controller: PlayerController;
  locale?: PanelLocale;
  className?: string;
}) {
  const open = usePlayerState(controller).open;
  return (
    <button
      type="button"
      data-settings-panel=""
      aria-pressed={open}
      aria-label={tx(
        open ? PANEL_COPY.closeTimeline : PANEL_COPY.openTimeline,
        locale,
      )}
      onClick={() => controller.setOpen(!open)}
      className={cn(
        dockBtnClass,
        open
          ? "border-[color:var(--sp-line-strong)] hover:border-[color:var(--sp-line-focus)]"
          : "border-[color:var(--sp-line)] hover:border-[color:var(--sp-line-hover)] hover:bg-[color:var(--sp-fill-hover)]",
        className,
      )}
      style={{
        background: GLASS,
        color: open ? ICON : MUTED,
      }}
    >
      <SfSymbol name={open ? "x" : "timer"} />
    </button>
  );
}

export function SettingsTimeline({
  panelId,
  label,
  segments,
  total,
  min = 10,
  step = 10,
  unit = "ms",
  controller,
  onChange,
  locale: localeProp = "ru",
  dockCorner: dockCornerProp = "top-left",
  showDockButton = true,
  onEditCurve,
  targets,
  onTargetChange,
}: {
  panelId?: string;
  label: string;
  segments: readonly PlayerSegment[];
  total: number;
  min?: number;
  step?: number;
  unit?: string;
  controller: PlayerController;
  onChange: (next: PlayerClipsChange) => void;
  locale?: PanelLocale;
  dockCorner?: DockCorner;
  /** Independent timer under the gear. Prefer `dockExtra` + `showDockButton={false}` next to SettingsPanel. */
  showDockButton?: boolean;
  onEditCurve?: (phase: number) => void;
  /** Animation picker (Figma `ex / Dropdown`). Omit = the current player only. */
  targets?: readonly { id: string; label: string }[];
  onTargetChange?: (id: string) => void;
}) {
  const theme = usePanelTheme(panelId ?? "__timeline__");
  const storedLocale = usePanelLocale(panelId ?? "__timeline__");
  const locale = panelId ? storedLocale : localeProp;
  const reduceMotion = usePrefersReducedMotion();
  const dockCorner = useDockCorner(panelId, dockCornerProp);
  const state = usePlayerState(controller);
  const open = state.open;
  const layout = layoutClips(inputsOf(segments));
  const maxTotal = Math.max(
    total,
    segments.reduce((sum, segment) => sum + segment.max, 0),
  );
  const [mounted, setMounted] = useState(false);
  const [elementsOpen, setElementsOpen] = useState(true);
  const [orderIds, setOrderIds] = useState<string[]>(() =>
    mergeOrder(
      panelId ? readTimelineOrder(panelId, controller.id) : undefined,
      movableIds(segments),
    ),
  );
  const [dragVisual, setDragVisual] = useState<number | null>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const orderDragRef = useRef<{
    visual: number;
    pointerId: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const orderIdsRef = useRef(orderIds);
  orderIdsRef.current = orderIds;

  const idsKey = movableIds(segments).join("|");
  useEffect(() => {
    setOrderIds((prev) => mergeOrder(prev, idsKey.split("|").filter(Boolean)));
  }, [idsKey]);

  const rowOrder = indicesFor(segments, orderIds);

  function onGripPointerDown(
    event: ReactPointerEvent<HTMLSpanElement>,
    visual: number,
  ) {
    if (event.button !== 0) return;
    if (rowOrder.length < 2) return;
    event.preventDefault();
    event.stopPropagation();
    orderDragRef.current = {
      visual,
      pointerId: event.pointerId,
      startY: event.clientY,
      moved: false,
    };
    setDragVisual(visual);
  }

  useEffect(() => {
    const drag = orderDragRef.current;
    if (dragVisual == null || !drag) return;
    const html = document.documentElement;
    html.dataset.panelReorder = "";
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      if (
        !drag.moved &&
        Math.abs(event.clientY - drag.startY) < SUBSECTION_DRAG_PX
      ) {
        return;
      }
      drag.moved = true;
      const list = rowsRef.current;
      if (!list) return;
      const count = orderIdsRef.current.length;
      if (count < 2) return;
      const target = clampNumber(
        Math.floor((event.clientY - list.getBoundingClientRect().top) / ELEMENT_ROW_PX),
        0,
        count - 1,
      );
      if (target === drag.visual) return;
      const next = [...orderIdsRef.current];
      const [moved] = next.splice(drag.visual, 1);
      if (moved == null) return;
      next.splice(target, 0, moved);
      drag.visual = target;
      setDragVisual(target);
      setOrderIds(next);
      if (panelId) writeTimelineOrder(panelId, controller.id, next);
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      orderDragRef.current = null;
      setDragVisual(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      delete html.dataset.panelReorder;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [controller.id, dragVisual, panelId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  function applyTotal(nextTotal: number) {
    const clamped = clampNumber(snapStep(nextTotal, step), min, maxTotal);
    onChange(emitClips(fitClipsToTotal(layout, clamped, min), clamped));
  }

  function applyDuration(index: number, next: number) {
    const clip = layout[index];
    if (!clip) return;
    const duration = clampNumber(
      snapStep(next, step),
      min,
      Math.min(segments[index].max, total - clip.start),
    );
    onChange(
      emitClips(
        layout.map((item, i) =>
          i === index
            ? { ...item, duration, packed: false, end: item.start + duration }
            : item,
        ),
        total,
      ),
    );
  }

  const dockBottom = dockCorner.startsWith("bottom");
  const dockRight = dockCorner.endsWith("right");
  const phasesTitle = tx(PANEL_COPY.phases, locale);
  const marks = rulerMarks(total);
  const glassPad = DOCK_INSET;
  const dockCol = DOCK_BTN + GAP_IN;
  const glassLeft =
    dockBottom && !dockRight ? glassPad + dockCol : glassPad;
  const glassRight =
    dockBottom && dockRight ? glassPad + dockCol : glassPad;

  return createPortal(
    <>
      {showDockButton ? (
        <div
          data-settings-panel=""
          data-panel-theme={theme}
          className="fixed z-[100]"
          style={{
            left: dockRight ? undefined : DOCK_INSET,
            right: dockRight ? DOCK_INSET : undefined,
            top: dockBottom ? undefined : DOCK_INSET + DOCK_BTN + GAP_IN,
            bottom: dockBottom ? DOCK_INSET + DOCK_BTN + GAP_IN : undefined,
          }}
        >
          <SettingsTimelineDockButton controller={controller} locale={locale} />
        </div>
      ) : null}
      {open ? (
        <div
          data-settings-panel=""
          data-settings-timeline=""
          data-panel-theme={theme}
          role="region"
          aria-label={tx(PANEL_COPY.openTimeline, locale)}
          className="fixed z-[100] overflow-hidden rounded-lg border border-[color:var(--sp-line)] font-sans backdrop-blur-[8px]"
          style={{
            background: GLASS,
            left: glassLeft,
            right: glassRight,
            bottom: glassPad,
          }}
        >
          <div className="flex flex-col gap-2 py-2 pl-3 pr-2">
            <div className="flex items-start gap-2">
              <div className="shrink-0" style={{ width: INSPECTOR }}>
                <SettingEnumDropdown
                  label={tx(PANEL_COPY.timelineTarget, locale)}
                  locale={locale}
                  onChange={(id) => onTargetChange?.(id)}
                  options={(targets ?? [{ id: controller.id, label }]).map(
                    (target) => ({
                      value: target.id,
                      label: target.label,
                    }),
                  )}
                  reduceMotion={reduceMotion}
                  value={controller.id}
                  overlay
                />
              </div>
              <div className="min-w-0 flex-1">
                <TransportRow
                  controller={controller}
                  label={label}
                  locale={locale}
                  segments={segments}
                  state={state}
                  total={total}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div
                className="flex h-[28px] shrink-0 items-center justify-between gap-2"
                style={{ width: INSPECTOR }}
              >
                <span
                  className="min-w-0 truncate text-[15px] leading-[20px]"
                  style={{ color: ICON }}
                >
                  {tx(PANEL_COPY.animationTime, locale)}
                </span>
                <NumberField
                  ariaLabel={tx(PANEL_COPY.animationTime, locale)}
                  max={maxTotal}
                  min={min}
                  onCommit={applyTotal}
                  step={step}
                  unit={unit}
                  value={total}
                />
              </div>
              <div className="min-w-0 flex-1">
                <PlayerTrack
                  ariaLabel={tx(PANEL_COPY.playerPosition(label), locale)}
                  controller={controller}
                  state={state}
                  total={total}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-5 shrink-0 items-center justify-between outline-none"
                  style={{ width: INSPECTOR }}
                  aria-expanded={elementsOpen}
                  onClick={() => setElementsOpen((prev) => !prev)}
                >
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <SfSymbol name="sliders-horizontal" className="size-5" style={{ color: ICON }} />
                    <span
                      className="truncate text-[15px] leading-[20px]"
                      style={{ color: MUTED }}
                    >
                      {phasesTitle}
                    </span>
                  </span>
                  <SfSymbol
                    name="chevron-up"
                    className={cn("size-5", !elementsOpen && "rotate-180")}
                    style={{ color: ICON }}
                  />
                </button>
                <div className="relative h-5 min-w-0 flex-1">
                  {marks.map(({ ms, major }) => {
                    const q = total > 0 ? ms / total : 0;
                    const edge =
                      ms === 0 ? "start" : ms === total ? "end" : "mid";
                    return (
                      <Fragment key={ms}>
                        {major ? (
                          <span
                            className={cn(
                              "absolute top-0 whitespace-nowrap font-mono text-[11px] leading-[14px] tabular-nums",
                              edge === "mid" && "-translate-x-1/2",
                              edge === "end" && "-translate-x-full",
                            )}
                            style={{
                              left: trackMarkerLeft(q, LANE_PAD_PX),
                              color: DIM,
                            }}
                          >
                            {ms}
                          </span>
                        ) : null}
                        <span
                          aria-hidden
                          className="absolute w-px -translate-x-1/2 bg-[color:var(--sp-tick)]"
                          style={{
                            left: trackMarkerLeft(q, LANE_PAD_PX),
                            top: major ? 14 : 16,
                            height: major ? 6 : 4,
                          }}
                        />
                      </Fragment>
                    );
                  })}
                </div>
              </div>
              {elementsOpen ? (
                <div className="flex items-start gap-2">
                  <div
                    ref={rowsRef}
                    className="flex shrink-0 flex-col gap-1"
                    style={{ width: INSPECTOR }}
                  >
                    {rowOrder.map((index, visual) => {
                      const segment = segments[index];
                      const clip = layout[index];
                      if (!segment || !clip) return null;
                      return (
                        <div
                          key={segmentId(segment, index)}
                          className="group/el flex h-[28px] items-center gap-2"
                        >
                          <span className="flex min-w-0 flex-1 items-center">
                            {rowOrder.length > 1 ? (
                              <span
                                role="button"
                                tabIndex={0}
                                aria-grabbed={dragVisual === visual}
                                aria-label={tx(PANEL_COPY.drag, locale)}
                                className={cn(
                                  "inline-flex h-5 shrink-0 cursor-grab items-center justify-center overflow-hidden touch-none active:cursor-grabbing",
                                  !reduceMotion &&
                                    "transition-[width,margin,opacity,transform]",
                                  dragVisual === visual
                                    ? "w-5 mr-1 scale-100 opacity-100"
                                    : "w-5 mr-1 scale-100 opacity-100 fine-hover:mr-0 fine-hover:w-0 fine-hover:scale-95 fine-hover:opacity-0 fine-hover:group-hover/el:mr-1 fine-hover:group-hover/el:w-5 fine-hover:group-hover/el:scale-100 fine-hover:group-hover/el:opacity-100",
                                )}
                                style={
                                  reduceMotion
                                    ? undefined
                                    : {
                                        transitionDuration: `${CHEVRON_MS}ms`,
                                        transitionTimingFunction: EASE_OUT,
                                      }
                                }
                                onPointerDown={(event) =>
                                  onGripPointerDown(event, visual)
                                }
                              >
                                <SfSymbol
                                  name="grip-vertical"
                                  className="size-5"
                                  style={{ color: ICON }}
                                />
                              </span>
                            ) : null}
                            <span
                              className="min-w-0 truncate text-[15px] leading-[20px]"
                              style={{ color: ICON }}
                            >
                              {segment.caption}
                            </span>
                          </span>
                          {onEditCurve ? (
                            <FieldButton
                              label={tx(PANEL_COPY.editCurve, locale)}
                              onClick={() => onEditCurve(index)}
                            >
                              <SfSymbol name="spline" className="size-5" />
                            </FieldButton>
                          ) : null}
                          <NumberField
                            ariaLabel={`${segment.caption} (${unit})`}
                            max={segment.max}
                            min={min}
                            onCommit={(next) => applyDuration(index, next)}
                            step={step}
                            unit={unit}
                            value={Math.round(clip.duration)}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="relative min-w-0 flex-1">
                    <PhaseLanes
                      ariaLabel={tx(PANEL_COPY.playerPhases(label), locale)}
                      captions={false}
                      controller={controller}
                      locale={locale}
                      min={min}
                      onChange={onChange}
                      rowOrder={rowOrder}
                      segments={segments}
                      step={step}
                      total={total}
                      unit={unit}
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute top-0 z-20 w-[2px] -translate-x-1/2 bg-[color:var(--sp-knob-off)]"
                      style={{
                        left: trackMarkerLeft(state.q, LANE_PAD_PX),
                        height: "100%",
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            </div>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}

/** Wire a `PlayerSetting` to `SettingsTimeline` — same keys the in-panel player writes. */
export function timelinePropsFromPlayer<TSettings>(
  player: PlayerSetting<TSettings>,
  settings: TSettings,
  locale: PanelLocale,
): {
  label: string;
  total: number;
  segments: PlayerSegment[];
  min?: number;
  step?: number;
  unit?: string;
  controller: PlayerController;
} {
  return {
    label: tx(player.label, locale),
    total: Number(settings[player.totalKey]),
    min: player.min,
    step: player.step,
    unit: player.unit,
    controller: player.controller,
    segments: player.phases.map((phase) => ({
      id: String(phase.key),
      caption: tx(phase.caption, locale),
      kind: phase.kind,
      max: phase.max,
      value: Number(settings[phase.key]),
      start:
        phase.startKey != null ? Number(settings[phase.startKey]) : undefined,
    })),
  };
}
