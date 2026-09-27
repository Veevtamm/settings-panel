"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  autoTotal,
  fitClipsToTotal,
  isTotalAuto,
  layoutClips,
  resolveTotal,
  staggerSpan,
  TOTAL_AUTO,
  type ClipStagger,
} from "../lib/player-clips";
import {
  focusPanel,
  useDockSlot,
  usePanelLocale,
  usePanelTheme,
} from "../lib/panel-theme";
import { clampNumber, cn } from "../lib/utils";
import { usePrefersReducedMotion } from "../lib/prefers-reduced-motion";
import { SfSymbol } from "../sf-symbol";
import { RowLabel, useDeferredMount } from "./row";
import {
  DEFAULT_DOCK_CORNER,
  DIM,
  DOCK_BAR_H,
  DOCK_INSET,
  EASE_OUT,
  GAP_IN,
  GLASS,
  MUTED,
  PANEL_EXIT_MS,
  SUBSECTION_DRAG_PX,
  CHEVRON_MS,
  dockBarButtonClass,
  pointerHeld,
  type DockCorner,
} from "./chrome";
import { panelPopClassName, panelPopStyle } from "./motion-ui";
import {
  AutoNumberField,
  FieldButton,
  NumberField,
  ReadOnlyField,
  SettingEnumDropdown,
} from "./fields";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";
import { snapStep } from "./number";
import { PhaseLanes } from "./phase-lanes";
import {
  LANE_PAD_PX,
  PlayerTrack,
  TransportRow,
  emitClips,
  inputsOf,
  patchPlayerClips,
  playerSegments,
  segmentSpanMax,
  trackMarkerLeft,
  usePlayerOpen,
  usePlayerState,
  type PlayerClipsChange,
  type PlayerSegment,
} from "./player";
import type {
  PlayerController,
  PlayerSetting,
  TimelineTarget,
} from "./types";
import { useChromeVisible, useViewportHeight } from "./use-chrome-visible";

/** Inspector = panel row width: label + curve 28 + field 86 without truncating phase names. */
const INSPECTOR = 328;
/** Cap so an ultrawide does not stretch clips across the whole screen. */
const TIMELINE_WIDTH_MAX = 1600;
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

/** ms: tick 100 / label 500. Other units (vh): tick 10 / label 50 — a 400 vh pin reads 0 · 50 · 100 … 400. */
function rulerGrid(unit: string) {
  return unit === "ms" ? { step: 100, majorEvery: 500 } : { step: 10, majorEvery: 50 };
}

