"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  autoTotal,
  fitClipsToTotal,
  isTotalAuto,
  spaceClipStarts,
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
  usePanelFont,
} from "../lib/panel-theme";
import { parseBezierInput, type CubicBezier } from "../lib/cubic-bezier";
import { savedCurveExtras } from "../lib/curve-library";
import {
  easingForPreset,
  easingPresetSections,
  matchEasingPreset,
} from "../lib/easing-presets";
import {
  applyTreeDrop,
  sameTimelineTree,
  treeDropSlot,
  type TreeDropRow,
} from "../lib/timeline-tree";
import { clampNumber, cn } from "../lib/utils";
import { usePrefersReducedMotion } from "../lib/prefers-reduced-motion";
import { SfSymbol } from "../sf-symbol";
import { RowLabel, useDeferredMount } from "./row";
import {
  DEFAULT_DOCK_CORNER,
  DIM,
  DOCK_BAR_H,
  DOCK_DRAG_PX,
  DOCK_INSET,
  GAP_IN,
  bindPointerDrag,
  GLASS,
  MUTED,
  PANEL_EXIT_MS,
  dockBarButtonClass,
  type DockCorner,
} from "./chrome";
import { panelPopClassName, panelPopStyle } from "./motion-ui";
import {
  AutoNumberField,
  NumberField,
  ReadOnlyField,
  SettingEnumDropdown,
} from "./fields";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";
import { DockBarTips } from "./dock";
import { snapStep } from "./number";
import { PhaseLanes, clipMenuFromPointer, sameLaneHover, type ClipMenuRequest, type LaneHover } from "./phase-lanes";
import { useCurveLibrary } from "./use-curve-library";
import { recordPanelChange } from "./use-history";
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

/** Inspector = panel row width: label + field 86 without truncating phase names. */
const INSPECTOR = 328;
/** Hover pill starts 6px left of the column so the label sits 12px from the glass edge. */
const ROW_EDGE = 6;
const inspectorBleed = { width: INSPECTOR + ROW_EDGE, marginLeft: -ROW_EDGE };
/** Inspector field row. No grip: the row itself drags. Hover fills it with `row-hover`. */
const TIMELINE_ROW_HOVER =
  "rounded-[4px] transition-colors duration-150 fine-hover:hover:bg-[color:var(--sp-row-hover)]";
/** One nest step past the 6px row padding. */
const NEST_PAD = ["pl-[6px]", "pl-[18px]", "pl-[30px]"] as const;
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

type ClipGroup = { id: string; name: string; keys: string[] };
type GroupFile = { groups: ClipGroup[]; names: Record<string, string> };

function emptyGroupFile(): GroupFile {
  return { groups: [], names: {} };
}

function readGroupFile(panelId: string, playerId: string): GroupFile {
  try {
    const raw = localStorage.getItem(`${panelId}:timeline-groups`);
    if (!raw) return emptyGroupFile();
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return emptyGroupFile();
    }
    const slot = (parsed as Record<string, unknown>)[playerId];
    if (!slot || typeof slot !== "object" || Array.isArray(slot)) return emptyGroupFile();
    const groups = Array.isArray((slot as { groups?: unknown }).groups)
      ? (slot as { groups: unknown[] }).groups.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const group = item as { id?: unknown; name?: unknown; keys?: unknown };
          if (
            typeof group.id !== "string" ||
            typeof group.name !== "string" ||
            !Array.isArray(group.keys)
          ) {
            return [];
          }
          const keys = group.keys.filter((key): key is string => typeof key === "string");
          return keys.length >= 2 ? [{ id: group.id, name: group.name, keys }] : [];
        })
      : [];
    const names: Record<string, string> = {};
    const rawNames = (slot as { names?: unknown }).names;
    if (rawNames && typeof rawNames === "object" && !Array.isArray(rawNames)) {
      for (const [key, value] of Object.entries(rawNames)) {
        if (typeof value === "string" && value.trim()) names[key] = value;
      }
    }
    return { groups, names };
  } catch {
    return emptyGroupFile();
  }
}

