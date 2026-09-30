"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { EasingCurveEditor } from "../easing-curve-editor";
import {
  parseBezierInput,
  type CubicBezier,
} from "../lib/cubic-bezier";
import {
  easingForPreset,
  easingPresetOptions,
  matchEasingPreset,
} from "../lib/easing-presets";
import {
  PANEL_FOCUS_EVENT,
  focusPanel,
  parsePanelSettingsObject,
  readPanelSettings,
  writePanelLocale,
  writePanelFont,
  writePanelSettings,
  writePanelTheme,
  type PanelFocusDetail,
  type ChromeWindowId,
  type PanelFont,
  PANEL_FONTS,
  isPanelFont,
  CHROME_WINDOW_IDS,
} from "../lib/panel-theme";
import { usePrefersReducedMotion } from "../lib/prefers-reduced-motion";
import {
  isHideDockKey,
  isPhysicalKey,
  SCENE_PANEL_CODES,
} from "../lib/hotkeys";
import { cn } from "../lib/utils";
import { SfSymbol, type SfSymbolName } from "../sf-symbol";
import { BezierCoordsRow } from "./bezier-coords";
import {
  CURVE_SIZE,
  DOCK_BAR_H,
  DOCK_BAR_PAD,
  EASE_OUT,
  FIELD,
  GLASS,
  MUTED,
  DOCK_INSET,
  PANEL_DOCK_GAP,
  PANEL_ENTER_MS,
  PANEL_EXIT_MS,
  PANEL_HEIGHT_MIN,
  PANEL_MOVE_EDGE,
  PANEL_RESIZE_HIT,
  SECTION_CLOSED_PX,
  SNAPSHOT_SLOTS,
  SNAPSHOT_TRACK_W,
  SUBSECTION_DRAG_PX,
  dockBarButtonClass,
  SUBSECTION_HEADER_PX,
  fieldChrome,
  pickActive,
  pickEase,
  pickIdle,
  pickerChrome,
  pointerHeld,
} from "./chrome";
import {
  ChromeHintRow,
  ChromeViewSection,
  DockedChromeWindow,
} from "./chrome-window";
import {
  DockBadgeAnchor,
  DockCountBadge,
  DockToast,
  DockBarDivider,
  DockBarTips,
  DockFoldButton,
  DockSearchField,
} from "./dock";
import { EasingPlayheadGate } from "./easing-playhead";
import { PANEL_VERSION } from "../version";
import { SettingEnumDropdown, SettingToggle } from "./fields";
import { copyKey, isAppleKeyboard, PANEL_COPY, PANEL_FONT_LABEL, shortcutKeys, tx, type PanelLocale } from "./locale";
import {
  applyLiftTransform,
  blockTopsByAttr,
  clampLiftY,
  filterEasingTargetsBySearch,
  filterGroupsByKeys,
  filterGroupsBySearch,
  insertIndexFromClientY,
  mergeChromeSectionOrder,
  mergeSectionOrder,
  moveTitleToIndex,
  PANEL_SECTION_ID,
  PRESETS_SECTION_ID,
  DEFAULT_PINNED_SECTIONS,
  playListFlip,
  readMigratedPanelUi,
  sectionHasRows,
  splitPinnedSectionRails,
  valuesEqual,
  withoutRetiredSectionIds,
  omitPlayerKeyRows,
  type LiftSize,
  type LiftXy,
} from "./model";
import {
  DockBarSlot,
  panelPopClassName,
  panelPopStyle,
} from "./motion-ui";
import {
  nextPanelIcons,
  panelIconIsModified,
  resolvedPanelIcon,
  rowIconKey,
  subsectionIconKey,
} from "./panel-icons";
import { PresetCurveIcon } from "./preset-curve";
import { RowLabel, useDeferredMount } from "./row";
import { lintSettingsSchema, reportSettingsSchemaLint } from "./schema-lint";
import { SectionRows, indexRowsByKey } from "./section-rows";
import {
  SectionBlock,
  SectionDivider,
  ReorderShell,
  SubsectionBlock,
} from "./sections";
import { PanelSelectList } from "./select";
import { TimelineToggleButton } from "./timeline";
import type {
  ResetDotProps,
  SettingsGroup,
  SettingsPanelProps,
  SettingsSection,
} from "./types";
import { useChromeVisible } from "./use-chrome-visible";
import {
  changeModel,
  formatDefaultsHandoff,
  labelsByKey,
} from "./change-model";
import { useCopyFlash } from "./use-copy-flash";
import { useSettingsHistory } from "./use-history";
import { usePanelSnapshots } from "./use-snapshots";
import { useSettingsTransfer } from "./use-transfer";
import { SettingsTransferMenu } from "./transfer-menu";
import { SpringEditor } from "./spring-editor";
import type { SpringConfig } from "../lib/spring";
import type { SpringTarget } from "./types";

const NO_SPRING_TARGETS: readonly SpringTarget[] = [];
import {
  usePanelWindow,
  readLastDockBarW,
  writeLastDockBarW,
} from "./use-panel-window";

export function SettingsPanel<TSettings>(props: SettingsPanelProps<TSettings>) {
  return (
    <SettingsPanelImpl
      key={props.layoutPanelId ?? props.panelId}
      {...props}
    />
  );
}