function rulerMarks(total: number, unit: string) {
  const { step, majorEvery } = rulerGrid(unit);
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

/** Dock Bar slot from `${layoutPanelId ?? panelId}:panel-settings`. */
export { useDockSlot } from "../lib/panel-theme";

export function SettingsTimelineDockButton({
  controller,
  locale = "ru",
  className,
}: {
  controller: PlayerController;
  locale?: PanelLocale;
  className?: string;
}) {
  const open = usePlayerOpen(controller);
  return (
    <TimelineToggleButton
      open={open}
      onToggle={() => controller.setOpen(!open)}
      locale={locale}
      className={className}
    />
  );
}

/** Dock button 34 `timer` ↔ `x` — under the gear of `SettingsPanel` or standalone. */
export function TimelineToggleButton({
  open,
  onToggle,
  locale = "ru",
  className,
}: {
  open: boolean;
  onToggle: () => void;
  locale?: PanelLocale;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={open}
      aria-label={tx(
        open ? PANEL_COPY.closeTimeline : PANEL_COPY.openTimeline,
        locale,
      )}
      onClick={onToggle}
      className={cn(dockBarButtonClass(open), className)}
    >
      <SfSymbol name="timer" />
    </button>
  );
}

type TimelineDockShared = {
  panelId?: string;
  layoutPanelId?: string;
  locale?: PanelLocale;
  dockCorner?: DockCorner;
  /** Own timer 34 under the gear. `false` next to `SettingsPanel` with `players` — the panel draws the timer in its dock column. */
  showDockButton?: boolean;
  /** B5: unmount the dock. */
  enabled?: boolean;
  /** B5: hide when viewport is narrower (px). */
  hideBelow?: number;
};

/** One player, keys already resolved (`timelinePropsFromPlayer`). */
export type SettingsTimelineSingleProps = TimelineDockShared & {
  label: string;
  segments: readonly PlayerSegment[];
  total: number;
  /** Row label for `total`; omit = «Время анимации». */
  totalLabel?: string;
  /** A4: stored `total` ≤ 0 shows «Auto»; length = max(clip end). */
  totalAuto?: boolean;
  min?: number;
  step?: number;
  unit?: string;
  controller: PlayerController;
  onChange: (next: PlayerClipsChange) => void;
  onEditCurve?: (phase: number) => void;
  /** Live `total` / clips vs these — reset dots like ⌘M rows. */
  defaults?: {
    total: number;
    segments: readonly { value: number; start?: number; stagger?: ClipStagger }[];
  };
  targets?: undefined;
};

/** Several animations on one dock — each with its own store (F1). */
export type SettingsTimelineTargetsProps = TimelineDockShared & {
  targets: readonly TimelineTarget[];
  /**
   * Scene hook when the Animation row picks another player (route, park the
   * previous intro). The dock already closed the previous controller and will
   * reopen the next one if the previous was open.
   */
  onActivate?: (id: string, previousId: string) => void;
};

export type SettingsTimelineProps =
  | SettingsTimelineSingleProps
  | SettingsTimelineTargetsProps;

function useDockLocale(panelId: string | undefined, localeProp: PanelLocale) {
  const storedLocale = usePanelLocale(panelId ?? "__timeline__");
  return panelId ? storedLocale : localeProp;
}

type TimelineDockProps = Omit<SettingsTimelineSingleProps, "targets"> & {
  /** Animation row (Figma `ex / Dropdown`), only with several players. */
  targetOptions?: readonly { id: string; label: string }[];
  onTargetChange?: (id: string) => void;
};

function TimelineDock(props: TimelineDockProps) {
  const {
    panelId,
    controller,
    locale: localeProp = "ru",
    dockCorner: dockCornerProp = DEFAULT_DOCK_CORNER,
    showDockButton = true,
    layoutPanelId,
  } = props;
  const chromeId = layoutPanelId ?? panelId;
  const theme = usePanelTheme(chromeId ?? "__timeline__");
  const locale = useDockLocale(chromeId, localeProp);
  const dockCorner = useDockSlot(panelId, layoutPanelId, dockCornerProp);
  const open = usePlayerOpen(controller);
  const reduceMotion = usePrefersReducedMotion();
  const [hydrated, setHydrated] = useState(false);
  const surfaceMounted = useDeferredMount(open, reduceMotion, PANEL_EXIT_MS);
  useEffect(() => {
    setHydrated(true);
  }, []);
  if (!hydrated) return null;

  const dockBottom = dockCorner.startsWith("bottom");
  const dockRight = dockCorner.endsWith("right");
  const dockCenter = dockCorner.endsWith("center");

  return createPortal(
    <>
      {showDockButton ? (
        <div
          data-settings-panel=""
          data-panel-theme={theme}
          className="fixed z-[100]"
          style={{
            left: dockRight ? undefined : dockCenter ? "50%" : DOCK_INSET,
            right: dockRight ? DOCK_INSET : undefined,
            top: dockBottom ? undefined : DOCK_INSET,
            bottom: dockBottom ? DOCK_INSET : undefined,
            transform: dockCenter ? "translateX(-50%)" : undefined,
          }}
        >
          <SettingsTimelineDockButton controller={controller} locale={locale} />
        </div>
      ) : null}
      {surfaceMounted ? (
        <TimelineDockBody
          {...props}
          open={open}
          reduceMotion={reduceMotion}
          theme={theme}
          locale={locale}
          dockCorner={dockCorner}
        />
      ) : null}
    </>,
    document.body,
  );
}

function TimelineDockBody({
  panelId,
  label,
  segments,
  total,
  totalLabel,
  totalAuto = false,
  min = 10,
  step = 10,
  unit = "ms",
  controller,
  onChange,
  locale,
  onEditCurve,
  targetOptions,
  onTargetChange,
  defaults,
  theme,
  dockCorner,
  open,
  reduceMotion,
}: TimelineDockProps & {
  theme: string;
  locale: PanelLocale;
  dockCorner: DockCorner;
  open: boolean;
  reduceMotion: boolean;
}) {
  const state = usePlayerState(controller);
  const layout = layoutClips(inputsOf(segments));
  const defaultLayout = defaults
    ? layoutClips(inputsOf(defaults.segments))
    : undefined;
  const auto = totalAuto && isTotalAuto(total);
  const scale = resolveTotal(total, layout, min, totalAuto);
  const maxTotal = Math.max(
    scale,
    segments.reduce((sum, segment) => sum + segmentSpanMax(segment), 0),
  );
  const [elementsOpen, setElementsOpen] = useState(false);
  /** Staggered phases whose lines are folded; unfolded by default. */
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set());
  const [view, setView] = useState<{ start: number; end: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const minRef = useRef(min);
  minRef.current = min;
  const viewportH = useViewportHeight();
  const barRoom = dockCorner.startsWith("bottom") ? DOCK_BAR_H + GAP_IN : 0;
  const lanesMaxPx = Math.max(
    ELEMENT_ROW_PX * 3,
    viewportH - DOCK_INSET * 2 - barRoom - 168,
  );
  const viewStart = view?.start ?? 0;
  const viewEnd = view?.end ?? scale;
  const viewSpan = Math.max(viewEnd - viewStart, min);
  const scaleRootRef = useRef<HTMLDivElement>(null);
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
      if (!pointerHeld(event)) {
        onUp(event);
        return;
      }
      if (
        !drag.moved &&
        Math.abs(event.clientY - drag.startY) < SUBSECTION_DRAG_PX
      ) {
        return;
      }
      drag.moved = true;
      const list = rowsRef.current;
      if (!list) return;
      if (orderIdsRef.current.length < 2) return;
      /** Row groups differ in height (staggered lines), so count midpoints above the pointer. */
      const target = Array.from(list.children).filter((child, visual) => {
        if (visual === drag.visual) return false;
        const rect = child.getBoundingClientRect();
        return rect.top + rect.height / 2 < event.clientY;
      }).length;
      if (target === drag.visual) return;
      const next = [...orderIdsRef.current];
      const [moved] = next.splice(drag.visual, 1);
      if (moved == null) return;
      next.splice(target, 0, moved);
      drag.visual = target;
      setDragVisual(target);
      setOrderIds(next);
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      if (panelId && drag.moved) {
        writeTimelineOrder(panelId, controller.id, orderIdsRef.current);
      }
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
    setView((prev) => {
      if (prev == null) return prev;
      const start = clampNumber(prev.start, 0, Math.max(0, scale - min));
      const end = clampNumber(prev.end, start + min, scale);
      if (start <= 0 && end >= scale) return null;
      if (start === prev.start && end === prev.end) return prev;
      return { start, end };
    });
  }, [scale, min]);

  useEffect(() => {
    const root = scaleRootRef.current;
    if (!root) return;
    const onWheel = (event: WheelEvent) => {
      const scaleEl = (event.target as HTMLElement | null)?.closest(
        "[data-timeline-scale]",
      );
      if (!scaleEl || !root.contains(scaleEl)) return;
      event.preventDefault();
      const scaleNow = scaleRef.current;
      const minNow = minRef.current;
      const viewNow = viewRef.current;
      const rect = scaleEl.getBoundingClientRect();
      const x = clampNumber(event.clientX - rect.left, 0, rect.width);
      const start = viewNow?.start ?? 0;
      const end = viewNow?.end ?? scaleNow;
      const span = Math.max(end - start, minNow);
      const at = start + (x / Math.max(rect.width, 1)) * span;
      if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        const delta =
          ((event.shiftKey ? event.deltaY : event.deltaX) /
            Math.max(rect.width, 1)) *
          span;
        let nextStart = start + delta;
        let nextEnd = end + delta;
        if (nextStart < 0) {
          nextEnd -= nextStart;
          nextStart = 0;
        }
        if (nextEnd > scaleNow) {
          nextStart -= nextEnd - scaleNow;
          nextEnd = scaleNow;
        }
        nextStart = clampNumber(nextStart, 0, Math.max(0, scaleNow - minNow));
        nextEnd = clampNumber(nextEnd, nextStart + minNow, scaleNow);
        setView(
          nextStart <= 0 && nextEnd >= scaleNow
            ? null
            : { start: nextStart, end: nextEnd },
        );
        return;
      }
      const factor = event.deltaY < 0 ? 0.85 : 1.18;
      const nextSpan = clampNumber(span * factor, minNow, scaleNow);
      let nextStart = at - ((at - start) / span) * nextSpan;
      let nextEnd = nextStart + nextSpan;
      if (nextStart < 0) {
        nextEnd -= nextStart;
        nextStart = 0;
      }
      if (nextEnd > scaleNow) {
        nextStart -= nextEnd - scaleNow;
        nextEnd = scaleNow;
      }
      setView(
        nextStart <= 0 && nextEnd >= scaleNow
          ? null
          : { start: nextStart, end: nextEnd },
      );
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, []);

  function applyTotal(nextTotal: number) {
    const clamped = clampNumber(snapStep(nextTotal, step), min, maxTotal);
    onChange(
      emitClips(fitClipsToTotal(layout, clamped, min), clamped, segments),
    );
  }

  function unlockTotal() {
    applyTotal(autoTotal(layout, min));
  }

  /** `next` = clip duration, or one line's duration for a staggered phase. */
  function applyDuration(index: number, next: number) {
    const clip = layout[index];
    const segment = segments[index];
    if (!clip || !segment) return;
    const offsets = staggerSpan(0, segment.stagger);
    const line = clampNumber(
      snapStep(next, step),
      min,
      auto
        ? segment.max
        : Math.max(min, Math.min(segment.max, scale - clip.start - offsets)),
    );
    const duration = line + offsets;
    const nextLayout = layout.map((item, i) =>
      i === index
        ? { ...item, duration, packed: false, end: item.start + duration }
        : item,
    );
    onChange(emitClips(nextLayout, auto ? TOTAL_AUTO : total, segments));
  }

  /** E1: offset between lines; the parent clip grows or shrinks with it. */
  function applyStep(index: number, next: number) {
    const clip = layout[index];
    const segment = segments[index];
    const stagger = segment?.stagger;
    if (!clip || !stagger || stagger.count < 2) return;
    const gaps = stagger.count - 1;
    const room = auto
      ? stagger.stepMax
      : Math.floor((scale - clip.start - segment.value) / gaps / step) * step;
    const nextStep = clampNumber(
      snapStep(next, step),
      0,
      Math.max(0, Math.min(stagger.stepMax, room)),
    );
    const duration = segment.value + gaps * nextStep;
    const steps = segments.map((item) => item.stagger?.step);
    steps[index] = nextStep;
    onChange(
      emitClips(
        layout.map((item, i) =>
          i === index ? { ...item, duration, end: item.start + duration } : item,
        ),
        auto ? TOTAL_AUTO : total,
        segments,
        steps,
      ),
    );
  }

  function resetTotal() {
    if (defaults == null) return;
    if (totalAuto && isTotalAuto(defaults.total)) {
      onChange(emitClips(layout, TOTAL_AUTO, segments));
      return;
    }
    applyTotal(defaults.total);
  }

  /** Clip back to its default place, length and stagger step (reset dot, C2 ghost). */
  function resetPhase(index: number) {
    const fallback = defaultLayout?.[index];
    if (!fallback) return;
    const steps = segments.map((item) => item.stagger?.step);
    steps[index] = defaults?.segments[index]?.stagger?.step ?? steps[index];
    onChange(
      emitClips(
        layout.map((item, i) => (i === index ? { ...fallback } : item)),
        auto ? TOTAL_AUTO : total,
        segments,
        steps,
      ),
    );
  }

  function toggleLines(index: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const totalModified = defaults != null && defaults.total !== total;

  const phasesTitle = tx(PANEL_COPY.phases, locale);
  const marks = rulerMarks(scale, unit).filter(
    (mark) => mark.ms >= viewStart - 0.5 && mark.ms <= viewEnd + 0.5,
  );
  const playheadViewQ =
    viewSpan > 0 ? (state.q * scale - viewStart) / viewSpan : 0;

  function resetView() {
    setView(null);
  }
  const glassPad = DOCK_INSET;
  const targetDropdown = (
    <SettingEnumDropdown
      label={tx(PANEL_COPY.timelineTarget, locale)}
      locale={locale}
      onChange={(id) => onTargetChange?.(id)}
      options={(targetOptions ?? [{ id: controller.id, label }]).map(
        (target) => ({
          value: target.id,
          label: target.label,
        }),
      )}
      reduceMotion={reduceMotion}
      value={controller.id}
      overlay
    />
  );
  const totalTitle = totalLabel ?? tx(PANEL_COPY.animationTime, locale);

  return (
        <div
          ref={scaleRootRef}
          data-settings-panel=""
          data-settings-timeline=""
          data-panel-theme={theme}
          role="region"
          aria-label={tx(PANEL_COPY.openTimeline, locale)}
          className={cn(
            "fixed z-[100] origin-bottom overflow-hidden rounded-lg border border-[color:var(--sp-line)] font-sans backdrop-blur-[8px]",
            panelPopClassName({
              open,
              fromBottom: true,
              skip: reduceMotion,
            }),
          )}
          aria-hidden={!open}
          inert={open ? undefined : true}
          style={{
            background: GLASS,
            left: glassPad,
            right: glassPad,
            bottom: glassPad + barRoom,
            width: "auto",
            maxWidth: TIMELINE_WIDTH_MAX,
            maxHeight: viewportH - DOCK_INSET * 2,
            marginInline: "auto",
            ...panelPopStyle({ open, skip: reduceMotion }),
          }}
        >
          <div className="flex flex-col gap-2 py-2 pl-3 pr-2">
            <div className="flex items-start gap-2">
              <div className="shrink-0" style={{ width: INSPECTOR }}>
                {(targetOptions?.length ?? 0) > 1 ? targetDropdown : null}
              </div>
              <div className="min-w-0 flex-1">
                <TransportRow
                  controller={controller}
                  label={label}
                  locale={locale}
                  segments={segments}
                  state={state}
                  total={scale}
                  unit={unit}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div
                className="flex h-[28px] shrink-0 items-center justify-between gap-2"
                style={{ width: INSPECTOR }}
              >
                <RowLabel
                  label={totalTitle}
                  locale={locale}
                  tone="main"
                  modified={totalModified}
                  onResetValue={totalModified ? resetTotal : undefined}
                />
                {auto ? (
                  <AutoNumberField
                    ariaLabel={tx(PANEL_COPY.unlockTotal, locale)}
                    label={tx(PANEL_COPY.totalAuto, locale)}
                    onUnlock={unlockTotal}
                  />
                ) : (
                  <NumberField
                    ariaLabel={totalTitle}
                    max={maxTotal}
                    min={min}
                    onCommit={applyTotal}
                    step={step}
                    unit={unit}
                    value={scale}
                  />
                )}
              </div>
              <div
                className="min-w-0 flex-1"
                data-timeline-scale=""
                onDoubleClick={resetView}
              >
                <PlayerTrack
                  ariaLabel={tx(PANEL_COPY.playerPosition(label), locale)}
                  controller={controller}
                  state={state}
                  total={scale}
                  unit={unit}
                  viewStart={viewStart}
                  viewEnd={viewEnd}
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
                  <span
                    className="truncate text-[15px] leading-[20px]"
                    style={{ color: MUTED }}
                  >
                    {phasesTitle}
                  </span>
                  <SfSymbol
                    name="chevron-up"
                    className={cn("size-5", !elementsOpen && "rotate-180")}
                    style={{ color: MUTED }}
                  />
                </button>
                <div
                  className="relative h-5 min-w-0 flex-1"
                  data-timeline-scale=""
                  onDoubleClick={resetView}
                >
                  {marks.map(({ ms, major }) => {
                    const q = viewSpan > 0 ? (ms - viewStart) / viewSpan : 0;
                    const edge =
                      ms <= viewStart + 0.5
                        ? "start"
                        : ms >= viewEnd - 0.5
                          ? "end"
                          : "mid";
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
                <div
                  className="flex items-start gap-2 overflow-y-auto overscroll-y-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  style={{ maxHeight: lanesMaxPx }}
                >
                  <div
                    ref={rowsRef}
                    className="flex shrink-0 flex-col gap-1"
                    style={{ width: INSPECTOR }}
                  >
                    {rowOrder.map((index, visual) => {
                      const segment = segments[index];
                      const clip = layout[index];
                      if (!segment || !clip) return null;
                      const baseline = defaultLayout?.[index];
                      const baseSegment = defaults?.segments[index];
                      const phaseModified =
                        baseline != null &&
                        (clip.start !== baseline.start ||
                          clip.duration !== baseline.duration ||
                          segment.value !== baseSegment?.value);
                      const stagger =
                        segment.stagger != null && segment.stagger.count > 1
                          ? segment.stagger
                          : undefined;
                      const linesOpen = stagger != null && !collapsed.has(index);
                      const childClass = "flex h-[28px] items-center gap-2 pl-7";
                      const lineField = (
                        <NumberField
                          ariaLabel={`${segment.caption} (${unit})`}
                          max={segment.max}
                          min={min}
                          onCommit={(next) => applyDuration(index, next)}
                          step={step}
                          unit={unit}
                          value={Math.round(segment.value)}
                        />
                      );
                      return (
                        <div
                          key={segmentId(segment, index)}
                          className="flex flex-col gap-1"
                        >
                          <div className="group/el flex h-[28px] items-center gap-2">
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
                                    style={{ color: MUTED }}
                                  />
                                </span>
                              ) : null}
                              {stagger ? (
                                <button
                                  type="button"
                                  aria-expanded={linesOpen}
                                  aria-label={tx(
                                    linesOpen
                                      ? PANEL_COPY.collapse(segment.caption)
                                      : PANEL_COPY.expand(segment.caption),
                                    locale,
                                  )}
                                  onClick={() => toggleLines(index)}
                                  className="mr-1 inline-flex size-5 shrink-0 items-center justify-center outline-none"
                                >
                                  <SfSymbol
                                    name="chevron-up"
                                    className={cn("size-5", !linesOpen && "rotate-180")}
                                    style={{ color: MUTED }}
                                  />
                                </button>
                              ) : null}
                              <RowLabel
                                className="min-w-0"
                                label={segment.caption}
                                locale={locale}
                                tone="main"
                                modified={phaseModified}
                                onResetValue={
                                  phaseModified
                                    ? () => resetPhase(index)
                                    : undefined
                                }
                              />
                            </span>
                            {onEditCurve ? (
                              <FieldButton
                                label={tx(PANEL_COPY.editCurve, locale)}
                                onClick={() => onEditCurve(index)}
                              >
                                <SfSymbol name="spline" className="size-5" />
                              </FieldButton>
                            ) : null}
                            {stagger ? (
                              <ReadOnlyField
                                ariaLabel={`${segment.caption} (${unit})`}
                                label={String(Math.round(clip.duration))}
                                unit={unit}
                              />
                            ) : (
                              lineField
                            )}
                          </div>
                          {stagger && linesOpen ? (
                            <>
                              {Array.from({ length: stagger.count }, (_, k) => (
                                <div key={k} className={childClass}>
                                  <span
                                    className="min-w-0 flex-1 truncate text-[15px] leading-[20px]"
                                    style={{ color: DIM }}
                                  >
                                    {`${stagger.caption} ${k + 1}`}
                                  </span>
                                  {lineField}
                                </div>
                              ))}
                              <div className={childClass}>
                                <RowLabel
                                  className="min-w-0 flex-1"
                                  label={tx(PANEL_COPY.staggerStep, locale)}
                                  locale={locale}
                                  tone="main"
                                />
                                <NumberField
                                  ariaLabel={`${segment.caption}: ${tx(PANEL_COPY.staggerStep, locale)} (${unit})`}
                                  max={stagger.stepMax}
                                  min={0}
                                  onCommit={(next) => applyStep(index, next)}
                                  step={step}
                                  unit={unit}
                                  value={Math.round(stagger.step)}
                                />
                              </div>
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <div
                    className="relative min-w-0 flex-1 overflow-hidden"
                    data-timeline-scale=""
                    onDoubleClick={resetView}
                  >
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
                      stretch={auto}
                      total={scale}
                      unit={unit}
                      viewStart={viewStart}
                      viewEnd={viewEnd}
                      defaults={defaultLayout}
                      onResetPhase={resetPhase}
                      collapsed={collapsed}
                      stepRows
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute top-0 z-20 w-[2px] -translate-x-1/2 bg-[color:var(--sp-knob-off)]"
                      style={{
                        left: trackMarkerLeft(playheadViewQ, LANE_PAD_PX),
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
  );
}

function targetId(target: TimelineTarget) {
  return target.player.controller.id;
}

/** Several players, one dock: the active target's store is what the clips write. */
function TimelineTargets({
  targets,
  onActivate,
  panelId,
  locale: localeProp = "ru",
  ...shared
}: SettingsTimelineTargetsProps) {
  const locale = useDockLocale(shared.layoutPanelId ?? panelId, localeProp);
  const [activeId, setActiveId] = useState<string>(() => {
    const open = targets.find((target) => target.player.controller.getState().open);
    return targetId(open ?? targets[0]);
  });
  const active =
    targets.find((target) => targetId(target) === activeId) ?? targets[0];

  /** The scene opened another player (HUD, `?moment=`) — follow it. */
  useEffect(() => {
    const offs = targets.map((target) =>
      target.player.controller.subscribe((state) => {
        if (state.open) setActiveId(targetId(target));
      }),
    );
    return () => {
      for (const off of offs) off();
    };
  }, [targets]);

  if (!active) return null;

  function switchTo(id: string) {
    const next = targets.find((target) => targetId(target) === id);
    if (!next || next === active) return;
    const wasOpen = active.player.controller.getState().open;
    if (wasOpen) active.player.controller.setOpen(false);
    onActivate?.(id, targetId(active));
    setActiveId(id);
    if (wasOpen) next.player.controller.setOpen(true);
  }

  const props = timelinePropsFromPlayer(
    active.player,
    active.settings,
    locale,
    active.defaultSettings,
  );
  const editCurve =
    active.onEditCurve ??
    (active.easingIds && panelId
      ? (phase: number) => {
          const easingId = active.easingIds?.[phase];
          if (easingId) focusPanel(panelId, { easingId });
        }
      : undefined);

  return (
    <TimelineDock
      key={targetId(active)}
      {...shared}
      {...props}
      panelId={panelId}
      locale={locale}
      onChange={(next) =>
        active.onSettingsChange(patchPlayerClips(active.player, next))
      }
      onEditCurve={editCurve}
      targetOptions={targets.map((target) => ({
        id: targetId(target),
        label: tx(target.player.label, locale),
      }))}
      onTargetChange={switchTo}
    />
  );
}

/**
 * Bottom dock (Tools `07 Timeline`). Either one resolved player
 * (`timelinePropsFromPlayer` + `onChange`) or `targets` — several players,
 * each with its own store; the dock switches between them (F1).
 */
export function SettingsTimeline(props: SettingsTimelineProps) {
  const visible = useChromeVisible(props.enabled ?? true, props.hideBelow);
  if (!visible) return null;
  if (props.targets != null) return <TimelineTargets {...props} />;
  return <TimelineDock {...props} />;
}

/**
 * Wire a `PlayerSetting` to `SettingsTimeline`.
 * `total` is the **stored** `totalKey` (0 when Auto). The dock / HUD length is
 * `resolvePlayerTotal` — do not feed this `total` into WAAPI as duration.
 */
export function timelinePropsFromPlayer<TSettings>(
  player: PlayerSetting<TSettings>,
  settings: TSettings,
  locale: PanelLocale,
  defaultSettings?: TSettings,
): {
  label: string;
  total: number;
  totalLabel?: string;
  totalAuto?: boolean;
  segments: PlayerSegment[];
  min?: number;
  step?: number;
  unit?: string;
  controller: PlayerController;
  defaults?: {
    total: number;
    segments: PlayerSegment[];
  };
} {
  const segments = playerSegments(player, settings, locale);
  return {
    label: tx(player.label, locale),
    total: Number(settings[player.totalKey]),
    totalLabel:
      player.totalLabel != null ? tx(player.totalLabel, locale) : undefined,
    totalAuto: player.totalAuto,
    min: player.min,
    step: player.step,
    unit: player.unit,
    controller: player.controller,
    segments,
    defaults:
      defaultSettings == null
        ? undefined
        : {
            total: Number(defaultSettings[player.totalKey]),
            segments: playerSegments(player, defaultSettings, locale),
          },
  };
}