function writeGroupFile(panelId: string, playerId: string, file: GroupFile) {
  try {
    const raw = localStorage.getItem(`${panelId}:timeline-groups`);
    const parsed = raw != null ? (JSON.parse(raw) as unknown) : {};
    const store =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? { ...(parsed as Record<string, GroupFile>) }
        : {};
    store[playerId] = file;
    localStorage.setItem(`${panelId}:timeline-groups`, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

/** One inspector row per phase, or one row for a whole user group (header + members). */
function orderUnits(
  order: readonly string[],
  groups: readonly { keys: readonly string[] }[],
) {
  const seen = new Set<string>();
  const units: string[][] = [];
  for (const id of order) {
    if (seen.has(id)) continue;
    const group = groups.find((item) => item.keys.includes(id));
    if (group) {
      const ids = order.filter((key) => group.keys.includes(key));
      for (const key of ids) seen.add(key);
      units.push(ids);
    } else {
      seen.add(id);
      units.push([id]);
    }
  }
  return units;
}

function clusterIds(order: readonly string[], block: readonly string[]) {
  const member = new Set(block);
  const without = order.filter((id) => !member.has(id));
  const at = order
    .slice(0, Math.max(0, order.findIndex((id) => member.has(id))))
    .filter((id) => !member.has(id)).length;
  const sorted = [...block].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  without.splice(at, 0, ...sorted);
  return without;
}

function freshGroupName(groups: readonly { name: string }[], locale: PanelLocale) {
  const base = tx(PANEL_COPY.clipGroup, locale);
  const taken = new Set(groups.map((group) => group.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

function readInspectorRows(root: HTMLElement): TreeDropRow[] {
  return [...root.querySelectorAll<HTMLElement>("[data-tl-slot]")].flatMap((node) => {
    const id = node.dataset.tlId ?? "";
    if (!id) return [];
    const box = node.getBoundingClientRect();
    const keys = node.dataset.tlKeys?.split(",").filter(Boolean);
    return [
      {
        kind: node.dataset.tlKind === "group" ? "group" : "phase",
        id,
        parentGroupId: node.dataset.tlParent || null,
        top: box.top,
        bottom: box.bottom,
        keys,
      } satisfies TreeDropRow,
    ];
  });
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
      data-dock-tip={tx(PANEL_COPY.dockTimeline, locale)}
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
  /** Timeline row (Figma `ex / Dropdown`) when there is more than one player. */
  targetOptions?: readonly { id: string; label: string }[];
  onTargetChange?: (id: string) => void;
  curveOptions?: readonly { id: string; label: string }[];
  curveSections?: readonly {
    title: string;
    options: readonly { id: string; label: string }[];
  }[];
  curveValue?: (phase: number) => string | undefined;
  onPickCurve?: (indices: number[], presetId: string) => void;
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
  const font = usePanelFont(chromeId ?? "__timeline__");
  const locale = useDockLocale(chromeId, localeProp);
  const dockCorner = useDockSlot(panelId, layoutPanelId, dockCornerProp);
  const open = usePlayerOpen(controller);
  const reduceMotion = usePrefersReducedMotion();
  const dockBtnRef = useRef<HTMLDivElement>(null);
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
          ref={dockBtnRef}
          data-settings-panel=""
          data-panel-theme={theme}
          data-panel-font={font}
          data-dock-bar=""
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
          <DockBarTips
            barRef={dockBtnRef}
            side={dockBottom ? "above" : "below"}
          />
        </div>
      ) : null}
      {surfaceMounted ? (
        <TimelineDockBody
          {...props}
          open={open}
          reduceMotion={reduceMotion}
          theme={theme}
          font={font}
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
  curveOptions,
  curveSections,
  curveValue,
  onPickCurve,
  targetOptions,
  onTargetChange,
  defaults,
  theme,
  font,
  dockCorner,
  open,
  reduceMotion,
}: TimelineDockProps & {
  theme: string;
  font: string;
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
  const [groupFile, setGroupFile] = useState<GroupFile>(() =>
    panelId ? readGroupFile(panelId, controller.id) : emptyGroupFile(),
  );
  const orderRef = useRef(orderIds);
  orderRef.current = orderIds;
  const groupsRef = useRef(groupFile.groups);
  groupsRef.current = groupFile.groups;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [foldedGroups, setFoldedGroups] = useState<ReadonlySet<string>>(() => new Set());
  const [laneHover, setLaneHover] = useState<LaneHover | null>(null);
  const [dropLine, setDropLine] = useState<{ top: number; left: number } | null>(null);
  const [lift, setLift] = useState<{
    className: string;
    html: string;
    width: number;
    height: number;
  } | null>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const liftRef = useRef<HTMLDivElement>(null);
  const liftRowRef = useRef<HTMLElement | null>(null);
  const liftPlaceRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(
    null,
  );
  const openClipMenu = useRef<((menu: ClipMenuRequest) => void) | null>(null);
  function hoverLane(next: LaneHover | null) {
    setLaneHover((prev) => (sameLaneHover(prev, next) ? prev : next));
  }
  function openRowMenu(
    event: {
      preventDefault(): void;
      stopPropagation(): void;
      clientX: number;
      clientY: number;
      currentTarget: Element;
    },
    phase: number,
    indices: number[],
  ) {
    event.preventDefault();
    event.stopPropagation();
    openClipMenu.current?.(clipMenuFromPointer(event, phase, indices));
  }
  useEffect(() => {
    if (!panelId) return;
    writeGroupFile(panelId, controller.id, groupFile);
  }, [panelId, controller.id, groupFile]);

  const idsKey = movableIds(segments).join("|");
  useEffect(() => {
    setOrderIds((prev) => mergeOrder(prev, idsKey.split("|").filter(Boolean)));
  }, [idsKey]);

  const rowOrder = indicesFor(segments, orderIds);
  const knownIds = new Set(movableIds(segments));
  const clipGroups = groupFile.groups
    .map((group) => ({
      ...group,
      keys: group.keys.filter((key) => knownIds.has(key)),
    }))
    .filter((group) => group.keys.length >= 2);
  const groupLeads = new Set<number>();
  for (const group of clipGroups) {
    const lead = rowOrder.find((index) =>
      group.keys.includes(segmentId(segments[index], index)),
    );
    if (lead != null) groupLeads.add(lead);
  }
  const units = orderUnits(orderIds, clipGroups);
  function phaseName(index: number) {
    const segment = segments[index];
    if (!segment) return "";
    return groupFile.names[segmentId(segment, index)] ?? segment.caption;
  }

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

  function commitGroupName(id: string, raw: string) {
    const name = raw.trim();
    setRenaming(null);
    if (!name) return;
    if (id.startsWith("phase:")) {
      const key = id.slice("phase:".length);
      setGroupFile((prev) => ({ ...prev, names: { ...prev.names, [key]: name } }));
      return;
    }
    setGroupFile((prev) => ({
      ...prev,
      groups: prev.groups.map((group) => (group.id === id ? { ...group, name } : group)),
    }));
  }

  function makeClipStep(indices: number[], gap: number) {
    const amount = Math.max(0, gap);
    if (indices.length === 1) {
      const index = indices[0];
      const segment = segments[index];
      const clip = layout[index];
      const stagger = segment?.stagger;
      if (segment && clip && stagger && stagger.count > 1) {
        const duration = Math.max(0, segment.value) + (stagger.count - 1) * amount;
        const nextLayout = layout.map((item, i) =>
          i === index
            ? { ...item, packed: false, duration, end: item.start + duration }
            : item,
        );
        const steps = segments.map((item, i) =>
          i === index ? amount : item.stagger?.step,
        );
        onChange(
          emitClips(nextLayout, auto ? TOTAL_AUTO : total, segments, steps),
        );
        return;
      }
    }
    onChange(
      emitClips(
        spaceClipStarts(layout, indices, amount, scale),
        auto ? TOTAL_AUTO : total,
        segments,
      ),
    );
  }

  function groupClips(indices: number[]) {
    const keys = [
      ...new Set(indices.map((index) => segmentId(segments[index], index))),
    ];
    if (keys.length < 2) return;
    const block = [...keys].sort((a, b) => orderIds.indexOf(a) - orderIds.indexOf(b));
    setGroupFile((prev) => ({
      ...prev,
      groups: [
        ...prev.groups
          .map((group) => ({
            ...group,
            keys: group.keys.filter((key) => !block.includes(key)),
          }))
          .filter((group) => group.keys.length >= 2),
        {
          id: `g${Math.random().toString(36).slice(2, 8)}`,
          name: freshGroupName(prev.groups, locale),
          keys: block,
        },
      ],
    }));
    setOrderIds((prev) => {
      const next = clusterIds(prev, block);
      if (panelId) writeTimelineOrder(panelId, controller.id, next);
      return next;
    });
  }

  function ungroupClips(indices: number[]) {
    const keys = new Set(indices.map((index) => segmentId(segments[index], index)));
    setGroupFile((prev) => ({
      ...prev,
      groups: prev.groups
        .map((group) => ({
          ...group,
          keys: group.keys.filter((key) => !keys.has(key)),
        }))
        .filter((group) => group.keys.length >= 2),
    }));
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

  function toggleGroup(id: string) {
    setFoldedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleLines(index: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function placeLift(x: number, y: number) {
    const place = liftPlaceRef.current;
    if (!place) return;
    place.x = x;
    place.y = y;
    const node = liftRef.current;
    if (!node) return;
    node.style.left = `${x - place.offsetX}px`;
    node.style.top = `${y - place.offsetY}px`;
  }

  useLayoutEffect(() => {
    const place = liftPlaceRef.current;
    if (!lift || !place) return;
    placeLift(place.x, place.y);
  }, [lift]);

  function clearLift() {
    const row = liftRowRef.current;
    if (row) delete row.dataset.tlLift;
    liftRowRef.current = null;
    liftPlaceRef.current = null;
    setLift(null);
  }

  function armRowDrag(event: ReactPointerEvent<HTMLElement>, ids: readonly string[]) {
    if (event.button !== 0 || ids.length === 0) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("input, textarea, button, a, label, [data-no-row-drag]")
    ) {
      return;
    }
    event.stopPropagation();
    const row = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    let slot: { parentGroupId: string | null; index: number } | null = null;
    bindPointerDrag(pointerId, {
      onMove(ev) {
        if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DOCK_DRAG_PX) {
          return;
        }
        const root = inspectorRef.current;
        if (!root) return;
        if (!moved) {
          moved = true;
          document.documentElement.dataset.phaseDrag = "grab";
          const rect = row.getBoundingClientRect();
          liftPlaceRef.current = {
            x: ev.clientX,
            y: ev.clientY,
            offsetX: ev.clientX - rect.left,
            offsetY: ev.clientY - rect.top,
          };
          liftRowRef.current = row;
          row.dataset.tlLift = "";
          setLift({
            className: row.className,
            html: row.innerHTML,
            width: rect.width,
            height: rect.height,
          });
        } else {
          placeLift(ev.clientX, ev.clientY);
        }
        const scroller = root.parentElement;
        if (scroller) {
          const view = scroller.getBoundingClientRect();
          if (ev.clientY < view.top + 24) scroller.scrollTop -= 12;
          else if (ev.clientY > view.bottom - 24) scroller.scrollTop += 12;
        }
        const rect = root.getBoundingClientRect();
        const hit = treeDropSlot(readInspectorRows(root), ids, {
          x: ev.clientX,
          y: ev.clientY,
          listLeft: rect.left,
        });
        const next =
          hit == null
            ? null
            : applyTreeDrop(orderRef.current, groupsRef.current, ids, hit);
        const changes =
          hit != null &&
          next != null &&
          !sameTimelineTree(orderRef.current, groupsRef.current, next);
        slot = changes && hit ? { parentGroupId: hit.parentGroupId, index: hit.index } : null;
        setDropLine(
          changes && hit
            ? { top: hit.lineY - rect.top, left: hit.depth === 0 ? 6 : 18 }
            : null,
        );
      },
      onEnd() {
        delete document.documentElement.dataset.phaseDrag;
        setDropLine(null);
        clearLift();
        if (!moved || !slot) return;
        const next = applyTreeDrop(orderRef.current, groupsRef.current, ids, slot);
        if (sameTimelineTree(orderRef.current, groupsRef.current, next)) return;
        setOrderIds(next.order);
        setGroupFile((prev) => ({ ...prev, groups: next.groups }));
        if (panelId) writeTimelineOrder(panelId, controller.id, next.order);
        const suppress = (click: MouseEvent) => {
          click.preventDefault();
          click.stopPropagation();
        };
        window.addEventListener("click", suppress, true);
        window.setTimeout(() => window.removeEventListener("click", suppress, true), 0);
      },
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
      icon="timer"
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
      <>
        <div
          ref={scaleRootRef}
          data-settings-panel=""
          data-settings-timeline=""
          data-panel-theme={theme}
          data-panel-font={font}
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
                {(targetOptions?.length ?? 0) > 1 ? (
                  targetDropdown
                ) : (
                  <div className="flex h-[28px] items-center">
                    <RowLabel
                      icon="timer"
                      label={tx(PANEL_COPY.timelineTarget, locale)}
                      locale={locale}
                      tone="main"
                    />
                  </div>
                )}
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
                className={cn(
                  "flex h-[28px] shrink-0 items-center justify-between gap-2 pl-[6px]",
                  TIMELINE_ROW_HOVER,
                )}
                style={inspectorBleed}
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
                  className={cn(
                    "flex h-[28px] shrink-0 items-center justify-between pl-[6px] outline-none",
                    TIMELINE_ROW_HOVER,
                  )}
                  style={inspectorBleed}
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
                    className="relative flex h-[28px] min-w-0 flex-1 items-center"
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
                              "absolute top-1 whitespace-nowrap font-mono text-[11px] leading-[14px] tabular-nums",
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
                            top: major ? 18 : 20,
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
                  style={{
                    maxHeight: lanesMaxPx,
                    marginLeft: -ROW_EDGE,
                    width: `calc(100% + ${ROW_EDGE}px)`,
                  }}
                >
                  <div
                    ref={inspectorRef}
                    className="relative flex shrink-0 flex-col gap-1"
                    style={{ width: INSPECTOR + ROW_EDGE }}
                  >
                    {dropLine ? (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute z-30 h-[2px] -translate-y-1/2 rounded-full bg-[color:var(--sp-fg)]"
                        style={{ top: dropLine.top, left: dropLine.left, right: 8 }}
                      />
                    ) : null}
                    {units.map((ids) => {
                      const indices = ids.flatMap((id) => {
                        const index = segments.findIndex(
                          (segment, i) => segmentId(segment, i) === id,
                        );
                        return index < 0 ? [] : [index];
                      });
                      const membership = clipGroups.find(
                        (group) =>
                          ids.length > 1 && ids.every((id) => group.keys.includes(id)),
                      );
                      const groupOpen =
                        membership == null || !foldedGroups.has(membership.id);
                      let spanMs = 0;
                      if (membership) {
                        let start = Infinity;
                        let end = -Infinity;
                        for (const index of indices) {
                          const clip = layout[index];
                          if (!clip) continue;
                          start = Math.min(start, clip.start);
                          end = Math.max(end, clip.end);
                        }
                        spanMs = Number.isFinite(start) ? Math.max(0, end - start) : 0;
                      }
                      return (
                        <div
                          key={membership?.id ?? ids[0]}
                          className="flex flex-col gap-1"
                        >
                          {membership ? (
                            <div
                              className={cn(
                                "flex h-[28px] cursor-pointer items-center gap-2 pl-[6px]",
                                TIMELINE_ROW_HOVER,
                                sameLaneHover(laneHover, { kind: "group", id: membership.id }) &&
                                  "bg-[color:var(--sp-row-hover)]",
                              )}
                              data-tl-slot=""
                              data-tl-kind="group"
                              data-tl-id={membership.id}
                              data-tl-keys={ids.join(",")}
                              onPointerDown={(event) => armRowDrag(event, ids)}
                              onClick={() => toggleGroup(membership.id)}
                              onPointerEnter={() => hoverLane({ kind: "group", id: membership.id })}
                              onPointerLeave={() => hoverLane(null)}
                              onContextMenu={(event) => {
                                const lead = indices[0];
                                if (lead == null) return;
                                openRowMenu(event, lead, indices);
                              }}
                            >
                              <span className="flex min-w-0 flex-1 items-center">
                                {renaming === membership.id ? (
                                  <span
                                    className="min-w-0"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <NameField
                                      value={membership.name}
                                      onCancel={() => setRenaming(null)}
                                      onCommit={(value) =>
                                        commitGroupName(membership.id, value)
                                      }
                                    />
                                  </span>
                                ) : (
                                  <span
                                    className="min-w-0"
                                    onClick={(event) => event.stopPropagation()}
                                    onDoubleClick={() => setRenaming(membership.id)}
                                  >
                                    <RowLabel
                                      className="min-w-0"
                                      label={membership.name}
                                      locale={locale}
                                      tone="main"
                                    />
                                  </span>
                                )}
                              </span>
                              <ReadOnlyField
                                ariaLabel={`${membership.name} (${unit})`}
                                label={String(Math.round(spanMs))}
                                unit={unit}
                              />
                              <button
                                type="button"
                                aria-expanded={groupOpen}
                                aria-label={tx(
                                  groupOpen
                                    ? PANEL_COPY.collapse(membership.name)
                                    : PANEL_COPY.expand(membership.name),
                                  locale,
                                )}
                                className="inline-flex size-5 shrink-0 items-center justify-center outline-none"
                              >
                                <SfSymbol
                                  name="chevron-up"
                                  className={cn("size-5", !groupOpen && "rotate-180")}
                                  style={{ color: MUTED }}
                                />
                              </button>
                            </div>
                          ) : null}
                          {groupOpen
                            ? indices.map((index) => {
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
                      const sid = segmentId(segment, index);
                      const membership = clipGroups.find((group) => group.keys.includes(sid));
                      const childClass = cn(
                        "flex h-[28px] items-center gap-2",
                        TIMELINE_ROW_HOVER,
                        membership ? NEST_PAD[2] : NEST_PAD[1],
                      );
                      return (
                        <div
                          key={sid}
                          className="flex flex-col gap-1"
                          data-tl-slot=""
                          data-tl-kind="phase"
                          data-tl-id={sid}
                          data-tl-parent={membership?.id ?? ""}
                        >
                          <div
                            className={cn(
                              "flex h-[28px] items-center gap-2",
                              TIMELINE_ROW_HOVER,
                              membership ? NEST_PAD[1] : NEST_PAD[0],
                              stagger && "cursor-pointer",
                              sameLaneHover(laneHover, { kind: "phase", index }) &&
                                "bg-[color:var(--sp-row-hover)]",
                            )}
                            onPointerDown={(event) => armRowDrag(event, [sid])}
                            onClick={stagger ? () => toggleLines(index) : undefined}
                            onPointerEnter={() => hoverLane({ kind: "phase", index })}
                            onPointerLeave={() => hoverLane(null)}
                            onContextMenu={(event) => openRowMenu(event, index, [index])}
                          >
                            <span className="flex min-w-0 flex-1 items-center">
                              {renaming === `phase:${sid}` ? (
                                <span
                                  className="min-w-0"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <NameField
                                    value={phaseName(index)}
                                    onCancel={() => setRenaming(null)}
                                    onCommit={(value) => commitGroupName(`phase:${sid}`, value)}
                                  />
                                </span>
                              ) : (
                                <span
                                  className="min-w-0"
                                  onClick={
                                    stagger
                                      ? (event) => event.stopPropagation()
                                      : undefined
                                  }
                                  onDoubleClick={
                                    stagger
                                      ? () => setRenaming(`phase:${sid}`)
                                      : undefined
                                  }
                                >
                                  <RowLabel
                                    className="min-w-0"
                                    label={phaseName(index)}
                                    locale={locale}
                                    tone={membership && !stagger ? "label" : "main"}
                                    modified={phaseModified}
                                    onResetValue={
                                      phaseModified
                                        ? () => resetPhase(index)
                                        : undefined
                                    }
                                  />
                                </span>
                              )}
                            </span>
                            {stagger ? (
                              <ReadOnlyField
                                ariaLabel={`${segment.caption} (${unit})`}
                                label={String(Math.round(clip.duration))}
                                unit={unit}
                              />
                            ) : (
                              lineField
                            )}
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
                                className="inline-flex size-5 shrink-0 items-center justify-center outline-none"
                              >
                                <SfSymbol
                                  name="chevron-up"
                                  className={cn(
                                    "size-5",
                                    !linesOpen && "rotate-180",
                                  )}
                                  style={{ color: MUTED }}
                                />
                              </button>
                            ) : null}
                          </div>
                          {stagger && linesOpen ? (
                            <>
                              {Array.from({ length: stagger.count }, (_, k) => (
                                <div
                                  key={k}
                                  className={cn(
                                    childClass,
                                    sameLaneHover(laneHover, { kind: "line", index, line: k }) &&
                                      "bg-[color:var(--sp-row-hover)]",
                                  )}
                                  onPointerDown={(event) => armRowDrag(event, [sid])}
                                  onPointerEnter={() => hoverLane({ kind: "line", index, line: k })}
                                  onPointerLeave={() => hoverLane(null)}
                                >
                                  <span
                                    className="min-w-0 flex-1 truncate text-[15px] leading-[20px]"
                                    style={{ color: MUTED }}
                                  >
                                    {`${stagger.caption} ${k + 1}`}
                                  </span>
                                  {lineField}
                                </div>
                              ))}
                            </>
                          ) : null}
                        </div>
                      );
                            })
                            : null}
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
                      onEditCurve={onEditCurve}
                      curveOptions={curveOptions}
                      curveSections={curveSections}
                      curveValue={curveValue}
                      onPickCurve={onPickCurve}
                      clipGroups={clipGroups}
                      groupLeads={groupLeads}
                      foldedGroups={foldedGroups}
                      onMakeStep={makeClipStep}
                      onGroup={groupClips}
                      onUngroup={ungroupClips}
                      laneHover={laneHover}
                      onLaneHover={hoverLane}
                      openMenuRef={openClipMenu}
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
        {lift
          ? createPortal(
              <div
                ref={liftRef}
                data-settings-panel=""
                data-panel-theme={theme}
                data-panel-font={font}
                className={cn(
                  lift.className,
                  "pointer-events-none fixed z-[260] origin-top-left scale-[1.03] border border-[color:var(--sp-line)] shadow-[0_8px_24px_rgba(0,0,0,0.28)]",
                )}
                style={{
                  width: lift.width,
                  height: lift.height,
                  background: "var(--sp-field)",
                }}
                dangerouslySetInnerHTML={{ __html: lift.html }}
              />,
              document.body,
            )
          : null}
      </>
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

  const curveLibrary = useCurveLibrary(panelId);

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
  const curveExtras = savedCurveExtras(curveLibrary.curves);
  const curveSections = easingPresetSections(
    {
      css: tx(PANEL_COPY.curveGroupCss, locale),
      out: tx(PANEL_COPY.curveGroupOut, locale),
      inOut: tx(PANEL_COPY.curveGroupInOut, locale),
      scene: tx(PANEL_COPY.curveGroupScene, locale),
      saved: tx(PANEL_COPY.curveGroupSaved, locale),
    },
    [],
    curveLibrary.curves,
  );
  const curveOptions = curveSections.flatMap((section) => section.options);
  const easingRecord = (
    active.settings as { easings?: Record<string, CubicBezier> }
  ).easings;
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
      onChange={(next) => {
        const patch = patchPlayerClips<any>(active.player, next);
        if (!recordPanelChange(panelId, patch)) active.onSettingsChange(patch);
      }}
      onEditCurve={editCurve}
      curveOptions={active.easingIds ? curveOptions : undefined}
      curveSections={active.easingIds ? curveSections : undefined}
      curveValue={
        active.easingIds
          ? (phase) => {
              const id = active.easingIds?.[phase];
              const easing = id ? easingRecord?.[id] : undefined;
              if (!id || !easing) return;
              return matchEasingPreset(easing, curveExtras);
            }
          : undefined
      }
      onPickCurve={
        active.easingIds
          ? (indices, presetId) => {
              const raw = easingForPreset(presetId, curveExtras);
              const parsed = raw ? parseBezierInput(raw) : null;
              if (!parsed) return;
              const next = { ...easingRecord };
              let wrote = false;
              for (const index of indices) {
                const id = active.easingIds?.[index];
                if (!id) continue;
                next[id] = parsed;
                wrote = true;
              }
              if (wrote) {
                const patch = { easings: next } as Partial<typeof active.settings>;
                if (!recordPanelChange(panelId, patch)) active.onSettingsChange(patch);
              }
            }
          : undefined
      }
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

function NameField({
  value,
  onCommit,
  onCancel,
}: {
  value: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const skip = useRef(false);
  return (
    <input
      autoFocus
      defaultValue={value}
      aria-label={value}
      className="h-5 min-w-0 flex-1 bg-transparent text-[15px] leading-[20px] text-[color:var(--sp-muted)] outline-none"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          skip.current = true;
          onCancel();
        } else if (event.key === "Enter") {
          event.preventDefault();
          onCommit(event.currentTarget.value);
        }
      }}
      onBlur={(event) => {
        if (!skip.current) onCommit(event.currentTarget.value);
      }}
    />
  );
}