export function SettingsPanelImpl<TSettings>({
  defaultOpenSections = ["timings"],
  easingTargets = [],
  springTargets = NO_SPRING_TARGETS,
  easingPresetExtras = [],
  curveSection,
  curveSectionTitle,
  curveSectionIcon = "waypoints",
  easingSectionTitle,
  onReplay,
  getReplayDurationMs,
  onReset,
  defaultSettings,
  dockExtra,
  defaultDockCorner,
  layoutPanelId,
  onSettingsChange: applySettings,
  panelId,
  legacyPanelIds = [],
  settings,
  groups,
  storageLabel,
  shortcut = false,
  hideShortcut = true,
  undoShortcut = true,
  players = [],
  enabled = true,
  hideBelow,
}: SettingsPanelProps<TSettings>) {
  useEffect(() => {
    reportSettingsSchemaLint(
      panelId,
      lintSettingsSchema({
        groups,
        players,
        defaultSettings,
        defaultOpenSections,
        easingTargets,
        springTargets,
      }),
    );
  }, [
    panelId,
    groups,
    players,
    defaultSettings,
    defaultOpenSections,
    easingTargets,
    springTargets,
  ]);

  const chromeVisible = useChromeVisible(enabled, hideBelow);
  const history = useSettingsHistory({
    settings,
    onSettingsChange: applySettings,
    enabled: undoShortcut && chromeVisible,
  });
  const onSettingsChange = (patch: Partial<TSettings>) => history.record(patch);

  const [panelOpen, setPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hotkeysOpen, setHotkeysOpen] = useState(false);
  const [bezierOpen, setBezierOpen] = useState(false);
  const [axisOpen, setAxisOpen] = useState(false);
  const [springOpen, setSpringOpen] = useState(false);
  const [activeSpringId, setActiveSpringId] = useState(
    () => springTargets[0]?.id ?? "",
  );
  const [panelInstant, setPanelInstant] = useState(false);
  const [windowHost, setWindowHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setWindowHost(document.body);
  }, []);
  const [sectionIcons, setSectionIcons] = useState<
    Record<string, SfSymbolName>
  >({});
  const legacyPanelKey = legacyPanelIds.join("\0");

  const sameValue = valuesEqual;

  const dotFor = (
    key: keyof TSettings,
    info?: string,
    icon?: SfSymbolName,
  ): ResetDotProps => {
    const defaults = defaultSettings;
    if (defaults == null) return { info, icon };
    return {
      info,
      icon,
      modified: !sameValue(settings[key], defaults[key]),
      onResetValue: () =>
        onSettingsChange({ [key]: defaults[key] } as Partial<TSettings>),
    };
  };

  /** Default of a number key — feeds the scrub-track notch magnet. */
  const numberDefault = (key: keyof TSettings): number | undefined => {
    const d = defaultSettings?.[key];
    return typeof d === "number" ? d : undefined;
  };

  const dotForKeys = (
    keys: readonly (keyof TSettings)[],
    info?: string,
    icon?: SfSymbolName,
  ): ResetDotProps => {
    const defaults = defaultSettings;
    if (defaults == null) return { info, icon };
    return {
      info,
      icon,
      modified: keys.some((key) => !sameValue(settings[key], defaults[key])),
      onResetValue: () => {
        const patch = {} as Partial<TSettings>;
        for (const key of keys) {
          patch[key] = defaults[key];
        }
        onSettingsChange(patch);
      },
    };
  };

  const changes = changeModel({
    settings,
    defaultSettings,
    groups,
    players,
    easingTargets,
    springTargets,
    hasCurveSection: Boolean(curveSection),
    sectionIcons,
  });
  const { pageKeys, curveKeys, changedCount, liveEasings } = changes;

  const { copied: copiedChanges, copy: copyToClipboard } = useCopyFlash();

  // With defaults known, Reset/Copy only make sense when something changed.
  const dockActionsVisible =
    panelOpen && (defaultSettings == null || changedCount > 0);
  const layoutStoreId = layoutPanelId ?? panelId;
  const barRef = useRef<HTMLDivElement>(null);
  const [barW, setBarW] = useState(
    () => readLastDockBarW(layoutStoreId) ?? DOCK_BAR_H,
  );
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => {
      const width = bar.offsetWidth;
      writeLastDockBarW(layoutStoreId, width);
      setBarW(width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [chromeVisible, layoutStoreId]);
  const {
    panelFloat,
    dockDragging,
    dockMovedRef,
    panelResizing,
    panelMoving,
    layoutCorner,
    dockRight,
    dockBottom,
    dockCenter,
    shownPos,
    dockedX,
    viewportW,
    viewportH,
    maxPanelH,
    frameW,
    frameH,
    startPanelResize,
    startPanelMove,
    startChromeMove,
    chromeFloat,
    chromeMoving,
    windowZ,
    raiseWindow,
    chromeDockedXRef,
    onDockPointerDown,
    resetChromeLayout,
  } = usePanelWindow({
    panelId,
    layoutPanelId,
    legacyPanelIds,
    defaultDockCorner,
    barW,
  });

  const copyChangedSettings = async () => {
    if (defaultSettings == null || changedCount === 0) return;
    await copyToClipboard(
      formatDefaultsHandoff({
        model: changes,
        settings,
        defaults: defaultSettings,
        groups,
        players,
        subsectionOrder,
        sectionIcons,
        hasCurveSection: Boolean(curveSection),
        curveTitle,
        easingTitle,
        storageLabel,
        locale,
      }),
    );
  };

  const curveDot =
    curveSection && curveKeys.length > 0
      ? dotForKeys(curveKeys)
      : undefined;
  const easingDot =
    easingTargets.length > 0 &&
    defaultSettings != null &&
    "easings" in (defaultSettings as object)
      ? dotFor("easings" as keyof TSettings)
      : undefined;

  const {
    snapshots,
    activeSnapshot,
    replaceSnapshots,
    saveSnapshot,
    saveCurrentToPreset,
    applySnapshot,
    clearSnapshot,
    snapshotDrifted,
  } = usePanelSnapshots({
    panelId,
    legacyPanelIds,
    settings,
    pageKeys,
    onSettingsChange: (patch, slot) =>
      history.record(patch, tx(PANEL_COPY.presetStep(slot + 1), locale)),
  });
  const lastEditedRef = useRef<{ group: string; section?: string } | null>(
    null,
  );
  const [openSections, setOpenSections] = useState(() => {
    const next = new Set(defaultOpenSections);
    const last = readPanelSettings(panelId, legacyPanelIds).lastEdited;
    if (last?.group && groups.some((item) => item.id === last.group)) {
      next.add(last.group);
      lastEditedRef.current = last.section
        ? { group: last.group, section: last.section }
        : { group: last.group };
    }
    return next;
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [changedOnly, setChangedOnly] = useState(false);
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setChangedOnly(false);
  };
  const [closedSubsections, setClosedSubsections] = useState(
    () => new Set<string>(),
  );
  const markRowEdited = (groupId: string, section?: string) => {
    const prev = lastEditedRef.current;
    if (
      prev &&
      prev.group === groupId &&
      (prev.section ?? undefined) === section
    ) {
      return;
    }
    const next = section
      ? { group: groupId, section }
      : { group: groupId };
    lastEditedRef.current = next;
    writePanelSettings(panelId, { lastEdited: next });
  };
  const [panelTheme, setPanelTheme] = useState<"dark" | "light">("dark");
  const [locale, setLocale] = useState<PanelLocale>("ru");
  const [panelFont, setPanelFont] = useState<PanelFont>("geist");
  const [transferToast, setTransferToast] = useState<{
    id: number;
    text: string;
    detail?: string;
  } | null>(null);
  useEffect(() => {
    if (history.notice != null) setTransferToast(null);
  }, [history.notice]);
  const transfer = useSettingsTransfer({
    panelId,
    storageLabel,
    locale,
    settings,
    defaultSettings,
    pageKeys,
    settingDiffers: changes.settingDiffers,
    snapshots,
    replaceSnapshots,
    record: history.record,
    notify: (text, detail) => {
      history.clearNotice();
      setTransferToast((prev) => ({ id: (prev?.id ?? 0) + 1, text, detail }));
    },
  });
  const [reorderSections] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const sectionOrderRef = useRef(sectionOrder);
  const [pinnedSections, setPinnedSections] = useState<string[]>([
    ...DEFAULT_PINNED_SECTIONS,
  ]);
  const [draggingSection, setDraggingSection] = useState<string | null>(null);
  const [sectionFloat, setSectionFloat] = useState<LiftSize | null>(null);
  const sectionXyRef = useRef<LiftXy | null>(null);
  const sectionLiftedRef = useRef(false);
  const sectionDragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    offsetY: number;
    width: number;
    height: number;
    moved: boolean;
  } | null>(null);
  const sectionFloatElRef = useRef<HTMLDivElement | null>(null);
  const sectionFlipRef = useRef<Map<string, number> | null>(null);
  const skipSectionToggleRef = useRef(false);
  const sectionDragOpenRestoreRef = useRef<Set<string> | null>(null);
  const [subsectionOrder, setSubsectionOrder] = useState<
    Record<string, string[]>
  >({});
  const subsectionOrderRef = useRef(subsectionOrder);
  useEffect(() => {
    sectionOrderRef.current = sectionOrder;
  }, [sectionOrder]);
  useEffect(() => {
    subsectionOrderRef.current = subsectionOrder;
  }, [subsectionOrder]);
  const [draggingSubsection, setDraggingSubsection] = useState<string | null>(
    null,
  );
  const [subsectionFloat, setSubsectionFloat] = useState<LiftSize | null>(null);
  const subsectionXyRef = useRef<LiftXy | null>(null);
  const subsectionLiftedRef = useRef(false);
  const subsectionDragRef = useRef<{
    groupId: string;
    title: string;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    offsetY: number;
    width: number;
    height: number;
    moved: boolean;
  } | null>(null);
  const subsectionFloatElRef = useRef<HTMLDivElement | null>(null);
  const subsectionFlipRef = useRef<{
    groupId: string;
    fromTops: Map<string, number>;
  } | null>(null);
  const skipSubsectionToggleRef = useRef(false);
  const subsectionDragClosedRestoreRef = useRef<Set<string> | null>(null);
  const [activeEasingId, setActiveEasingId] = useState(
    () => easingTargets[0]?.id ?? "",
  );
  const reduceMotion = usePrefersReducedMotion();
  const skipPanelMotion = reduceMotion || panelInstant;
  const panelMounted = useDeferredMount(
    panelOpen,
    skipPanelMotion,
    skipPanelMotion ? 0 : PANEL_EXIT_MS,
  );
  const bezierMounted = useDeferredMount(
    bezierOpen,
    reduceMotion,
    reduceMotion ? 0 : PANEL_EXIT_MS,
  );
  const axisMounted = useDeferredMount(
    axisOpen,
    reduceMotion,
    reduceMotion ? 0 : PANEL_EXIT_MS,
  );
  const springMounted = useDeferredMount(
    springOpen,
    reduceMotion,
    reduceMotion ? 0 : PANEL_EXIT_MS,
  );
  const settingsMounted = useDeferredMount(
    settingsOpen,
    reduceMotion,
    reduceMotion ? 0 : PANEL_EXIT_MS,
  );

  const groupsForPanel = useMemo(
    () =>
      players.length > 0
        ? omitPlayerKeyRows(groups, players)
        : groups,
    [groups, players],
  );
  const searchQueryActive = searchOpen && searchQuery.trim().length > 0;
  const changedFilterActive = searchOpen && changedOnly && !searchQueryActive;
  const narrowActive = searchQueryActive || changedFilterActive;
  const filteredGroups = searchQueryActive
    ? filterGroupsBySearch(groupsForPanel, searchQuery)
    : changedFilterActive
      ? filterGroupsByKeys(groupsForPanel, new Set(changes.listedChangedKeys))
      : groupsForPanel;
  useEffect(() => {
    if (changedOnly && changedCount === 0) closeSearch();
  }, [changedOnly, changedCount]);
  const toggleChangedOnly = () => {
    if (dockMovedRef.current) return;
    if (changedFilterActive) {
      closeSearch();
      return;
    }
    setSearchQuery("");
    setChangedOnly(true);
    setSearchOpen(true);
    setPanelInstant(false);
    closeDockPlayers();
    setPanelOpen(true);
  };
  const changedBadge = (count: number) => (
    <DockCountBadge
      count={count}
      pressed={changedFilterActive}
      label={tx(
        changedFilterActive
          ? PANEL_COPY.showAllRows
          : PANEL_COPY.showChangedOnly(changedCount),
        locale,
      )}
      tip={tx(
        changedFilterActive
          ? PANEL_COPY.dockShowAll
          : PANEL_COPY.dockChangedOnly,
        locale,
      )}
      onToggle={toggleChangedOnly}
    />
  );
  const rowIndex = indexRowsByKey(groups);
  const searchedEasing = searchQueryActive
    ? filterEasingTargetsBySearch(easingTargets, searchQuery)
    : null;
  const visibleEasingTargets = searchedEasing ?? easingTargets;
  useEffect(() => {
    const allowed = easingTargets.map((target) => target.id);
    if (allowed.length === 0) return;
    setActiveEasingId((id) => (allowed.includes(id) ? id : allowed[0]!));
  }, [easingTargets]);
  const activeEasing =
    liveEasings?.[activeEasingId] ??
    liveEasings?.[visibleEasingTargets[0]?.id ?? ""] ??
    ({ x1: 0.22, y1: 1, x2: 0.36, y2: 1 } satisfies CubicBezier);
  const easingPreset = matchEasingPreset(activeEasing, easingPresetExtras);
  const presetOptions = easingPresetOptions(easingPresetExtras);
  const hasEasingTargets = easingTargets.length > 0;

  const allSectionIds = [
    ...groupsForPanel.map((group) => group.id),
    PANEL_SECTION_ID,
  ];
  const orderedSectionIds = mergeChromeSectionOrder(
    allSectionIds,
    sectionOrder,
  );
  const pinnedSet = new Set(pinnedSections);
  const sectionRails = splitPinnedSectionRails(orderedSectionIds, pinnedSet);
  const canReorderSections =
    reorderSections && orderedSectionIds.length > 1;

  const startSectionDrag = (
    event: ReactPointerEvent<HTMLSpanElement>,
    id: string,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const block = event.currentTarget.closest("[data-section-id]");
    if (!(block instanceof HTMLElement)) return;
    const rect = block.getBoundingClientRect();
    sectionDragRef.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingSection(id);
  };

  const persistPinnedSection = (id: string) => {
    const nextSet = new Set(pinnedSections);
    if (nextSet.has(id)) nextSet.delete(id);
    else nextSet.add(id);
    const next = [...nextSet];
    setPinnedSections(next);
    writePanelSettings(panelId, { pinnedSections: next });
  };

  const sectionReorderProps = (id: string) =>
    reorderSections
      ? {
          reorderable: canReorderSections,
          dragging: draggingSection === id,
          pinned: pinnedSet.has(id),
          onPinClick: () => persistPinnedSection(id),
          ...(canReorderSections
            ? {
                onGripPointerDown: (
                  event: ReactPointerEvent<HTMLSpanElement>,
                ) => startSectionDrag(event, id),
              }
            : {}),
        }
      : {};

  const hasSpringTargets = springTargets.length > 0;
  useEffect(() => {
    const allowed = springTargets.map((target) => target.id);
    if (allowed.length === 0) return;
    setActiveSpringId((id) => (allowed.includes(id) ? id : allowed[0]!));
  }, [springTargets]);
  const activeSpring =
    changes.liveSprings?.[activeSpringId] ??
    changes.liveSprings?.[springTargets[0]?.id ?? ""];
  const patchSpring = (spring: SpringConfig) => {
    if (!activeSpringId) return;
    onSettingsChange({
      springs: { ...changes.liveSprings, [activeSpringId]: spring },
    } as unknown as Partial<TSettings>);
  };
  const springDot =
    hasSpringTargets &&
    defaultSettings != null &&
    "springs" in (defaultSettings as object)
      ? dotFor("springs" as keyof TSettings)
      : undefined;

  const patchEasing = (easing: CubicBezier) => {
    if (!activeEasingId) return;
    onSettingsChange({
      easings: {
        ...liveEasings,
        [activeEasingId]: easing,
      },
    } as unknown as Partial<TSettings>);
  };

  const toggleSection = (id: string) => {
    if (skipSectionToggleRef.current) {
      skipSectionToggleRef.current = false;
      return;
    }
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSubsection = (id: string) => {
    setClosedSubsections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canCollapseAll = allSectionIds.some((id) =>
    openSections.has(id),
  );
  const toggleFoldAll = () => {
    if (canCollapseAll) {
      setOpenSections(new Set());
      setClosedSubsections(() => {
        const next = new Set<string>();
        for (const group of groups) {
          for (const section of group.sections) {
            if (section.untitled) continue;
            next.add(`${group.id}:${copyKey(section.title)}`);
          }
        }
        return next;
      });
      return;
    }
    setOpenSections(new Set(allSectionIds));
    setClosedSubsections(new Set());
  };

  useEffect(() => {
    try {
      const raw = readMigratedPanelUi(
        panelId,
        ":subsection-order",
        legacyPanelKey ? legacyPanelKey.split("\0") : [],
      );
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return;
      }
      const next: Record<string, string[]> = {};
      for (const [groupId, titles] of Object.entries(parsed)) {
        if (
          Array.isArray(titles) &&
          titles.every((title) => typeof title === "string")
        ) {
          next[groupId] = titles;
        }
      }
      setSubsectionOrder(next);
    } catch {
      /* ignore broken UI cache */
    }
  }, [legacyPanelKey, panelId]);

  useLayoutEffect(() => {
    const raw = readMigratedPanelUi(
      panelId,
      ":panel-settings",
      legacyPanelKey ? legacyPanelKey.split("\0") : [],
    );
    const parsed = parsePanelSettingsObject(raw);
    const chrome = layoutPanelId
      ? parsePanelSettingsObject(
          readMigratedPanelUi(layoutPanelId, ":panel-settings", []),
        )
      : parsed;
    const theme = chrome.theme ?? parsed.theme;
    const nextLocale = chrome.locale ?? parsed.locale;
    if (theme) setPanelTheme(theme);
    if (nextLocale) setLocale(nextLocale);
    if (chrome.font ?? parsed.font) {
      const stored = chrome.font ?? parsed.font;
      setPanelFont(isPanelFont(stored) ? stored : "geist");
    }
    if (parsed.sectionOrder) {
      setSectionOrder(withoutRetiredSectionIds(parsed.sectionOrder));
    }
    if (parsed.pinnedSections !== undefined) {
      setPinnedSections(withoutRetiredSectionIds(parsed.pinnedSections));
    }
    setSectionIcons(parsed.sectionIcons ?? {});
    if (parsed.lastEdited?.group) {
      const last = parsed.lastEdited;
      lastEditedRef.current = last.section
        ? { group: last.group, section: last.section }
        : { group: last.group };
      if (groups.some((item) => item.id === last.group)) {
        setOpenSections((prev) => {
          if (prev.has(last.group)) return prev;
          return new Set(prev).add(last.group);
        });
      }
      if (last.section) {
        const subsectionId = `${last.group}:${last.section}`;
        setClosedSubsections((prev) => {
          if (!prev.has(subsectionId)) return prev;
          const next = new Set(prev);
          next.delete(subsectionId);
          return next;
        });
      }
    }
  }, [legacyPanelKey, panelId]);

  const persistPanelTheme = (value: "dark" | "light") => {
    setPanelTheme(value);
    writePanelTheme(layoutStoreId, value);
  };

  const persistLocale = (value: PanelLocale) => {
    setLocale(value);
    writePanelLocale(layoutStoreId, value);
  };

  const persistFont = (value: PanelFont) => {
    setPanelFont(value);
    writePanelFont(layoutStoreId, value);
  };

  const persistSectionIcon = (
    id: string,
    fallback: SfSymbolName | undefined,
    next: SfSymbolName | undefined,
  ) => {
    setSectionIcons((prev) => {
      const map = nextPanelIcons(prev, id, fallback, next);
      writePanelSettings(panelId, { sectionIcons: map });
      return map;
    });
  };

  const withPanelIcon = (
    id: string,
    fallback: SfSymbolName | undefined,
    dots: ResetDotProps = {},
  ): ResetDotProps => {
    const iconMod = panelIconIsModified(sectionIcons, id);
    const resetValue = dots.onResetValue;
    return {
      ...dots,
      locale,
      icon: resolvedPanelIcon(sectionIcons, id, fallback),
      modified: Boolean(dots.modified) || iconMod,
      onResetValue:
        resetValue || iconMod
          ? () => {
              resetValue?.();
              if (iconMod) persistSectionIcon(id, fallback, fallback);
            }
          : undefined,
      onIconChange: reorderSections
        ? (name: SfSymbolName) => persistSectionIcon(id, fallback, name)
        : undefined,
    };
  };

  const rowDotFor = (
    key: keyof TSettings,
    info?: string,
    icon?: SfSymbolName,
  ) => withPanelIcon(rowIconKey(String(key)), icon, dotFor(key, info, icon));

  const rowDotForKeys = (
    keys: readonly (keyof TSettings)[],
    info?: string,
    icon?: SfSymbolName,
  ) =>
    withPanelIcon(
      rowIconKey(keys.map(String).join("+")),
      icon,
      dotForKeys(keys, info, icon),
    );

  const sectionIconProps = (
    id: string,
    fallback: SfSymbolName | undefined,
    extra?: ResetDotProps,
  ) => {
    const dots = withPanelIcon(id, fallback, extra ?? {});
    return {
      ...dots,
      icon: dots.icon ?? fallback,
    };
  };

  const curveTitle = tx(curveSectionTitle ?? PANEL_COPY.axisCurve, locale);
  const easingTitle = tx(easingSectionTitle ?? PANEL_COPY.easingCurves, locale);

  useEffect(() => {
    if (!draggingSection && !draggingSubsection) return;
    const root = document.documentElement;
    root.dataset.panelReorder = "";
    return () => {
      delete root.dataset.panelReorder;
    };
  }, [draggingSection, draggingSubsection]);

  useEffect(() => {
    const drag = subsectionDragRef.current;
    if (!draggingSubsection || !drag) return;

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      if (!pointerHeld(event)) {
        onUp(event);
        return;
      }
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (
        !drag.moved &&
        Math.hypot(dx, dy) < SUBSECTION_DRAG_PX
      ) {
        return;
      }
      const dragJustStarted = !drag.moved;
      drag.moved = true;
      const root = document.getElementById(panelId);
      if (!root) return;
      const panelRect = root.getBoundingClientRect();
      if (dragJustStarted) {
        drag.height = SUBSECTION_HEADER_PX;
        const group = groups.find((item) => item.id === drag.groupId);
        const ids = (group?.sections ?? [])
          .filter((section) => !section.untitled)
          .map((section) => `${drag.groupId}:${copyKey(section.title)}`);
        const needsCollapse = ids.some((id) => !closedSubsections.has(id));
        if (needsCollapse) {
          const groupRoot = root.querySelector(
            `[data-subsection-group="${drag.groupId}"]`,
          );
          const blocks = groupRoot
            ? [
                ...groupRoot.querySelectorAll<HTMLElement>(
                  "[data-subsection-title]",
                ),
              ]
            : [];
          if (blocks.length > 0) {
            subsectionFlipRef.current = {
              groupId: drag.groupId,
              fromTops: blockTopsByAttr(blocks, "subsectionTitle"),
            };
          }
          subsectionDragClosedRestoreRef.current = new Set(closedSubsections);
          setClosedSubsections((prev) => {
            const next = new Set(prev);
            for (const id of ids) next.add(id);
            return next;
          });
        }
      }
      const x = drag.originX;
      const y = clampLiftY(
        event.clientY,
        drag.offsetY,
        panelRect,
        drag.height,
      );
      subsectionXyRef.current = { x, y };
      applyLiftTransform(subsectionFloatElRef.current, { x, y });
      if (!subsectionLiftedRef.current) {
        subsectionLiftedRef.current = true;
        setSubsectionFloat({ width: drag.width, height: drag.height });
      }
      const groupRoot = root.querySelector(
        `[data-subsection-group="${drag.groupId}"]`,
      );
      if (!groupRoot) return;
      const blocks = [
        ...groupRoot.querySelectorAll<HTMLElement>("[data-subsection-title]"),
      ];
      if (blocks.length < 2) return;
      const insertAt = insertIndexFromClientY(blocks, event.clientY);
      const prev = subsectionOrderRef.current;
      const current = mergeSectionOrder(
        groups
          .find((group) => group.id === drag.groupId)
          ?.sections.map((section) => copyKey(section.title)) ?? [],
        prev[drag.groupId],
      );
      const nextTitles = moveTitleToIndex(current, drag.title, insertAt);
      if (nextTitles === current) return;
      subsectionFlipRef.current = {
        groupId: drag.groupId,
        fromTops: blockTopsByAttr(blocks, "subsectionTitle"),
      };
      const next = { ...prev, [drag.groupId]: nextTitles };
      subsectionOrderRef.current = next;
      setSubsectionOrder(next);
    };

    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      const moved = drag.moved;
      const restoreClosed = subsectionDragClosedRestoreRef.current;
      subsectionDragClosedRestoreRef.current = null;
      subsectionDragRef.current = null;
      subsectionLiftedRef.current = false;
      subsectionXyRef.current = null;
      setDraggingSubsection(null);
      setSubsectionFloat(null);
      if (moved && restoreClosed) {
        setClosedSubsections(restoreClosed);
      }
      if (!moved) return;
      skipSubsectionToggleRef.current = true;
      try {
        localStorage.setItem(
          `${panelId}:subsection-order`,
          JSON.stringify(subsectionOrderRef.current),
        );
      } catch {
        /* quota / private mode */
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [closedSubsections, draggingSubsection, groups, panelId]);

  useLayoutEffect(() => {
    const pending = subsectionFlipRef.current;
    if (!pending) return;
    subsectionFlipRef.current = null;
    if (reduceMotion) return;
    const root = document.getElementById(panelId);
    const groupRoot = root?.querySelector(
      `[data-subsection-group="${pending.groupId}"]`,
    );
    if (!groupRoot) return;
    playListFlip(
      groupRoot,
      "data-subsection-title",
      pending.fromTops,
      draggingSubsection,
    );
  }, [
    closedSubsections,
    draggingSubsection,
    panelId,
    reduceMotion,
    subsectionOrder,
  ]);

  useEffect(() => {
    const drag = sectionDragRef.current;
    if (!draggingSection || !drag) return;

    const canonicalIds = () => [
      ...groupsForPanel.map((group) => group.id),
      PANEL_SECTION_ID,
    ];

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      if (!pointerHeld(event)) {
        onUp(event);
        return;
      }
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < SUBSECTION_DRAG_PX) return;
      const dragJustStarted = !drag.moved;
      drag.moved = true;
      const root = document.getElementById(panelId);
      if (!root) return;
      const panelRect = root.getBoundingClientRect();
      if (dragJustStarted) {
        drag.height = SECTION_CLOSED_PX;
        const ids = canonicalIds();
        const needsCollapse = ids.some((id) => openSections.has(id));
        if (needsCollapse) {
          const list = root.querySelector("[data-section-list]");
          const blocks = list
            ? [...list.querySelectorAll<HTMLElement>("[data-section-id]")]
            : [];
          if (blocks.length > 0) {
            sectionFlipRef.current = blockTopsByAttr(blocks, "sectionId");
          }
          sectionDragOpenRestoreRef.current = new Set(openSections);
          setOpenSections((prev) => {
            const next = new Set(prev);
            for (const id of ids) next.delete(id);
            return next;
          });
        }
      }
      const x = drag.originX;
      const y = clampLiftY(
        event.clientY,
        drag.offsetY,
        panelRect,
        drag.height,
      );
      sectionXyRef.current = { x, y };
      applyLiftTransform(sectionFloatElRef.current, { x, y });
      if (!sectionLiftedRef.current) {
        sectionLiftedRef.current = true;
        setSectionFloat({ width: drag.width, height: drag.height });
      }
      const list = root.querySelector("[data-section-list]");
      if (!list) return;
      const blocks = [
        ...list.querySelectorAll<HTMLElement>("[data-section-id]"),
      ];
      if (blocks.length < 2) return;
      const insertAt = insertIndexFromClientY(blocks, event.clientY);
      const current = mergeChromeSectionOrder(
        canonicalIds(),
        sectionOrderRef.current,
      );
      const nextIds = moveTitleToIndex(current, drag.id, insertAt);
      if (nextIds === current) return;
      sectionFlipRef.current = blockTopsByAttr(blocks, "sectionId");
      sectionOrderRef.current = nextIds;
      setSectionOrder(nextIds);
    };

    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      const moved = drag.moved;
      const restoreOpen = sectionDragOpenRestoreRef.current;
      sectionDragOpenRestoreRef.current = null;
      sectionDragRef.current = null;
      sectionLiftedRef.current = false;
      sectionXyRef.current = null;
      setDraggingSection(null);
      setSectionFloat(null);
      if (moved && restoreOpen) setOpenSections(restoreOpen);
      if (!moved) return;
      skipSectionToggleRef.current = true;
      writePanelSettings(panelId, {
        sectionOrder: sectionOrderRef.current,
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [
    draggingSection,
    groupsForPanel,
    openSections,
    panelId,
  ]);

  useLayoutEffect(() => {
    const pending = sectionFlipRef.current;
    if (!pending) return;
    sectionFlipRef.current = null;
    if (reduceMotion) return;
    const root = document.getElementById(panelId);
    const list = root?.querySelector("[data-section-list]");
    if (!list) return;
    playListFlip(list, "data-section-id", pending, draggingSection);
  }, [draggingSection, openSections, panelId, reduceMotion, sectionOrder]);

  useEffect(() => {
    if (visibleEasingTargets.some((target) => target.id === activeEasingId)) {
      return;
    }
    const first = visibleEasingTargets[0]?.id;
    if (first) setActiveEasingId(first);
  }, [activeEasingId, easingTargets]);

  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const playersRef = useRef(players);
  playersRef.current = players;
  const dockPlayerKey = players
    .map((item) => item.controller.id)
    .join("\0");
  const [timelineOpen, setTimelineOpen] = useState(false);
  /** ⌘\ : hide the whole dock (not persisted — a reload brings it back). */
  const [dockHidden, setDockHidden] = useState(false);
  const dockHiddenRef = useRef(false);

  const closeDockPlayers = () => {
    for (const item of playersRef.current) {
      if (item.controller.getState().open) item.controller.setOpen(false);
    }
  };

  const openDockTimeline = () => {
    const list = playersRef.current;
    const first = list[0];
    if (!first) return;
    for (const item of list) {
      if (
        item.controller !== first.controller &&
        item.controller.getState().open
      ) {
        item.controller.setOpen(false);
      }
    }
    first.controller.setOpen(true);
  };

  useEffect(() => {
    const onFocus = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as PanelFocusDetail | undefined;
      if (detail?.panelId !== panelId) return;
      setPanelInstant(true);
      const openBezier =
        Boolean(detail.easingId) ||
        detail.group === "curves" ||
        (detail.group === "bezier" && !curveSection);
      const openAxis =
        detail.group === "axis" ||
        (detail.group === "bezier" && Boolean(curveSection) && !detail.easingId);
      if (openBezier && easingTargets.length > 0) {
        setBezierOpen(true);
        raiseWindow("bezier");
      } else if (openAxis && curveSection) {
        setAxisOpen(true);
        raiseWindow("axis");
      } else {
        closeDockPlayers();
        setPanelOpen(true);
        raiseWindow("scene");
      }
      const group =
        detail.group &&
        detail.group !== "bezier" &&
        detail.group !== "curves" &&
        detail.group !== "axis"
          ? detail.group
          : undefined;
      if (group) {
        setOpenSections((prev) => new Set(prev).add(group));
      }
      if (detail.easingId) setActiveEasingId(detail.easingId);
    };
    window.addEventListener(PANEL_FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(PANEL_FOCUS_EVENT, onFocus);
  }, [curveSection, easingTargets.length, panelId]);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey && isPhysicalKey(event, SCENE_PANEL_CODES))) return;
      if (event.altKey || event.ctrlKey || event.shiftKey) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(
          "input, textarea, select, [contenteditable=true]",
        )
      ) {
        return;
      }

      event.preventDefault();
      setPanelInstant(true);
      setPanelOpen((open) => {
        if (!open) closeDockPlayers();
        return !open;
      });
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  useEffect(() => {
    if (!hideShortcut || !chromeVisible) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !isHideDockKey(event)) return;
      if (event.altKey || event.shiftKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable=true]")
      ) {
        return;
      }
      event.preventDefault();
      const hide = !dockHiddenRef.current;
      dockHiddenRef.current = hide;
      if (hide) {
        closeDockPlayers();
        setPanelOpen(false);
        setSettingsOpen(false);
        setBezierOpen(false);
        setAxisOpen(false);
        setSpringOpen(false);
      }
      setDockHidden(hide);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hideShortcut, chromeVisible]);

  useEffect(() => {
    if (easingTargets.length === 0) setBezierOpen(false);
    if (!curveSection) setAxisOpen(false);
    if (springTargets.length === 0) setSpringOpen(false);
  }, [curveSection, easingTargets.length, springTargets.length]);

  useEffect(() => {
    const list = playersRef.current;
    const sync = () =>
      setTimelineOpen(
        list.some((item) => item.controller.getState().open),
      );
    sync();
    if (list.length === 0) return;
    const unsubs = list.map((item) =>
      item.controller.subscribe(() => {
        sync();
      }),
    );
    return () => unsubs.forEach((unsub) => unsub());
  }, [dockPlayerKey]);

  useEffect(() => {
    if (timelineOpen) setPanelOpen(false);
  }, [timelineOpen]);

  const sectionVisible = (sectionId: string) => {
    if (sectionId === PANEL_SECTION_ID) return false;
    return filteredGroups.some((group) => group.id === sectionId);
  };
  const toggleSettings = () => {
    setPanelInstant(false);
    setSettingsOpen((open) => !open);
    if (!settingsOpen) raiseWindow("settings");
  };
  const toggleScene = () => {
    setPanelInstant(false);
    if (panelOpen) {
      setPanelOpen(false);
      return;
    }
    closeDockPlayers();
    setPanelOpen(true);
    raiseWindow("scene");
  };
  const toggleBezier = () => {
    setPanelInstant(false);
    setBezierOpen((open) => !open);
    if (!bezierOpen) raiseWindow("bezier");
  };
  const toggleAxis = () => {
    setPanelInstant(false);
    setAxisOpen((open) => !open);
    if (!axisOpen) raiseWindow("axis");
  };
  const toggleSpring = () => {
    setPanelInstant(false);
    setSpringOpen((open) => !open);
    if (!springOpen) raiseWindow("spring");
  };
  const panelScroll =
    "overflow-y-auto overscroll-y-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";
  const extraDockLeft = (id: ChromeWindowId) => {
    const rank = CHROME_WINDOW_IDS.indexOf(id);
    const index =
      (panelOpen && panelFloat == null ? 1 : 0) +
      (settingsOpen && rank > 0 ? 1 : 0) +
      (springOpen && rank > 1 ? 1 : 0) +
      (bezierOpen && rank > 2 ? 1 : 0);
    const dir = dockRight ? -1 : 1;
    const x = dockedX + dir * index * (frameW + PANEL_DOCK_GAP);
    const maxX = Math.max(DOCK_INSET, viewportW - frameW - DOCK_INSET);
    return Math.min(maxX, Math.max(DOCK_INSET, x));
  };
  chromeDockedXRef.current = extraDockLeft;
  const dockedWindowTop = dockBottom
    ? ("auto" as const)
    : shownPos.y + DOCK_BAR_H + PANEL_DOCK_GAP;
  const dockedWindowBottom = dockBottom
    ? viewportH - shownPos.y + PANEL_DOCK_GAP
    : ("auto" as const);
  const dockedOrigin = dockBottom
    ? dockCenter
      ? "origin-bottom"
      : dockRight
        ? "origin-bottom-right"
        : "origin-bottom-left"
    : dockCenter
      ? "origin-top"
      : dockRight
        ? "origin-top-right"
        : "origin-top-left";
  const extraMaxH = Math.max(
    PANEL_HEIGHT_MIN,
    dockBottom
      ? shownPos.y - PANEL_DOCK_GAP - DOCK_INSET
      : viewportH - shownPos.y - DOCK_BAR_H - PANEL_DOCK_GAP - DOCK_INSET,
  );
  const renderEasingEditor = (targets: typeof easingTargets) => (
    <div className="flex w-full flex-col gap-2">
      {targets.length > 1 ? (
        <PanelSelectList
          value={activeEasingId}
          options={targets.map((target) => ({
            id: target.id,
            label: tx(target.label, locale),
          }))}
          ariaLabel="Animation for easing"
          reduceMotion={reduceMotion}
          onChange={setActiveEasingId}
        />
      ) : null}
      <EasingPlayheadGate
        durationMs={getReplayDurationMs?.(activeEasingId) ?? 700}
        onReplay={
          onReplay && activeEasingId
            ? () => onReplay(activeEasingId)
            : undefined
        }
        reduceMotion={reduceMotion}
      >
        {(playhead) => (
          <div className="flex w-full flex-col gap-1">
            <div
              className={cn("w-full overflow-hidden rounded", fieldChrome)}
              style={{ background: FIELD }}
            >
              <EasingCurveEditor
                accent={panelTheme === "light" ? "#1a1a1a" : "#ffffff"}
                onChange={patchEasing}
                playhead={playhead}
                size={CURVE_SIZE}
                value={activeEasing}
              />
            </div>
            <BezierCoordsRow
              locale={locale}
              storageLabel={storageLabel}
              value={activeEasing}
              onChange={patchEasing}
            />
            <PanelSelectList
              value={easingPreset}
              options={presetOptions}
              ariaLabel={tx(PANEL_COPY.bezierPreset, locale)}
              reduceMotion={reduceMotion}
              optionIcon={(id) => (
                <PresetCurveIcon id={id} extras={easingPresetExtras} />
              )}
              onChange={(presetId) => {
                if (presetId === "custom") return;
                const easing = easingForPreset(presetId, easingPresetExtras);
                const parsed = easing ? parseBezierInput(easing) : null;
                if (parsed) patchEasing(parsed);
              }}
            />
          </div>
        )}
      </EasingPlayheadGate>
    </div>
  );

  const historyToast = (() => {
    if (transferToast != null) {
      return (
        <DockToast
          key={`transfer-${transferToast.id}`}
          below={!dockBottom}
          text={transferToast.text}
          detail={transferToast.detail}
          onDone={() => setTransferToast(null)}
        />
      );
    }
    const notice = history.notice;
    if (notice == null) return null;
    const { step, kind } = notice;
    const keys = Object.keys(step.after) as (keyof TSettings)[];
    const first = keys[0];
    if (first == null) return null;
    const show = (value: unknown) => {
      const text = typeof value === "string" ? value : JSON.stringify(value);
      return text.length > 24 ? `${text.slice(0, 23)}…` : text;
    };
    const single = step.label == null && keys.length === 1;
    const name =
      step.label ??
      labelsByKey(groups, players, locale).get(first) ??
      String(first);
    const [from, to] =
      kind === "undo"
        ? [step.after[first], step.before[first]]
        : [step.before[first], step.after[first]];
    return (
      <DockToast
        key={`history-${notice.id}`}
        below={!dockBottom}
        text={`${tx(kind === "undo" ? PANEL_COPY.undone : PANEL_COPY.redone, locale)} · ${name}`}
        detail={
          single
            ? `${show(from)} → ${show(to)}`
            : tx(PANEL_COPY.parameters(keys.length), locale)
        }
        hint={tx(
          kind === "undo"
            ? PANEL_COPY.redoHint(isAppleKeyboard())
            : PANEL_COPY.undoHint(isAppleKeyboard()),
          locale,
        )}
        onDone={history.clearNotice}
      />
    );
  })();

  if (!chromeVisible) return null;

  return (
    <div
      data-settings-panel=""
      data-panel-theme={panelTheme}
      data-panel-font={panelFont}
      data-dock-dragging={dockDragging ? "" : undefined}
      data-dock-corner={layoutCorner}
      className={cn(
        "pointer-events-auto fixed z-[100] font-sans text-left",
        dockDragging && "select-none",
      )}
      aria-hidden={dockHidden || undefined}
      style={{
        top: shownPos.y,
        left: shownPos.x,
        opacity: dockHidden ? 0 : 1,
        visibility: dockHidden ? "hidden" : "visible",
        ...(dockDragging || skipPanelMotion
          ? {}
          : {
              transitionProperty: "top, left, opacity, visibility",
              transitionDuration: `${PANEL_ENTER_MS}ms`,
              transitionTimingFunction: EASE_OUT,
            }),
      }}
    >
      <div className="relative flex flex-col items-start">
        <div
          ref={barRef}
          data-dock-bar=""
          className="relative z-10 flex items-center gap-1 rounded-lg border border-[color:var(--sp-line)] backdrop-blur-[8px] touch-none"
          style={{ background: GLASS, padding: DOCK_BAR_PAD }}
          onPointerDown={onDockPointerDown}
        >
          <button
            type="button"
            aria-expanded={settingsOpen}
            aria-controls={`${panelId}-settings`}
            aria-label={tx(
              settingsOpen
                ? PANEL_COPY.closePanelSettings
                : PANEL_COPY.openPanelSettings,
              locale,
            )}
            data-dock-tip={tx(PANEL_COPY.panelSettings, locale)}
            className={cn(
              dockBarButtonClass(settingsOpen),
              dockDragging && "cursor-grabbing active:scale-100",
            )}
            onClick={() => {
              if (dockMovedRef.current) return;
              toggleSettings();
            }}
          >
            <SfSymbol name="settings" className="size-5" />
          </button>
          <DockBarDivider />
          <DockBadgeAnchor>
          <button
            type="button"
            id={`${panelId}-trigger`}
            aria-expanded={panelOpen}
            aria-controls={panelId}
            aria-keyshortcuts={shortcut ? "Meta+M" : undefined}
            aria-label={
              panelOpen
                ? tx(PANEL_COPY.closePanel, locale)
                : changedCount > 0
                  ? tx(PANEL_COPY.openPanelChanged(changedCount), locale)
                  : tx(PANEL_COPY.openPanel, locale)
            }
            data-dock-tip={tx(PANEL_COPY.dockScene, locale)}
            className={cn(
              dockBarButtonClass(panelOpen),
              dockDragging && "cursor-grabbing active:scale-100",
            )}
            onClick={() => {
              if (dockMovedRef.current) return;
              toggleScene();
            }}
          >
            <SfSymbol name="sliders-horizontal" className="size-5" />
          </button>
          {changedBadge(panelOpen ? 0 : changedCount)}
          </DockBadgeAnchor>
          <DockBarSlot
            open={players.length > 0}
            reduceMotion={reduceMotion}
          >
            <TimelineToggleButton
              open={timelineOpen}
              locale={locale}
              onToggle={() => {
                if (timelineOpen) {
                  closeDockPlayers();
                  return;
                }
                setPanelInstant(false);
                setPanelOpen(false);
                openDockTimeline();
              }}
            />
          </DockBarSlot>
          <DockBarSlot
            open={
              hasSpringTargets || hasEasingTargets || Boolean(curveSection)
            }
            reduceMotion={reduceMotion}
          >
            <DockBarDivider />
          </DockBarSlot>
          <DockBarSlot open={hasSpringTargets} reduceMotion={reduceMotion}>
            <button
              type="button"
              aria-expanded={springOpen}
              aria-controls={`${panelId}-spring`}
              aria-label={tx(
                springOpen ? PANEL_COPY.closeSpring : PANEL_COPY.openSpring,
                locale,
              )}
              data-dock-tip={tx(PANEL_COPY.spring, locale)}
              className={cn(
                dockBarButtonClass(springOpen),
                dockDragging && "cursor-grabbing active:scale-100",
              )}
              onClick={() => {
                if (dockMovedRef.current) return;
                toggleSpring();
              }}
            >
              <SfSymbol name="activity" className="size-5" />
            </button>
          </DockBarSlot>
          <DockBarSlot
            open={hasEasingTargets}
            reduceMotion={reduceMotion}
          >
            <button
              type="button"
              aria-expanded={bezierOpen}
              aria-controls={`${panelId}-bezier`}
              aria-label={tx(
                bezierOpen ? PANEL_COPY.closeBezier : PANEL_COPY.openBezier,
                locale,
              )}
              data-dock-tip={tx(PANEL_COPY.bezierCurve, locale)}
              className={cn(
                dockBarButtonClass(bezierOpen),
                dockDragging && "cursor-grabbing active:scale-100",
              )}
              onClick={() => {
                if (dockMovedRef.current) return;
                toggleBezier();
              }}
            >
              <SfSymbol name="spline" className="size-5" />
            </button>
          </DockBarSlot>
          <DockBarSlot open={Boolean(curveSection)} reduceMotion={reduceMotion}>
            <button
              type="button"
              aria-expanded={axisOpen}
              aria-controls={`${panelId}-axis`}
              aria-label={tx(
                axisOpen ? PANEL_COPY.closeAxis : PANEL_COPY.openAxis,
                locale,
              )}
              data-dock-tip={tx(PANEL_COPY.axisCurve, locale)}
              className={cn(
                dockBarButtonClass(axisOpen),
                dockDragging && "cursor-grabbing active:scale-100",
              )}
              onClick={() => {
                if (dockMovedRef.current) return;
                toggleAxis();
              }}
            >
              <SfSymbol name="waypoints" className="size-5" />
            </button>
          </DockBarSlot>
          <DockBarSlot open={Boolean(dockExtra)} reduceMotion={reduceMotion}>
            <div data-dock-extra="" className="contents">
              {dockExtra}
            </div>
          </DockBarSlot>
          <DockBarDivider />
          {onReset ? (
            <DockBarSlot
              open={Boolean(dockActionsVisible)}
              reduceMotion={reduceMotion}
            >
              <button
                type="button"
                aria-label={tx(PANEL_COPY.resetSettings(changedCount), locale)}
                data-dock-tip={tx(PANEL_COPY.dockReset, locale)}
                className={dockBarButtonClass()}
                onClick={() => {
                  if (Object.keys(sectionIcons).length > 0) {
                    setSectionIcons({});
                    writePanelSettings(panelId, { sectionIcons: {} });
                  }
                  if (defaultSettings != null) {
                    const before = {} as Partial<TSettings>;
                    const after = {} as Partial<TSettings>;
                    for (const key of pageKeys) {
                      if (!changes.settingDiffers(key)) continue;
                      before[key] = settings[key];
                      after[key] = defaultSettings[key];
                    }
                    history.push(
                      before,
                      after,
                      tx(PANEL_COPY.resetStep, locale),
                    );
                  }
                  onReset();
                }}
              >
                <SfSymbol name="eraser" className="size-5" />
              </button>
              {defaultSettings != null ? (
                <DockBadgeAnchor>
                <button
                  type="button"
                  aria-label={
                    copiedChanges
                      ? tx(PANEL_COPY.copyDefaultsDone, locale)
                      : tx(PANEL_COPY.copyDefaults(changedCount), locale)
                  }
                  data-dock-tip={tx(PANEL_COPY.dockCopy, locale)}
                  className={dockBarButtonClass()}
                  onClick={copyChangedSettings}
                >
                  <SfSymbol
                    name={copiedChanges ? "check" : "file"}
                    className="size-5"
                  />
                </button>
                {changedBadge(changedCount)}
                </DockBadgeAnchor>
              ) : null}
            </DockBarSlot>
          ) : null}
          <DockSearchField
            open={searchOpen}
            query={searchQuery}
            filterLabel={
              changedFilterActive
                ? tx(PANEL_COPY.changedFilter(changedCount), locale)
                : undefined
            }
            locale={locale}
            onOpen={() => {
              setSearchOpen(true);
            }}
            onQuery={(value) => {
              setChangedOnly(false);
              setSearchQuery(value);
              if (!value.trim()) return;
              closeDockPlayers();
              setPanelOpen(true);
              raiseWindow("scene");
            }}
            onClose={closeSearch}
          />
        </div>
        <DockBarTips
          barRef={barRef}
          disabled={dockDragging}
          side={dockBottom ? "above" : "below"}
        />
        {historyToast}

        {(() => {
        const panelWindow = (
        <div
          id={panelId}
          data-settings-panel=""
          data-settings-panel-window=""
          data-panel-theme={panelTheme}
          data-panel-font={panelFont}
          role="region"
          aria-label={`${storageLabel} animation settings`}
          aria-roledescription={tx(PANEL_COPY.movePanel, locale)}
          aria-hidden={!panelOpen}
          inert={panelOpen ? undefined : true}
          onPointerDown={startPanelMove}
          className={cn(
            "flex min-h-0 flex-col gap-0 overflow-hidden rounded-lg border border-[color:var(--sp-line)] font-sans text-left backdrop-blur-[8px]",
            "fixed",
            panelFloat == null
              ? dockBottom
                ? dockCenter
                  ? "origin-bottom"
                  : dockRight
                    ? "origin-bottom-right"
                    : "origin-bottom-left"
                : dockCenter
                  ? "origin-top"
                  : dockRight
                    ? "origin-top-right"
                    : "origin-top-left"
              : "origin-center",
            panelPopClassName({
              open: panelOpen,
              fromBottom: dockBottom,
              skip: skipPanelMotion,
            }),
            (panelResizing || panelMoving) && "select-none",
            panelMoving && "cursor-grabbing",
          )}
          style={{
            background: GLASS,
            zIndex: windowZ.scene ?? 100,
            width: frameW,
            maxHeight: frameH ?? maxPanelH,
            height: "auto",
            ...(panelFloat != null
              ? {
                  left: panelFloat.x,
                  top: panelFloat.y,
                  right: "auto",
                  bottom: "auto",
                  margin: 0,
                }
              : {
                  left: dockedX,
                  top: dockBottom
                    ? "auto"
                    : shownPos.y + DOCK_BAR_H + PANEL_DOCK_GAP,
                  right: "auto",
                  bottom: dockBottom
                    ? viewportH - shownPos.y + PANEL_DOCK_GAP
                    : "auto",
                  margin: 0,
                }),
            ...panelPopStyle({
              open: panelOpen,
              skip: skipPanelMotion || panelMoving || panelResizing,
            }),
          }}
        >
          {panelMounted ? (() => {
          const renderGroupSectionItem = (
            group: SettingsGroup<TSettings>,
            section: SettingsSection<TSettings>,
            orderKey: string,
          ): ReactNode => {
            const subsectionId = `${group.id}:${orderKey}`;
            const sectionTitle = tx(section.title, locale);
            const rows = (
              <div className="flex flex-col gap-2">
                {sectionHasRows(section) ? (
                  <SectionRows
                    section={section}
                    settings={settings}
                    onSettingsChange={(patch) => {
                      onSettingsChange(patch);
                      markRowEdited(
                        group.id,
                        section.untitled ? undefined : copyKey(section.title),
                      );
                    }}
                    reduceMotion={reduceMotion}
                    locale={locale}
                    numberDefault={numberDefault}
                    dotFor={rowDotFor}
                    dotForKeys={rowDotForKeys}
                    rowIndex={rowIndex}
                    onEditEasing={(easingId) =>
                      focusPanel(panelId, { easingId })
                    }
                  />
                ) : null}
              </div>
            );
            if (section.untitled) {
              return (
                <div key={orderKey} data-subsection-title={orderKey}>
                  {rows}
                </div>
              );
            }
            return (
              <SubsectionBlock
                key={orderKey}
                title={sectionTitle}
                orderKey={orderKey}
                locale={locale}
                plain={false}
                open={narrowActive || !closedSubsections.has(subsectionId)}
                onToggle={() => {
                  if (skipSubsectionToggleRef.current) {
                    skipSubsectionToggleRef.current = false;
                    return;
                  }
                  toggleSubsection(subsectionId);
                }}
                dragging={draggingSubsection === orderKey}
                float={
                  draggingSubsection === orderKey ? subsectionFloat : null
                }
                floatRef={
                  draggingSubsection === orderKey
                    ? subsectionFloatElRef
                    : undefined
                }
                xyRef={
                  draggingSubsection === orderKey ? subsectionXyRef : undefined
                }
                theme={panelTheme}
                {...withPanelIcon(
                  subsectionIconKey(group.id, orderKey),
                  section.icon,
                )}
                reorderable={group.sections.length > 1}
                onGripPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.stopPropagation();
                  const block = event.currentTarget.closest(
                    "[data-subsection-title]",
                  );
                  if (!(block instanceof HTMLElement)) return;
                  const rect = block.getBoundingClientRect();
                  subsectionDragRef.current = {
                    groupId: group.id,
                    title: orderKey,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    originX: rect.left,
                    offsetY: event.clientY - rect.top,
                    width: rect.width,
                    height: rect.height,
                    moved: false,
                  };
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDraggingSubsection(orderKey);
                }}
                reduceMotion={reduceMotion}
                visibilityOn={
                  section.visibilityKey != null
                    ? Boolean(settings[section.visibilityKey])
                    : undefined
                }
                onVisibilityChange={
                  section.visibilityKey != null
                    ? (next) =>
                        onSettingsChange({
                          [section.visibilityKey!]: next,
                        } as Partial<TSettings>)
                    : undefined
                }
              >
                {rows}
              </SubsectionBlock>
            );
          };
          const renderOrderedSection = (
            sectionId: string,
            dividerBefore: boolean,
          ) => {
            const shell = (node: ReactNode) => (
              <Fragment key={sectionId}>
                {dividerBefore ? <SectionDivider /> : null}
                <ReorderShell
                  dragging={draggingSection === sectionId}
                  float={
                    draggingSection === sectionId ? sectionFloat : null
                  }
                  floatRef={
                    draggingSection === sectionId
                      ? sectionFloatElRef
                      : undefined
                  }
                  xyRef={
                    draggingSection === sectionId ? sectionXyRef : undefined
                  }
                  id={sectionId}
                  theme={panelTheme}
                >
                  {node}
                </ReorderShell>
              </Fragment>
            );
            if (sectionId === PRESETS_SECTION_ID) {
              return shell(
          <section
            data-panel-move=""
            className="flex w-full shrink-0 p-2"
          >
            <div
              className="flex h-[28px] min-w-0 w-full items-center justify-between gap-4"
              data-setting-row=""
            >
              <span className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                aria-label={tx(PANEL_COPY.savePreset, locale)}
                onClick={saveCurrentToPreset}
                className={cn(
                  "inline-flex size-5 shrink-0 items-center justify-center outline-none",
                  "text-[color:var(--sp-fg)]",
                  "fine-hover:hover:text-[color:var(--sp-muted)]",
                  "focus-visible:ring-1 focus-visible:ring-[color:var(--sp-line-focus)]",
                )}
              >
                <SfSymbol name="save" className="size-5" />
              </button>
              <RowLabel
                label={tx(PANEL_COPY.presets, locale)}
                info={tx(PANEL_COPY.presetsInfo, locale)}
              />
              </span>
            <div className="flex shrink-0 items-center gap-1">
            <SettingsTransferMenu
              locale={locale}
              done={transfer.linkCopied}
              onCopyLink={() => void transfer.copyLink()}
              onSaveFile={transfer.saveFile}
              onOpenFile={(file) => void transfer.openFile(file)}
            />
            <div
              role="group"
              aria-label={tx(PANEL_COPY.presetsAria, locale)}
              className={cn(
                "grid h-[28px] shrink-0 grid-cols-[28px_1px_28px_1px_28px]",
                pickerChrome,
              )}
              style={{ width: SNAPSHOT_TRACK_W }}
            >
              {Array.from({ length: SNAPSHOT_SLOTS }, (_, index) => {
                const filled = snapshots[index] != null;
                const active = filled && activeSnapshot === index;
                const drifted = active && snapshotDrifted(index);
                const cell = (
                  <div key={index} className="group/slot relative">
                    <button
                      type="button"
                      aria-label={tx(
                        PANEL_COPY.presetSlot(
                          index + 1,
                          filled
                            ? active
                              ? "active"
                              : "apply"
                            : "empty",
                        ),
                        locale,
                      )}
                      onClick={(event) => {
                        if (!filled || event.altKey) saveSnapshot(index);
                        else applySnapshot(index);
                      }}
                      className={cn(
                        "flex size-[28px] items-center justify-center font-mono text-[12px] leading-none tabular-nums outline-none",
                        pickEase,
                        active ? pickActive : pickIdle,
                      )}
                    >
                      {index + 1}
                    </button>
                    {drifted ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute top-[3px] right-[3px] size-[5px] rounded-full bg-[color:var(--sp-fg)] group-hover/slot:opacity-0"
                      />
                    ) : null}
                    {filled ? (
                      <button
                        type="button"
                        aria-label={tx(
                          PANEL_COPY.clearPreset(index + 1),
                          locale,
                        )}
                        onClick={() => clearSnapshot(index)}
                        className="absolute top-0 right-0 z-[1] hidden size-[11px] items-center justify-center rounded-bl bg-[color:var(--sp-knob)] text-[10px] leading-none text-[color:var(--sp-field)] outline-none fine-hover:group-hover/slot:flex"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                );
                if (index === SNAPSHOT_SLOTS - 1) return [cell];
                return [
                  cell,
                  <div
                    key={`rule-${index}`}
                    aria-hidden
                    className="bg-[color:var(--sp-fill-strong)]"
                  />,
                ];
              })}
            </div>
            <DockFoldButton
              collapse={canCollapseAll}
              locale={locale}
              onToggle={toggleFoldAll}
            />
            </div>
            </div>
          </section>
              );
            }
            const group = filteredGroups.find((item) => item.id === sectionId);
            if (!group) return null;
            return shell(
            <SectionBlock
              {...sectionIconProps(group.id, group.icon)}
              title={tx(group.title, locale)}
              open={narrowActive || openSections.has(group.id)}
              onToggle={() => toggleSection(group.id)}
              reduceMotion={reduceMotion}
              locale={locale}
              {...sectionReorderProps(group.id)}
              visibilityOn={
                group.visibilityKey != null
                  ? Boolean(settings[group.visibilityKey])
                  : undefined
              }
              onVisibilityChange={
                group.visibilityKey != null
                  ? (next) =>
                      onSettingsChange({
                        [group.visibilityKey!]: next,
                      } as Partial<TSettings>)
                  : undefined
              }
              headerAction={group.headerAction}
            >
              <div
                className="flex flex-col gap-4"
                data-subsection-group={group.id}
              >
                {mergeSectionOrder(
                  group.sections.map((section) => copyKey(section.title)),
                  subsectionOrder[group.id],
                ).map((orderKey) => {
                  const section = group.sections.find(
                    (item) => copyKey(item.title) === orderKey,
                  );
                  if (!section) return null;
                  return renderGroupSectionItem(
                    group,
                    section,
                    orderKey,
                  );
                })}
              </div>
            </SectionBlock>
            );
          };
          const visibleTop = narrowActive
            ? sectionRails.top.filter(sectionVisible)
            : [PRESETS_SECTION_ID, ...sectionRails.top.filter(sectionVisible)];
          const visibleMid = sectionRails.mid.filter(sectionVisible);
          const searchMiss =
            searchQueryActive &&
            visibleTop.length === 0 &&
            visibleMid.length === 0;
          return (
          <div
            className="grid min-h-0 w-full grid-rows-[auto_minmax(0,auto)] overflow-hidden"
            data-section-list=""
          >
            <div className="relative z-[1] shrink-0">
              {visibleTop.map((id, i) =>
                renderOrderedSection(id, i > 0),
              )}
              {visibleTop.length > 0 && visibleMid.length > 0 ? (
                <SectionDivider />
              ) : null}
            </div>
            <div className={cn("min-h-0", panelScroll)}>
              {searchMiss ? (
                <p
                  className="px-2 py-2 text-[13px] leading-[18px]"
                  style={{ color: MUTED }}
                >
                  {tx(PANEL_COPY.searchEmpty, locale)}
                </p>
              ) : null}
              {visibleMid.map((id, i) =>
                renderOrderedSection(id, i > 0),
              )}
            </div>
          </div>
          );
          })() : null}
          {panelOpen ? (
            <>
              <div
                data-panel-move=""
                className={cn(
                  "absolute z-[2] cursor-grab touch-none select-none active:cursor-grabbing",
                  "left-2 right-2",
                  dockBottom ? "top-1.5" : "top-0",
                )}
                style={{ height: PANEL_MOVE_EDGE }}
              />
              <button
                type="button"
                data-panel-resize="x"
                aria-label={tx(PANEL_COPY.resizePanelWidth, locale)}
                className={cn(
                  "absolute z-[3] touch-none",
                  dockRight ? "left-0" : "right-0",
                  "top-2 bottom-2",
                )}
                style={{ width: PANEL_RESIZE_HIT }}
                onPointerDown={startPanelResize("x")}
              />
              <button
                type="button"
                data-panel-resize="y"
                aria-label={tx(PANEL_COPY.resizePanelHeight, locale)}
                className={cn(
                  "absolute z-[3] touch-none",
                  dockBottom ? "top-0" : "bottom-0",
                  "left-2 right-2",
                )}
                style={{ height: PANEL_RESIZE_HIT }}
                onPointerDown={startPanelResize("y")}
              />
              <button
                type="button"
                data-panel-resize={
                  dockRight === dockBottom ? "xy-nwse" : "xy-nesw"
                }
                aria-label={tx(PANEL_COPY.resizePanelCorner, locale)}
                className={cn(
                  "absolute z-[4] touch-none",
                  dockRight ? "left-0" : "right-0",
                  dockBottom ? "top-0" : "bottom-0",
                )}
                style={{
                  width: PANEL_RESIZE_HIT + 4,
                  height: PANEL_RESIZE_HIT + 4,
                }}
                onPointerDown={startPanelResize("xy")}
              />
            </>
          ) : null}

        </div>
        );
        return windowHost
          ? createPortal(panelWindow, windowHost)
          : panelWindow;
        })()}
        {windowHost
          ? createPortal(
              <DockedChromeWindow
                id={`${panelId}-settings`}
                open={settingsOpen}
                mounted={settingsMounted}
                label={tx(PANEL_COPY.panelSettings, locale)}
                left={extraDockLeft("settings")}
                top={dockedWindowTop}
                bottom={dockedWindowBottom}
                fromBottom={dockBottom}
                origin={dockedOrigin}
                skip={reduceMotion}
                theme={panelTheme}
                font={panelFont}
                width={frameW}
                maxHeight={extraMaxH}
                locale={locale}
                float={chromeFloat.settings}
                moving={chromeMoving === "settings"}
                zIndex={windowZ.settings ?? 100}
                onPointerDown={startChromeMove("settings")}
              >
                <ChromeViewSection
                  icon="settings"
                  title={tx(PANEL_COPY.panelSettings, locale)}
                  locale={locale}
                  onClose={() => setSettingsOpen(false)}
                  closeLabel={tx(PANEL_COPY.closePanelSettings, locale)}
                >
                  <div className="flex flex-col gap-2">
                    <SettingToggle
                      label={tx(PANEL_COPY.language, locale)}
                      control="segment"
                      offLabel="Ru"
                      onLabel="Eng"
                      onChange={(en) => persistLocale(en ? "en" : "ru")}
                      value={locale === "en"}
                    />
                    <SettingToggle
                      label={tx(PANEL_COPY.theme, locale)}
                      control="segment"
                      offLabel="Light"
                      onLabel="Dark"
                      offIcon="sun"
                      onIcon="moon"
                      onChange={(dark) =>
                        persistPanelTheme(dark ? "dark" : "light")
                      }
                      value={panelTheme === "dark"}
                    />
                    <SettingEnumDropdown
                      label={tx(PANEL_COPY.panelFont, locale)}
                      info={tx(PANEL_COPY.panelFontInfo, locale)}
                      locale={locale}
                      reduceMotion={reduceMotion}
                      value={panelFont}
                      onChange={(id) => {
                        if (isPanelFont(id)) persistFont(id);
                      }}
                      options={PANEL_FONTS.map((id) => ({
                        value: id,
                        label: tx(PANEL_FONT_LABEL[id], locale),
                      }))}
                    />
                    <SettingToggle
                      label={tx(PANEL_COPY.chromeLayout, locale)}
                      locale={locale}
                      control="action"
                      offLabel={tx(PANEL_COPY.resetChromeLayout, locale)}
                      onLabel={tx(PANEL_COPY.resetChromeLayout, locale)}
                      onChange={() => resetChromeLayout()}
                      value={false}
                    />
                    <ChromeHintRow
                      label={tx(PANEL_COPY.version, locale)}
                      value={PANEL_VERSION}
                      locale={locale}
                    />
                    {hideShortcut || undoShortcut ? (
                      <SubsectionBlock
                        title={tx(PANEL_COPY.hotkeys, locale)}
                        orderKey="Хоткеи"
                        locale={locale}
                        plain={false}
                        open={hotkeysOpen}
                        onToggle={() => setHotkeysOpen((open) => !open)}
                        dragging={false}
                        float={null}
                        theme={panelTheme}
                        reorderable={false}
                        onGripPointerDown={() => {}}
                        reduceMotion={reduceMotion}
                      >
                        <div className="flex flex-col gap-2">
                          {hideShortcut ? (
                            <ChromeHintRow
                              label={tx(PANEL_COPY.shortcutHideDock, locale)}
                              value={shortcutKeys("hideDock")}
                              locale={locale}
                              mono={false}
                            />
                          ) : null}
                          {undoShortcut ? (
                            <>
                              <ChromeHintRow
                                label={tx(PANEL_COPY.shortcutUndo, locale)}
                                value={shortcutKeys("undo")}
                                locale={locale}
                                mono={false}
                              />
                              <ChromeHintRow
                                label={tx(PANEL_COPY.shortcutRedo, locale)}
                                value={shortcutKeys("redo")}
                                locale={locale}
                                mono={false}
                              />
                            </>
                          ) : null}
                        </div>
                      </SubsectionBlock>
                    ) : null}
                  </div>
                </ChromeViewSection>
              </DockedChromeWindow>,
              windowHost,
            )
          : null}
        {windowHost && hasSpringTargets && activeSpring
          ? createPortal(
              <DockedChromeWindow
                id={`${panelId}-spring`}
                open={springOpen}
                mounted={springMounted}
                label={tx(PANEL_COPY.spring, locale)}
                left={extraDockLeft("spring")}
                top={dockedWindowTop}
                bottom={dockedWindowBottom}
                fromBottom={dockBottom}
                origin={dockedOrigin}
                skip={reduceMotion}
                theme={panelTheme}
                font={panelFont}
                width={frameW}
                maxHeight={extraMaxH}
                locale={locale}
                float={chromeFloat.spring}
                moving={chromeMoving === "spring"}
                zIndex={windowZ.spring ?? 100}
                onPointerDown={startChromeMove("spring")}
              >
                <ChromeViewSection
                  icon="activity"
                  title={tx(PANEL_COPY.spring, locale)}
                  locale={locale}
                  modified={springDot?.modified}
                  onResetValue={springDot?.onResetValue}
                  onClose={() => setSpringOpen(false)}
                  closeLabel={tx(PANEL_COPY.closeSpring, locale)}
                >
                  <div className="flex w-full flex-col gap-2">
                    {springTargets.length > 1 ? (
                      <PanelSelectList
                        value={activeSpringId}
                        options={springTargets.map((target) => ({
                          id: target.id,
                          label: tx(target.label, locale),
                        }))}
                        ariaLabel={tx(PANEL_COPY.spring, locale)}
                        reduceMotion={reduceMotion}
                        onChange={setActiveSpringId}
                      />
                    ) : null}
                    <SpringEditor
                      value={activeSpring}
                      defaultValue={changes.defaultSprings?.[activeSpringId]}
                      onChange={patchSpring}
                      accent={panelTheme === "light" ? "#1a1a1a" : "#ffffff"}
                      locale={locale}
                      reduceMotion={reduceMotion}
                    />
                  </div>
                </ChromeViewSection>
              </DockedChromeWindow>,
              windowHost,
            )
          : null}
        {windowHost && hasEasingTargets
          ? createPortal(
              <DockedChromeWindow
                id={`${panelId}-bezier`}
                open={bezierOpen}
                mounted={bezierMounted}
                label={tx(easingSectionTitle ?? PANEL_COPY.bezierCurve, locale)}
                left={extraDockLeft("bezier")}
                top={dockedWindowTop}
                bottom={dockedWindowBottom}
                fromBottom={dockBottom}
                origin={dockedOrigin}
                skip={reduceMotion}
                theme={panelTheme}
                font={panelFont}
                width={frameW}
                maxHeight={extraMaxH}
                locale={locale}
                float={chromeFloat.bezier}
                moving={chromeMoving === "bezier"}
                zIndex={windowZ.bezier ?? 100}
                onPointerDown={startChromeMove("bezier")}
              >
                <ChromeViewSection
                  icon="spline"
                  title={tx(
                    easingSectionTitle ?? PANEL_COPY.bezierCurve,
                    locale,
                  )}
                  locale={locale}
                  modified={easingDot?.modified}
                  onResetValue={easingDot?.onResetValue}
                  onClose={() => setBezierOpen(false)}
                  closeLabel={tx(PANEL_COPY.closeBezier, locale)}
                >
                  {renderEasingEditor(easingTargets)}
                </ChromeViewSection>
              </DockedChromeWindow>,
              windowHost,
            )
          : null}
        {windowHost && curveSection
          ? createPortal(
              <DockedChromeWindow
                id={`${panelId}-axis`}
                open={axisOpen}
                mounted={axisMounted}
                label={curveTitle}
                left={extraDockLeft("axis")}
                top={dockedWindowTop}
                bottom={dockedWindowBottom}
                fromBottom={dockBottom}
                origin={dockedOrigin}
                skip={reduceMotion}
                theme={panelTheme}
                font={panelFont}
                width={frameW}
                maxHeight={extraMaxH}
                locale={locale}
                float={chromeFloat.axis}
                moving={chromeMoving === "axis"}
                zIndex={windowZ.axis ?? 100}
                onPointerDown={startChromeMove("axis")}
              >
                <ChromeViewSection
                  icon={curveSectionIcon}
                  title={curveTitle}
                  locale={locale}
                  modified={curveDot?.modified}
                  onResetValue={curveDot?.onResetValue}
                  onClose={() => setAxisOpen(false)}
                  closeLabel={tx(PANEL_COPY.closeAxis, locale)}
                >
                  {curveSection}
                </ChromeViewSection>
              </DockedChromeWindow>,
              windowHost,
            )
          : null}
      </div>
    </div>
  );
}
