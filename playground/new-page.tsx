import { useEffect, useMemo, useRef, useState } from "react";
import { PageBar } from "./page-bar";
import { useSettingsHistory } from "../src/settings-panel/use-history";
import {
  layoutClips,
  PANEL_VERSION,
  parseSkipCells,
  sampleAxisX,
  serializeSkipCells,
  useLocalSettingsStore,
  usePanelStyle,
  waapiSpan,
  writePanelStyle,
} from "../src";
import { cubicBezierToCss } from "../src/lib/cubic-bezier";
import { evalNumberExpression } from "../src/lib/eval-number-expression";
import { usePrefersReducedMotion } from "../src/lib/prefers-reduced-motion";
import { barClip } from "./bar-times";
import { TransitionPlayer } from "../src/lib/transition-player";
import { springCssTransition } from "../src/lib/spring";
import type { AxisHandle, AxisPoint } from "../src/lib/axis-curve";
import { COPY_DONE_MS, PANEL_EXIT_MS } from "../src/settings-panel/chrome";
import { tx } from "../src/settings-panel/locale";
import { panelPopClassName, panelPopStyle } from "../src/settings-panel/motion-ui";
import { PairGlyph } from "../src/settings-panel/number";
import { SectionCollapse, useDeferredMount } from "../src/settings-panel/row";
import { DEFAULTS, P, store, type PlaygroundSettings as S } from "./params";
import { MODULE_ROWS, PANEL_ID } from "./schema";
import {
  AnchorPick,
  AxisWindow,
  ChangedName,
  ColorPicker,
  CommandMark,
  DockAnchorContext,
  DockButton,
  DockedWindows,
  FloatWindow,
  FloatingMenu,
  GapChips,
  IconPick,
  KeyCap,
  Menu,
  MotionWindow,
  NEW_PANEL_H_MIN,
  NEW_PANEL_W_MAX,
  NEW_PANEL_W_MIN,
  ORIENT_RATIO,
  PANEL_INK,
  PANEL_PAPER,
  PANEL_SECTION_IDS,
  PanelIcon,
  PanelLocale,
  ParametersPanel,
  PickGlyph,
  Pop,
  Row,
  RowHint,
  ScreenDock,
  Section,
  SectionFoldContext,
  Segment,
  Sortable,
  StepMark,
  Toast,
  Track,
  ValueField,
  formatColor,
  hexAlpha,
  hexToHsva,
  hsvaToRgb,
  panelHeightCap,
  parseColorInput,
  rgbToHex,
  rowLabel,
  trimNum,
  useScrollRoot,
  type ColorFormat,
  type DockAnchor,
  type Hsva,
  type Point,
} from "../src/settings-panel/kit-ui";

const AREAL_STACK = '"ABC Areal Variable", "ABC Areal", "Geist", ui-sans-serif, system-ui, sans-serif';
const VOID = PANEL_INK;
const SILVER = PANEL_PAPER;

function settingLabel(key: string, locale: "ru" | "en") {
  if (!(key in P)) return key;
  const row = P[key as keyof typeof P];
  return "label" in row && row.label ? tx(row.label, locale) : key;
}

export function NewPage() {
  const [settings, setSettings] = useLocalSettingsStore(store);
  const history = useSettingsHistory<S>({
    settings,
    onSettingsChange: (next) => setSettings((prev) => ({ ...prev, ...next })),
    enabled: true,
  });
  const patch = (next: Partial<S>) => history.record(next);
  const d = DEFAULTS;
  const [open, setOpen] = useState(true);
  const [motionOpen, setMotionOpen] = useState(false);
  const [motionType, setMotionType] = useState<"easing" | "physics">("easing");
  const [axisOpen, setAxisOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scrubKey, setScrubKey] = useState<null | "cardSize" | "radius" | "strokeWidth">(null);
  const [picker, setPicker] = useState<"background" | "grid" | "card" | "stroke" | "text">("background");
  const [pickerDraft, setPickerDraft] = useState<Hsva | null>(null);
  const [format, setFormat] = useState<ColorFormat>("hex");
  const [capOpen, setCapOpen] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(1);
  const [locale, setLocale] = useState<"ru" | "en">("ru");
  const panelStyle = usePanelStyle(PANEL_ID);
  const [theme, setTheme] = useState<"sun" | "moon">("sun");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [changedOnly, setChangedOnly] = useState(false);
  const [placeEpoch, setPlaceEpoch] = useState(0);
  const [dockAnchor, setDockAnchor] = useState<DockAnchor | null>(null);
  const [panelW, setPanelW] = useState(NEW_PANEL_W_MIN);
  const [panelH, setPanelH] = useState<number | null>(null);
  const [closedSections, setClosedSections] = useState<Set<string>>(() => new Set());
  const canCollapseAll = PANEL_SECTION_IDS.some((id) => !closedSections.has(id));
  function toggleSection(id: string) {
    setClosedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleFoldAll() {
    setClosedSections(canCollapseAll ? new Set(PANEL_SECTION_IDS) : new Set());
  }
  const [copied, setCopied] = useState<null | "file" | "link">(null);
  const [toast, setToast] = useState<{ id: number; text: string; detail?: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const capAnchor = useRef<HTMLDivElement>(null);
  const colorKey = picker === "grid" && !settings.showLayoutGrid ? "background" : picker;
  const panelScrollRef = useScrollRoot();
  const cardRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const timelineHold = useRef(true);
  const [player] = useState(
    () =>
      new TransitionPlayer({
        id: "reel",
        reduceMotion: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        build: () => {
          const s = settingsRef.current;
          const total = Math.max(1, s.reelTotalMs);
          if (!timelineHold.current) return { animations: [], totalMs: total };
          const card = cardRef.current;
          const bars = [...(barsRef.current?.children ?? [])] as HTMLElement[];
          const [inClip] = layoutClips([{ duration: s.reelInMs, start: s.reelInStartMs }]);
          if (!card || !inClip) return { animations: [], totalMs: total };
          return {
            totalMs: total,
            phases: [0, ...bars.map((_, index) => index + 1)],
            animations: [
              card.animate([{ transform: "none" }, { transform: "translateY(-16px) scale(1.06)" }], {
                ...waapiSpan(inClip.start + s.cardLead, inClip.duration, total),
                easing: cubicBezierToCss(s.easings.card ?? { x1: 0.22, y1: 1, x2: 0.36, y2: 1 }),
              }),
              ...bars.map((bar, index) => {
                const clip = barClip(s.barTimes, index);
                return bar.animate([{ transform: "scaleX(0.3)" }, { transform: "scaleX(1)" }], {
                  ...waapiSpan(clip.start, clip.duration, total),
                  easing: cubicBezierToCss(s.easings.bars ?? { x1: 0.65, y1: 0, x2: 0.35, y2: 1 }),
                });
              }),
            ],
          };
        },
      }),
  );
  const reduce = usePrefersReducedMotion();
  const panelMounted = useDeferredMount(open, reduce, PANEL_EXIT_MS);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => () => player.dispose(), [player]);
  useEffect(() => {
    timelineHold.current = true;
    player.setOpen(true);
    player.rebuild();
  }, [player]);
  useEffect(() => {
    player.rebuild();
  }, [player, settings]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme === "moon" ? "dark" : "light";
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  useEffect(() => {
    const root = document.body;
    const palette = document.documentElement;
    root.style.fontFamily = AREAL_STACK;
    palette.style.setProperty("--color-black", VOID);
    palette.style.setProperty("--color-white", SILVER);
    return () => {
      root.style.fontFamily = "";
      palette.style.removeProperty("--color-black");
      palette.style.removeProperty("--color-white");
    };
  }, []);

  const searchFiltering = useRef(false);
  useEffect(() => {
    const root = panelScrollRef.el;
    if (!root) return;
    const query = searchQuery.trim().toLowerCase();
    const changedFilter = searchOpen && changedOnly && query.length === 0;
    const filtering = searchOpen && (query.length > 0 || changedFilter);
    if (!filtering) {
      if (searchFiltering.current) {
        for (const node of root.querySelectorAll<HTMLElement>("[data-row], [data-section], [data-sort-id]")) {
          node.hidden = false;
        }
      }
      searchFiltering.current = false;
      return;
    }
    searchFiltering.current = true;
    if (query.length >= 2) {
      const paletteLabels = [
        locale === "en" ? "palette" : "палитра",
        tx(P.backgroundColor.label, locale),
        tx(P.gridLineColor.label, locale),
        tx(P.cardColor.label, locale),
        tx(P.strokeColor.label, locale),
        tx(P.textColor.label, locale),
      ].map((label) => label.toLowerCase());
      if (paletteLabels.some((label) => label.includes(query))) setPaletteOpen(true);
    }
    for (const row of root.querySelectorAll<HTMLElement>("[data-row]")) {
      const text = row.textContent?.toLowerCase() ?? "";
      const matchesQuery = query.length === 0 || text.includes(query);
      const matchesChanged = !changedFilter || row.dataset.changed === "true";
      row.hidden = !matchesQuery || !matchesChanged;
      const slot = row.closest<HTMLElement>("[data-sort-id]");
      if (slot && slot.querySelector("[data-row]") === row) slot.hidden = row.hidden;
    }
    for (const section of root.querySelectorAll<HTMLElement>("[data-section]")) {
      const title = section.getAttribute("data-section")?.toLowerCase() ?? "";
      const rows = [...section.querySelectorAll<HTMLElement>("[data-row]")];
      if (query.length > 0 && title.includes(query)) {
        for (const row of rows) {
          row.hidden = false;
          const slot = row.closest<HTMLElement>("[data-sort-id]");
          if (slot) slot.hidden = false;
        }
      }
      const filtering = query.length > 0 || changedFilter;
      const titleHit = query.length > 0 && title.includes(query);
      section.hidden =
        filtering &&
        !titleHit &&
        section.dataset.changed !== "true" &&
        rows.every((row) => row.hidden);
      const slot = section.parentElement;
      if (slot?.hasAttribute("data-sort-id")) slot.hidden = section.hidden;
    }
  }, [searchQuery, searchOpen, changedOnly, panelScrollRef.el, open, settings, locale]);

  const cardCurve = settings.easings.card ?? d.easings.card;
  const hover = settings.springs.hover ?? d.springs.hover;
  const hoverMotion = useMemo(
    () => springCssTransition(hover),
    [hover.stiffness, hover.damping, hover.mass],
  );
  const curve: [number, number, number, number] = [cardCurve.x1, cardCurve.y1, cardCurve.x2, cardCurve.y2];
  const points: Point[] = settings.axisPoints.map(([x, y]) => ({ x, y }));
  const axisCorner = settings.axisHandles.length > 0 && settings.axisHandles.every((handle) => {
    if (!handle) return false;
    return handle[0] === 0 && handle[1] === 0 && (handle.length < 3 || (handle[2] === 0 && handle[3] === 0));
  });
  const ratio = ORIENT_RATIO[settings.orient] ?? 1;
  const [ay, ax] = settings.anchor.includes(" ")
    ? settings.anchor.split(" ")
    : settings.anchor === "top" || settings.anchor === "bottom"
      ? [settings.anchor, "center"]
      : ["center", settings.anchor];
  const flex = (side: string | undefined) =>
    side === "top" || side === "left" ? "flex-start" : side === "bottom" || side === "right" ? "flex-end" : "center";
  const gaps = settings.barGaps
    .split(/[,;\s]+/)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
  const gapAt = (index: number) => gaps[index] ?? gaps[gaps.length - 1] ?? 8;
  const skipped = parseSkipCells(settings.skipCells, MODULE_ROWS);
  const barPct = (index: number) => {
    const count = settings.columns;
    const t = count <= 1 ? 1 : index / (count - 1);
    const y = sampleAxisX(settings.axisPoints, settings.axisHandles, t);
    return Math.round(15 + Math.min(1, Math.max(0, y)) * 85);
  };

  const pickerHex =
    colorKey === "grid"
      ? settings.gridLineColor
      : colorKey === "card"
        ? settings.cardColor
        : colorKey === "stroke"
          ? settings.strokeColor
          : colorKey === "text"
            ? settings.textColor
            : settings.backgroundColor;
  const colorOpacityKey = {
    background: "backgroundOpacity",
    grid: "gridOpacity",
    card: "cardOpacity",
    stroke: "strokeOpacity",
    text: "textOpacity",
  } as const;
  const pickerAlpha = settings[colorOpacityKey[colorKey]] / 100;
  const pickerColor = hexToHsva(pickerHex, pickerAlpha) ?? { h: 0, s: 0, v: 0, a: pickerAlpha };

  function commitNumber(raw: string, current: number, min: number, max: number, apply: (value: number) => void) {
    const parsed = evalNumberExpression(raw, current);
    if (parsed != null) apply(Math.min(max, Math.max(min, parsed)));
  }

  function applyColor(key: NonNullable<typeof picker>, next: Hsva) {
    const hex = `#${rgbToHex(hsvaToRgb(next))}`;
    const opacity = Math.round(next.a * 100);
    if (key === "grid") patch({ gridLineColor: hex, gridOpacity: opacity });
    else if (key === "card") patch({ cardColor: hex, cardOpacity: opacity });
    else if (key === "stroke") patch({ strokeColor: hex, strokeOpacity: opacity });
    else if (key === "text") patch({ textColor: hex, textOpacity: opacity });
    else patch({ backgroundColor: hex, backgroundOpacity: opacity });
  }

  function paint(next: Hsva) {
    setPickerDraft(next);
    applyColor(colorKey, next);
  }

  function setAxisPoints(next: Point[]) {
    const axisPoints: AxisPoint[] = next.map((point) => [point.x, point.y]);
    const axisHandles: AxisHandle[] = axisPoints.map((_, index) => settings.axisHandles[index] ?? null);
    patch({ axisPoints, axisHandles });
  }

  const tt = (ru: string, en: string) => (locale === "en" ? en : ru);

  useEffect(() => {
    const notice = history.notice;
    if (!notice) return;
    const keys = Object.keys(notice.step.after);
    const first = keys[0];
    const name = notice.step.label ?? (first ? settingLabel(first, locale) : "");
    const verb = notice.kind === "undo" ? tt("Отменено", "Undone") : tt("Возвращено", "Redone");
    const id = notice.id;
    setToast({ id, text: `${verb} · ${name}`, detail: String(keys.length) });
    const timer = window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, COPY_DONE_MS);
    return () => window.clearTimeout(timer);
  }, [history.notice, locale]);
  const capOption = P.barCap.options.find((option) => option.value === settings.barCap) ?? P.barCap.options[0];
  const capLabel = capOption ? tx(capOption.label, locale) : "";
  const sceneRows: { changed: boolean; line?: string }[] = [
    { changed: settings.backgroundColor !== d.backgroundColor || settings.backgroundOpacity !== d.backgroundOpacity, line: `${tx(P.backgroundColor.label, locale)}: ${settings.backgroundColor} ${settings.backgroundOpacity}%` },
    { changed: settings.showLayoutGrid !== d.showLayoutGrid, line: `${tt("Сетка", "Grid")}: ${settings.showLayoutGrid ? "on" : "off"}` },
    { changed: settings.gridLineColor !== d.gridLineColor || settings.gridOpacity !== d.gridOpacity, line: `${tx(P.gridLineColor.label, locale)}: ${settings.gridLineColor} ${settings.gridOpacity}%` },
    { changed: settings.cardSize !== d.cardSize, line: `${tx(P.cardSize.label, locale)}: ${settings.cardSize} px` },
    { changed: settings.radius !== d.radius, line: `${tx(P.radius.label, locale)}: ${settings.radius} px` },
    { changed: settings.orient !== d.orient, line: `${tx(P.orient.label, locale)}: ${settings.orient}` },
    { changed: settings.anchor !== d.anchor, line: `${tx(P.anchor.label, locale)}: ${settings.anchor}` },
    { changed: settings.padX !== d.padX || settings.padY !== d.padY, line: `${tx(P.pad.label, locale)}: ${settings.padX} × ${settings.padY} px` },
    { changed: settings.cardColor !== d.cardColor || settings.cardOpacity !== d.cardOpacity, line: `${tx(P.cardColor.label, locale)}: ${settings.cardColor} ${settings.cardOpacity}%` },
    { changed: settings.shadow !== d.shadow, line: `${tx(P.shadow.label, locale)}: ${settings.shadow ? "on" : "off"}` },
    { changed: settings.cardLead !== d.cardLead, line: `${tx(P.cardLead.label, locale)}: ${settings.cardLead} ms` },
    { changed: JSON.stringify(cardCurve) !== JSON.stringify(d.easings.card), line: `${tt("Кривая", "Curve")}: ${curve.join(", ")}` },
    { changed: settings.strokeWidth !== d.strokeWidth, line: `${tx(P.strokeWidth.label, locale)}: ${settings.strokeWidth} px` },
    { changed: settings.strokeJoin !== d.strokeJoin, line: `${tt("Стык", "Join")}: ${settings.strokeJoin}` },
    { changed: settings.strokeColor !== d.strokeColor || settings.strokeOpacity !== d.strokeOpacity, line: `${tx(P.strokeColor.label, locale)}: ${settings.strokeColor} ${settings.strokeOpacity}%` },
    { changed: settings.fontSize !== d.fontSize, line: `${tx(P.fontSize.label, locale)}: ${settings.fontSize} px` },
    { changed: settings.wghtMin !== d.wghtMin || settings.wghtMax !== d.wghtMax, line: `${tx(P.wght.label, locale)}: ${settings.wghtMin}–${settings.wghtMax}` },
    { changed: settings.align !== d.align, line: `${tx(P.align.label, locale)}: ${settings.align}` },
    { changed: settings.textColor !== d.textColor || settings.textOpacity !== d.textOpacity, line: `${tx(P.textColor.label, locale)}: ${settings.textColor} ${settings.textOpacity}%` },
    { changed: settings.columns !== d.columns, line: `${tx(P.columns.label, locale)}: ${settings.columns}` },
    { changed: settings.fit !== d.fit, line: `${tx(P.fit.label, locale)}: ${settings.fit}` },
    { changed: settings.order !== d.order, line: `${tx(P.order.label, locale)}: ${settings.order}` },
    { changed: settings.barsFill !== d.barsFill, line: `${tx(P.barsFill.label, locale)}: ${settings.barsFill ? tx(P.barsFill.onLabel, locale) : tx(P.barsFill.offLabel, locale)}` },
    { changed: settings.barsBlocks !== d.barsBlocks, line: `${tx(P.barsBlocks.label, locale)}: ${settings.barsBlocks ? tx(P.barsBlocks.onLabel, locale) : tx(P.barsBlocks.offLabel, locale)}` },
    { changed: settings.barCap !== d.barCap, line: `${tx(P.barCap.label, locale)}: ${capLabel}` },
    { changed: settings.barGaps !== d.barGaps, line: `${tt("Зазоры", "Gaps")}: ${settings.barGaps}` },
    { changed: settings.skipCells !== d.skipCells, line: `${tt("Пропуски", "Skips")}: ${settings.skipCells || "—"}` },
    { changed: JSON.stringify(hover) !== JSON.stringify(d.springs.hover) },
    { changed: JSON.stringify(settings.axisPoints) !== JSON.stringify(d.axisPoints) },
    { changed: JSON.stringify(settings.axisHandles) !== JSON.stringify(d.axisHandles) },
  ];
  const changeCount = sceneRows.filter((row) => row.changed).length;
  const changedFilterActive = searchOpen && changedOnly && searchQuery.trim().length === 0;
  useEffect(() => {
    if (changeCount === 0 && changedOnly) {
      setChangedOnly(false);
      setSearchOpen(false);
      setSearchQuery("");
    }
  }, [changeCount, changedOnly]);

  function sceneValues() {
    return sceneRows.flatMap((row) => (row.line ? [row.line] : [])).join("\n");
  }

  function markCopied(kind: "file" | "link") {
    setCopied(kind);
    const id = Date.now();
    setToast({ id, text: tt("Скопировано", "Copied") });
    window.setTimeout(() => {
      setCopied((current) => (current === kind ? null : current));
      setToast((current) => (current?.id === id ? null : current));
    }, COPY_DONE_MS);
  }

  async function copyScene() {
    await navigator.clipboard.writeText(sceneValues());
    markCopied("file");
  }

  async function copyLink() {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({
      side: String(settings.cardSize),
      radius: String(settings.radius),
      orient: settings.orient,
      anchor: settings.anchor,
      columns: String(settings.columns),
    }).toString();
    await navigator.clipboard.writeText(url.toString());
    markCopied("link");
  }

  function colorRow(
    key: "background" | "grid" | "card" | "stroke" | "text",
    bind: string,
    label: string,
    hex: string,
    changed: boolean,
    onReset: () => void,
    alpha: number,
  ) {
    const hsva = hexToHsva(hex, alpha) ?? pickerColor;
    const opacityKey = colorOpacityKey[key];
    return (
      <div key={key}>
        <Row bind={bind}>
          <ChangedName changed={changed} label={label} onReset={onReset} />
          <span className="flex items-center gap-2">
            <ValueField
              value={formatColor(hsva, format)}
              unit={format.toUpperCase()}
              onCommit={(next) => {
                const parsed = parseColorInput(next, format, alpha);
                if (parsed) applyColor(key, parsed);
              }}
            />
            <ValueField
              value={String(Math.round(alpha * 100))}
              unit="%"
              current={Math.round(alpha * 100)}
              min={0}
              max={100}
              onCommit={(next) => commitNumber(next, Math.round(alpha * 100), 0, 100, (value) => patch({ [opacityKey]: value }))}
            />
            <button
              type="button"
              aria-label={label}
              aria-pressed={paletteOpen && picker === key}
              onClick={() => {
                if (paletteOpen && picker === key) {
                  setPaletteOpen(false);
                  setPickerDraft(null);
                  return;
                }
                setPickerDraft(null);
                setPicker(key);
                setPaletteOpen(true);
              }}
              data-truecolor=""
              className="size-6 rounded"
              style={{ background: hexAlpha(hex, alpha * 100) }}
            />
          </span>
        </Row>
      </div>
    );
  }

  function scrubRow(
    key: "cardSize" | "radius" | "strokeWidth",
    label: string,
    value: number,
    min: number,
    max: number,
    unit: string,
    step: number | undefined,
  ) {
    const openScrub = scrubKey === key;
    return (
      <Row key={key} bind="card" layout="stack">
        <span className="flex h-6 w-full items-center justify-between">
          <ChangedName changed={value !== d[key]} label={label} onReset={() => patch({ [key]: d[key] })} />
          <span className="flex items-center gap-1">
            <ValueField value={trimNum(value)} current={value} min={min} max={max} step={step ?? 1} unit={unit} onCommit={(next) => commitNumber(next, value, min, max, (parsed) => patch({ [key]: parsed }))} />
            <button
              type="button"
              aria-pressed={openScrub}
              aria-label="Линейка"
              onClick={() => setScrubKey((current) => (current === key ? null : key))}
              className={`flex size-6 items-center justify-center rounded transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] ${openScrub ? "bg-white text-black" : "text-white fine-hover:hover:inset-ring fine-hover:hover:inset-ring-white"}`}
            >
              <PanelIcon name="settings-2" className="size-5" />
            </button>
          </span>
        </span>
        <SectionCollapse open={openScrub} reduceMotion={reduce}>
          <div className="pt-1">
            <Track min={min} max={max} step={step} start={value} home={d[key]} handle="square" onChange={(next) => patch({ [key]: next })} />
          </div>
        </SectionCollapse>
      </Row>
    );
  }

  return (
    <PanelLocale.Provider value={locale}>
    <main data-new-ui="" className="relative min-h-dvh text-black" style={{ background: hexAlpha(settings.backgroundColor, settings.backgroundOpacity), color: settings.textColor }}>
      <PageBar trailing={<IconPick value={theme} onChange={setTheme} options={[{ id: "sun", icon: "sun" }, { id: "moon", icon: "moon" }]} />} />
      {settings.showLayoutGrid ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0"
          style={{
            backgroundImage: `linear-gradient(${settings.gridLineColor} 1px, transparent 1px), linear-gradient(90deg, ${settings.gridLineColor} 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
            opacity: settings.gridOpacity / 100,
          }}
        />
      ) : null}
      <div className="flex min-h-dvh p-16" style={{ alignItems: flex(ay), justifyContent: flex(ax) }}>
        <div
          ref={cardRef}
          className="relative flex flex-col gap-3 transition-transform fine-hover:hover:scale-[1.04]"
          style={{
            width: settings.cardSize,
            minHeight: settings.cardSize * ratio,
            padding: `${settings.padY}px ${settings.padX}px`,
            borderRadius: settings.radius,
            background: settings.cardColor,
            opacity: settings.cardOpacity / 100,
            color: settings.textColor,
            textAlign: settings.align,
            boxShadow: settings.shadow ? "0 24px 60px rgba(0,0,0,0.35)" : "none",
            transitionDuration: `${hoverMotion.settleMs}ms`,
            transitionTimingFunction: hoverMotion.easing,
          }}
        >
          {settings.strokeWidth > 0 ? (
            <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
              <rect
                x={settings.strokeWidth / 2}
                y={settings.strokeWidth / 2}
                width={`calc(100% - ${settings.strokeWidth}px)`}
                height={`calc(100% - ${settings.strokeWidth}px)`}
                fill="none"
                stroke={settings.strokeColor}
                strokeOpacity={settings.strokeOpacity / 100}
                strokeWidth={settings.strokeWidth}
                strokeLinejoin={settings.strokeJoin === "bevel" || settings.strokeJoin === "round" ? settings.strokeJoin : "miter"}
                rx={Math.max(0, settings.radius - settings.strokeWidth / 2)}
              />
            </svg>
          ) : null}
          <h1 className="leading-tight" style={{ fontSize: settings.fontSize, fontWeight: Math.round((settings.wghtMin + settings.wghtMax) / 2), color: hexAlpha(settings.textColor, settings.textOpacity) }}>
            {settings.title}
          </h1>
          <div className="flex flex-col gap-3">
          <div
            ref={barsRef}
            className="flex flex-col"
            style={{ alignItems: settings.fit === "center" ? "center" : settings.fit === "right" ? "flex-end" : "flex-start" }}
          >
            {Array.from({ length: settings.columns }, (_, index) => (
              <span
                key={index}
                className="block bg-current opacity-30"
                style={{
                  height: settings.barsBlocks ? 16 : Math.max(2, Math.round(settings.fontSize / 12)),
                  width: settings.barsFill ? "100%" : `${barPct(index)}%`,
                  marginBottom: index === settings.columns - 1 ? 0 : gapAt(index),
                  borderRadius: settings.barCap === "sharp" ? 0 : settings.barCap === "soft" ? 2 : 999,
                  transformOrigin: settings.order === "end" ? "right" : settings.order === "center" ? "center" : "left",
                }}
              />
            ))}
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${settings.columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: MODULE_ROWS * settings.columns }, (_, index) => {
              const row = Math.floor(index / settings.columns);
              const col = index % settings.columns;
              const hole = skipped[row]?.includes(col);
              return (
                <span
                  key={index}
                  className="h-4 rounded-[3px]"
                  style={{ background: hole ? "transparent" : "currentColor", opacity: hole ? 1 : 0.4 }}
                />
              );
            })}
          </div>
          </div>
        </div>
      </div>
      <DockAnchorContext.Provider value={dockAnchor}>
      <ScreenDock toast={toast ? <Toast text={toast.text} detail={toast.detail} /> : undefined} onAnchor={setDockAnchor}>
        <DockButton name="settings" label={tt("Настройки панели", "Panel Settings")} active={settingsOpen} onClick={() => setSettingsOpen((value) => !value)} />
        <span className="h-4 w-0.5 rounded-full bg-black/50" />
        <span className="relative z-10">
          <span
            className={`flex h-7 overflow-hidden rounded inset-ring-black ${open ? "inset-ring" : "fine-hover:hover:inset-ring"} ${reduce ? "" : "transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"}`}
            style={{ width: open ? 28 + 56 + 28 + (searchOpen ? 164 : 28) : 28 }}
          >
            <button
              type="button"
              aria-label={tt("Панель", "Panel")}
              aria-pressed={open}
              onClick={() => setOpen((value) => !value)}
              className={`group/dock flex size-7 shrink-0 items-center justify-center rounded ${open ? "bg-black text-white" : "text-black"}`}
            >
              <PanelIcon name="sliders-horizontal" className={`size-5 ${open ? "fine-hover:group-hover/dock:hidden" : ""}`} />
              {open ? <PanelIcon name="x" className="hidden size-5 fine-hover:group-hover/dock:block" /> : null}
            </button>
            {open ? (
              <>
                <button type="button" aria-label={tt("Сброс", "Reset")} disabled={changeCount === 0} onClick={() => history.record(d, tt("Сброс", "Reset"))} className={`flex size-7 shrink-0 items-center justify-center rounded ${changeCount === 0 ? "text-black/50" : "text-black"}`}>
                  <PanelIcon name="trash-2" className="size-5" />
                </button>
                <button type="button" aria-label={tt("Копировать", "Copy")} disabled={changeCount === 0} onClick={() => void copyScene()} className={`flex size-7 shrink-0 items-center justify-center rounded ${changeCount === 0 ? "text-black/50" : "text-black"}`}>
                  <PanelIcon name={copied === "file" ? "check" : "file"} className="size-5" />
                </button>
              </>
            ) : null}
            {open ? (
              <button type="button" aria-label={tt("Ссылка", "Link")} onClick={() => void copyLink()} className="flex size-7 shrink-0 items-center justify-center rounded text-black">
                <PanelIcon name={copied === "link" ? "check" : "link"} className="size-5" />
              </button>
            ) : null}
            <button
              type="button"
              aria-label={searchOpen ? tt("Закрыть поиск", "Close search") : tt("Поиск", "Search")}
              aria-expanded={searchOpen}
              onClick={() => {
                if (searchOpen) {
                  setSearchQuery("");
                  setChangedOnly(false);
                  setSearchOpen(false);
                  return;
                }
                setOpen(true);
                setSearchOpen(true);
              }}
              className={`group/dock flex size-7 shrink-0 items-center justify-center rounded ${searchOpen ? "bg-black text-white" : "text-black"}`}
            >
              <PanelIcon name="search" className={`size-5 ${searchOpen ? "fine-hover:group-hover/dock:hidden" : ""}`} />
              {searchOpen ? <PanelIcon name="x" className="hidden size-5 fine-hover:group-hover/dock:block" /> : null}
            </button>
            <input
              ref={searchRef}
              type="search"
              value={searchQuery}
              placeholder={changedFilterActive ? tt(`Изменено · ${changeCount}`, `Changed · ${changeCount}`) : tt("Поиск", "Search")}
              aria-label={tt("Поиск", "Search")}
              aria-hidden={!searchOpen}
              tabIndex={searchOpen ? 0 : -1}
              autoComplete="off"
              onChange={(event) => {
                setChangedOnly(false);
                setSearchQuery(event.target.value);
                if (event.target.value.trim()) setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                if (searchQuery) setSearchQuery("");
                else {
                  setSearchOpen(false);
                  setChangedOnly(false);
                }
              }}
              onPointerDown={(event) => event.stopPropagation()}
              className={`h-7 min-w-0 flex-1 bg-transparent pr-2 pl-1 text-[14px] leading-[18px] text-black outline-none [&::-webkit-search-cancel-button]:hidden ${changedFilterActive ? "placeholder:text-black" : "placeholder:text-black/50"}`}
            />
          </span>
          {changeCount > 0 ? (
            <button
              type="button"
              aria-pressed={changedFilterActive}
              aria-label={changedFilterActive ? tt("Все параметры", "All settings") : tt("Только изменённые", "Changed only")}
              onClick={() => {
                if (changedFilterActive) {
                  setSearchOpen(false);
                  setSearchQuery("");
                  setChangedOnly(false);
                  return;
                }
                setSearchQuery("");
                setChangedOnly(true);
                setSearchOpen(true);
                setOpen(true);
              }}
              className={`absolute top-[-7px] left-[21px] z-20 flex size-3.5 items-center justify-center rounded-full text-[10px] leading-none ${changedFilterActive ? "bg-white text-black inset-ring inset-ring-black" : "bg-black text-white"}`}
            >
              {changeCount}
            </button>
          ) : null}
        </span>
        <DockButton name="spline" label={tt("Кривая", "Curve")} active={motionOpen} onClick={() => setMotionOpen((value) => !value)} />
        <DockButton name="waypoints" label={tt("Ось", "Axis")} active={axisOpen} onClick={() => setAxisOpen((value) => !value)} />
        <DockButton
          name="palette"
          label={tt("Палитра", "Palette")}
          active={paletteOpen}
          onClick={() => setPaletteOpen((value) => !value)}
        />
      </ScreenDock>
      <DockedWindows>
        <FloatWindow
          resetKey={placeEpoch}
          hidden={!panelMounted}
          style={{ width: panelW }}
          resizable={{
            minWidth: NEW_PANEL_W_MIN,
            maxWidth: NEW_PANEL_W_MAX,
            minHeight: NEW_PANEL_H_MIN,
            maxHeight: panelHeightCap(dockAnchor),
            onResize: ({ width, height }) => {
              if (width != null) setPanelW(width);
              if (height != null) setPanelH(height);
            },
          }}
        >
        {panelMounted ? (
          <ParametersPanel
            title={tt("Параметры", "Parameters")}
            canCollapse={canCollapseAll}
            onToggleFold={toggleFoldAll}
            collapseLabel={tt("Свернуть все", "Collapse all")}
            expandLabel={tt("Развернуть все", "Expand all")}
            className={panelPopClassName({ open, fromBottom: false, skip: reduce })}
            style={{ ...panelPopStyle({ open, skip: reduce }), width: panelW, height: "auto" }}
            bodyRef={panelScrollRef.setEl}
            bodyStyle={{ maxHeight: (panelH ?? panelHeightCap(dockAnchor)) - 36 }}
          >
              <SectionFoldContext.Provider value={{ closed: closedSections, toggle: toggleSection }}>
              <Sortable className="flex flex-col gap-2">
                <Section
                  key="scene"
                  foldId="scene"
                  title={tt("Сцена", "Scene")}
                  changed={settings.showLayoutGrid !== d.showLayoutGrid}
                  action={
                    <button type="button" data-bind="scene" aria-pressed={settings.showLayoutGrid} aria-label={tt("Сетка", "Grid")} onClick={() => patch({ showLayoutGrid: !settings.showLayoutGrid })}>
                      <PanelIcon name={settings.showLayoutGrid ? "eye" : "eye-off"} className="size-5" />
                    </button>
                  }
                >
                  {colorRow("background", "scene", tx(P.backgroundColor.label, locale), settings.backgroundColor, settings.backgroundColor !== d.backgroundColor || settings.backgroundOpacity !== d.backgroundOpacity, () => patch({ backgroundColor: d.backgroundColor, backgroundOpacity: d.backgroundOpacity }), settings.backgroundOpacity / 100)}
                  {settings.showLayoutGrid
                    ? colorRow("grid", "scene", tx(P.gridLineColor.label, locale), settings.gridLineColor, settings.gridLineColor !== d.gridLineColor || settings.gridOpacity !== d.gridOpacity, () => patch({ gridLineColor: d.gridLineColor, gridOpacity: d.gridOpacity }), settings.gridOpacity / 100)
                    : null}
                </Section>
                <Section key="card" foldId="card" title={tx(P.cardColor.label, locale)}>
                  {scrubRow("cardSize", tx(P.cardSize.label, locale), settings.cardSize, 80, 480, "px", 1)}
                  {scrubRow("radius", tx(P.radius.label, locale), settings.radius, 0, 120, "px", undefined)}
                  <Row key="orient" bind="card">
                    <ChangedName changed={settings.orient !== d.orient} label={tx(P.orient.label, locale)} onReset={() => patch({ orient: d.orient })} />
                    <IconPick
                      value={settings.orient}
                      onChange={(orient) => patch({ orient })}
                      options={[
                        { id: "square", icon: "square" },
                        { id: "portrait", icon: "rectangle-vertical" },
                        { id: "landscape", icon: "rectangle-horizontal" },
                      ]}
                    />
                  </Row>
                  <Row key="anchor" bind="card" layout="stack">
                    <span className="flex h-6 w-full items-center">
                      <ChangedName changed={settings.anchor !== d.anchor} label={tx(P.anchor.label, locale)} onReset={() => patch({ anchor: d.anchor })} />
                    </span>
                    <AnchorPick value={settings.anchor} onChange={(anchor) => patch({ anchor })} />
                  </Row>
                  <Row key="pad" bind="card">
                    <ChangedName
                      changed={settings.padX !== d.padX || settings.padY !== d.padY}
                      label={tx(P.pad.label, locale)}
                      onReset={() => patch({ padX: d.padX, padY: d.padY })}
                    />
                    <span className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <span className="text-white">
                          <PairGlyph icon="padX" />
                        </span>
                        <ValueField
                          value={String(settings.padX)}
                          current={settings.padX}
                          min={0}
                          max={120}
                          step={1}
                          unit="px"
                          onCommit={(next) => {
                            const parsed = Number(next);
                            if (Number.isFinite(parsed)) patch({ padX: parsed });
                          }}
                        />
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-white">
                          <PairGlyph icon="padY" />
                        </span>
                        <ValueField
                          value={String(settings.padY)}
                          current={settings.padY}
                          min={0}
                          max={120}
                          step={1}
                          unit="px"
                          onCommit={(next) => {
                            const parsed = Number(next);
                            if (Number.isFinite(parsed)) patch({ padY: parsed });
                          }}
                        />
                      </span>
                    </span>
                  </Row>
                  <Row key="width" bind="card">
                    <RowHint text={tt("Сторона минус отступы слева и справа", "Side minus the left and right padding")}>
                      <span className={rowLabel}>{tt("Ширина", "Width")}</span>
                    </RowHint>
                    <span className="text-white/50">{Math.round(settings.cardSize - settings.padX * 2)} px</span>
                  </Row>
                  {colorRow(
                    "card",
                    "card",
                    tx(P.cardColor.label, locale),
                    settings.cardColor,
                    settings.cardColor !== d.cardColor || settings.cardOpacity !== d.cardOpacity,
                    () => patch({ cardColor: d.cardColor, cardOpacity: d.cardOpacity }),
                    settings.cardOpacity / 100,
                  )}
                  <Row key="shadow" bind="card">
                    <ChangedName changed={settings.shadow !== d.shadow} label={tx(P.shadow.label, locale)} onReset={() => patch({ shadow: d.shadow })} />
                    <button
                      type="button"
                      aria-pressed={settings.shadow}
                      onClick={() => patch({ shadow: !settings.shadow })}
                      className={`relative h-6 w-12 rounded inset-ring inset-ring-white ${settings.shadow ? "bg-white" : "bg-transparent"} ${reduce ? "" : "transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"}`}
                    >
                      <span className={`absolute top-0 left-0 size-6 rounded bg-black inset-ring inset-ring-white ${settings.shadow ? "translate-x-6" : "translate-x-0"} ${reduce ? "" : "transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"}`} />
                    </button>
                  </Row>
                  <Row key="lead" bind="card">
                    <ChangedName changed={settings.cardLead !== d.cardLead} label={tx(P.cardLead.label, locale)} onReset={() => patch({ cardLead: d.cardLead })} />
                    <span className="flex items-center gap-1">
                      <ValueField value={String(settings.cardLead)} current={settings.cardLead} min={0} max={400} step={10} unit="ms" onCommit={(next) => commitNumber(next, settings.cardLead, 0, 400, (cardLead) => patch({ cardLead }))} />
                      <button
                        type="button"
                        aria-label={tt("Кривая", "Curve")}
                        aria-pressed={motionOpen}
                        onClick={() => {
                          setMotionOpen((value) => !value);
                        }}
                        className={`flex size-6 items-center justify-center rounded transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] ${motionOpen ? "bg-white text-black" : "text-white fine-hover:hover:inset-ring fine-hover:hover:inset-ring-white"}`}
                      >
                        <PanelIcon name="spline" className="size-5" />
                      </button>
                    </span>
                  </Row>
                  {scrubRow("strokeWidth", tx(P.strokeWidth.label, locale), settings.strokeWidth, 0, 12, "px", 0.5)}
                  <Row key="join" bind="card">
                    <ChangedName changed={settings.strokeJoin !== d.strokeJoin} label={tt("Тип стыка", "Join")} onReset={() => patch({ strokeJoin: d.strokeJoin })} />
                    <Segment
                      value={settings.strokeJoin === "round" || settings.strokeJoin === "bevel" ? settings.strokeJoin : "miter"}
                      onChange={(strokeJoin) => patch({ strokeJoin })}
                      options={(["miter", "round", "bevel"] as const).map((id) => ({ id, label: id, glyph: <PickGlyph name={`join-${id}`} /> }))}
                    />
                  </Row>
                  {colorRow("stroke", "card", tx(P.strokeColor.label, locale), settings.strokeColor, settings.strokeColor !== d.strokeColor || settings.strokeOpacity !== d.strokeOpacity, () => patch({ strokeColor: d.strokeColor, strokeOpacity: d.strokeOpacity }), settings.strokeOpacity / 100)}
                </Section>
                <Section key="title" foldId="title" title={tx(P.title.label, locale)}>
                  <Row key="size" bind="title">
                    <ChangedName changed={settings.fontSize !== d.fontSize} label={tx(P.fontSize.label, locale)} onReset={() => patch({ fontSize: d.fontSize })} />
                    <ValueField value={String(settings.fontSize)} current={settings.fontSize} min={10} max={96} unit="px" onCommit={(next) => commitNumber(next, settings.fontSize, 10, 96, (fontSize) => patch({ fontSize }))} />
                  </Row>
                  <Row key="weight" bind="title" layout="stack">
                    <span className="flex h-6 w-full items-center justify-between">
                      <ChangedName
                        changed={settings.wghtMin !== d.wghtMin || settings.wghtMax !== d.wghtMax}
                        label={tx(P.wght.label, locale)}
                        onReset={() => patch({ wghtMin: d.wghtMin, wghtMax: d.wghtMax })}
                      />
                      <span className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <span className="text-[14px] leading-[18px] text-white/50">{tt("от", "from")}</span>
                          <ValueField value={String(settings.wghtMin)} current={settings.wghtMin} min={100} max={settings.wghtMax} step={10} onCommit={(next) => commitNumber(next, settings.wghtMin, 100, settings.wghtMax, (wghtMin) => patch({ wghtMin }))} />
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="text-[14px] leading-[18px] text-white/50">{tt("до", "to")}</span>
                          <ValueField value={String(settings.wghtMax)} current={settings.wghtMax} min={settings.wghtMin} max={900} step={10} onCommit={(next) => commitNumber(next, settings.wghtMax, settings.wghtMin, 900, (wghtMax) => patch({ wghtMax }))} />
                        </span>
                      </span>
                    </span>
                    <Track
                      min={100}
                      max={900}
                      step={10}
                      start={settings.wghtMin}
                      end={settings.wghtMax}
                      home={d.wghtMin}
                      homeEnd={d.wghtMax}
                      dual
                      onChange={(wghtMin, wghtMax) => patch({ wghtMin, wghtMax })}
                    />
                  </Row>
                  <Row key="align" bind="title">
                    <ChangedName changed={settings.align !== d.align} label={tx(P.align.label, locale)} onReset={() => patch({ align: d.align })} />
                    <IconPick
                      value={settings.align}
                      onChange={(align) => patch({ align })}
                      options={[
                        { id: "left", icon: "align-left" },
                        { id: "center", icon: "align-center" },
                        { id: "right", icon: "align-right" },
                        { id: "justify", icon: "align-justify" },
                      ]}
                    />
                  </Row>
                  {colorRow("text", "title", tx(P.textColor.label, locale), settings.textColor, settings.textColor !== d.textColor || settings.textOpacity !== d.textOpacity, () => patch({ textColor: d.textColor, textOpacity: d.textOpacity }), settings.textOpacity / 100)}
                </Section>
                <Section key="bars" foldId="bars" title={tt("Плашки", "Bars")}>
                  <Row key="columns" bind="bars">
                    <ChangedName changed={settings.columns !== d.columns} label={tx(P.columns.label, locale)} onReset={() => patch({ columns: d.columns })} />
                    <span className="flex h-6 w-24 items-center justify-between rounded text-white inset-ring inset-ring-white">
                      <button type="button" aria-label={tt("Меньше", "Less")} onClick={() => patch({ columns: Math.max(1, settings.columns - 1) })} className="flex size-6 items-center justify-center rounded bg-white text-black">
                        <StepMark kind="minus" />
                      </button>
                      <span>{settings.columns}</span>
                      <button type="button" aria-label={tt("Больше", "More")} onClick={() => patch({ columns: Math.min(6, settings.columns + 1) })} className="flex size-6 items-center justify-center rounded bg-white text-black">
                        <StepMark kind="plus" />
                      </button>
                    </span>
                  </Row>
                  <Row key="fit" bind="bars">
                    <ChangedName changed={settings.fit !== d.fit} label={tx(P.fit.label, locale)} onReset={() => patch({ fit: d.fit })} />
                    <IconPick
                      value={settings.fit}
                      onChange={(fit) => patch({ fit })}
                      options={[
                        { id: "left", icon: "align-start-vertical" },
                        { id: "center", icon: "align-center-vertical" },
                        { id: "right", icon: "align-end-vertical" },
                      ]}
                    />
                  </Row>
                  <Row key="order" bind="bars">
                    <ChangedName changed={settings.order !== d.order} label={tx(P.order.label, locale)} onReset={() => patch({ order: d.order })} />
                    <Segment
                      value={settings.order}
                      onChange={(order) => patch({ order })}
                      options={(["start", "center", "end"] as const).map((id) => ({ id, label: id, glyph: <PickGlyph name={`order-${id}`} /> }))}
                    />
                  </Row>
                  <Row key="fill" bind="bars">
                    <ChangedName changed={settings.barsFill !== d.barsFill} label={tx(P.barsFill.label, locale)} onReset={() => patch({ barsFill: d.barsFill })} />
                    <Segment
                      value={settings.barsFill ? "fill" : "axis"}
                      onChange={(next) => patch({ barsFill: next === "fill" })}
                      options={[
                        { id: "axis", label: tx(P.barsFill.offLabel, locale) },
                        { id: "fill", label: tx(P.barsFill.onLabel, locale) },
                      ]}
                    />
                  </Row>
                  <Row key="kind" bind="bars">
                    <ChangedName changed={settings.barsBlocks !== d.barsBlocks} label={tx(P.barsBlocks.label, locale)} onReset={() => patch({ barsBlocks: d.barsBlocks })} />
                    <Segment
                      value={settings.barsBlocks ? "blocks" : "lines"}
                      onChange={(next) => patch({ barsBlocks: next === "blocks" })}
                      options={[
                        { id: "lines", label: tx(P.barsBlocks.offLabel, locale) },
                        { id: "blocks", label: tx(P.barsBlocks.onLabel, locale) },
                      ]}
                    />
                  </Row>
                  <div key="cap" ref={capAnchor} onClick={() => setCapOpen((value) => !value)} className="cursor-pointer">
                    <Row bind="bars">
                      <ChangedName changed={settings.barCap !== d.barCap} label={tx(P.barCap.label, locale)} onReset={() => patch({ barCap: d.barCap })} />
                      <span className="flex items-center gap-1">
                        {capLabel}
                        <PanelIcon name="chevrons-up-down" className="size-5" />
                      </span>
                    </Row>
                    <FloatingMenu open={capOpen} anchor={capAnchor} onClose={() => setCapOpen(false)}>
                      <Menu
                        options={P.barCap.options.map((option) => tx(option.label, locale))}
                        value={capLabel}
                        onChange={(next) => {
                          const found = P.barCap.options.find((option) => tx(option.label, locale) === next);
                          if (found) patch({ barCap: found.value });
                          setCapOpen(false);
                        }}
                      />
                    </FloatingMenu>
                  </div>
                  <Row key="gaps" bind="bars" layout="wrap">
                    <span className="flex h-8 items-center">
                      <ChangedName changed={settings.barGaps !== d.barGaps} label={tt("Зазоры", "Gaps")} onReset={() => patch({ barGaps: d.barGaps })} />
                    </span>
                    <GapChips value={settings.barGaps} onChange={(barGaps) => patch({ barGaps })} />
                  </Row>
                  <Row key="skips" bind="bars" layout="wrap">
                    <span className="flex h-8 items-center">
                      <ChangedName changed={settings.skipCells !== d.skipCells} label={tt("Пропуски", "Skips")} onReset={() => patch({ skipCells: d.skipCells })} />
                    </span>
                    <span className="ml-auto flex flex-col gap-1 py-1">
                      {parseSkipCells(settings.skipCells, MODULE_ROWS).map((cols, rowIndex) => (
                        <span key={rowIndex} className="flex max-w-full flex-wrap justify-end gap-1">
                          {Array.from({ length: settings.columns }, (_, col) => {
                            const off = cols.includes(col);
                            return (
                              <button
                                key={col}
                                type="button"
                                aria-pressed={off}
                                aria-label={tt(`строка ${rowIndex + 1}, колонка ${col + 1}`, `row ${rowIndex + 1}, column ${col + 1}`)}
                                onClick={() => {
                                  const grid = parseSkipCells(settings.skipCells, MODULE_ROWS).map((line) => [...line]);
                                  const at = grid[rowIndex].indexOf(col);
                                  if (at >= 0) grid[rowIndex].splice(at, 1);
                                  else grid[rowIndex] = [...grid[rowIndex], col].sort((a, b) => a - b);
                                  const empty = grid.every((line) => line.length === 0);
                                  patch({ skipCells: empty ? "" : serializeSkipCells(grid) });
                                }}
                                className={`size-6 rounded ${off ? "border border-dashed border-white/50 bg-transparent" : "bg-white"}`}
                              />
                            );
                          })}
                        </span>
                      ))}
                    </span>
                  </Row>
                  <Row key="shuffle" bind="bars">
                    <span>{tt("Перемешать", "Shuffle")}</span>
                    <button
                      type="button"
                      aria-label={tt("Перемешать", "Shuffle")}
                      onClick={() => {
                        const rows = Array.from({ length: MODULE_ROWS }, () => {
                          const cols: number[] = [];
                          for (let col = 0; col < settings.columns; col += 1) {
                            if (Math.random() < 0.35) cols.push(col);
                          }
                          return cols;
                        });
                        patch({ skipCells: serializeSkipCells(rows) });
                      }}
                      className="flex size-6 items-center justify-center rounded text-white transition-[box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] fine-hover:hover:inset-ring fine-hover:hover:inset-ring-white motion-reduce:transition-none"
                    >
                      <PanelIcon name="rotate-ccw" className="size-5" />
                    </button>
                  </Row>
                </Section>
              </Sortable>
              </SectionFoldContext.Provider>
          </ParametersPanel>
        ) : null}
        </FloatWindow>
        <FloatWindow resetKey={placeEpoch}>
        <Pop open={settingsOpen}>
          <section data-chrome="" className="flex w-64 flex-col gap-2 rounded-2xl bg-white p-2 text-black">
            <Section title={tt("Внешний вид", "Appearance")} icon="contrast">
              <Row key="style">
                <span className={rowLabel}>{tt("Стиль", "Style")}</span>
                <Segment
                  value={panelStyle}
                  onChange={(next) => writePanelStyle(PANEL_ID, next)}
                  options={[
                    { id: "classic", label: tt("Старый", "Old") },
                    { id: "new", label: tt("Новый", "New") },
                  ]}
                />
              </Row>
              <Row key="locale">
                <span className={rowLabel}>{tt("Язык", "Language")}</span>
                <Segment value={locale} onChange={setLocale} options={[{ id: "ru", label: "Ru" }, { id: "en", label: "Eng" }]} />
              </Row>
              <Row key="theme">
                <span className={rowLabel}>{tt("Тема", "Theme")}</span>
                <IconPick value={theme} onChange={setTheme} options={[{ id: "sun", icon: "sun" }, { id: "moon", icon: "moon" }]} />
              </Row>
              <Row key="place">
                <span className={rowLabel}>{tt("Положение", "Position")}</span>
                <button type="button" onClick={() => setPlaceEpoch((value) => value + 1)} className="h-6 rounded bg-white px-2 text-[14px] text-black">{tt("Сбросить", "Reset")}</button>
              </Row>
            </Section>
            <Section title={tt("Хоткеи", "Hotkeys")} icon="keyboard">
              <Row key="hide">
                <span className={rowLabel}>{tt("Скрыть бар", "Hide bar")}</span>
                <span className="flex items-center gap-1">
                  <KeyCap><CommandMark /></KeyCap>
                  <KeyCap>\</KeyCap>
                </span>
              </Row>
              <Row key="undo">
                <span className={rowLabel}>{tt("Отменить", "Undo")}</span>
                <span className="flex items-center gap-1">
                  <KeyCap><CommandMark /></KeyCap>
                  <KeyCap>{locale === "ru" ? "Я" : "Z"}</KeyCap>
                </span>
              </Row>
            </Section>
            <div className="flex h-4 items-center justify-between px-1 text-[14px] leading-4">
              <span>{tt("Версия", "Version")}</span>
              <span className="text-black/50">{PANEL_VERSION}</span>
            </div>
          </section>
        </Pop>
        </FloatWindow>
        <FloatWindow resetKey={placeEpoch}>
        <Pop open={motionOpen}>
          <MotionWindow
            type={motionType === "physics" ? "physics" : "easing"}
            onType={setMotionType}
            curve={curve}
            onCurve={(next) => patch({ easings: { ...settings.easings, card: { x1: next[0], y1: next[1], x2: next[2], y2: next[3] } } })}
            spring={hover}
            onSpring={(next) => patch({ springs: { ...settings.springs, hover: next } })}
          />
        </Pop>
        </FloatWindow>
        <FloatWindow resetKey={placeEpoch}>
        <Pop open={axisOpen}>
          <AxisWindow
            points={points}
            onPoints={setAxisPoints}
            handles={settings.axisHandles}
            onHandles={(axisHandles) => patch({ axisHandles })}
            selected={selectedPoint}
            onSelect={setSelectedPoint}
            style={axisCorner ? "corner" : "smooth"}
            onStyle={(style) => patch({ axisHandles: settings.axisPoints.map(() => (style === "corner" ? [0, 0] : null)) })}
          />
        </Pop>
        </FloatWindow>
        <FloatWindow resetKey={placeEpoch}>
        <Pop open={paletteOpen}>
          <section data-chrome="" className="flex w-64 flex-col gap-1.5 rounded-2xl bg-white p-2 text-black">
            <header className="flex h-4 items-center px-1">
              <span className="flex min-w-0 items-center gap-1">
                <PanelIcon name="palette" className="size-5" />
                <span className="text-[14px] leading-4">{tt("Палитра", "Palette")}</span>
              </span>
            </header>
              <ColorPicker
                color={pickerDraft ?? pickerColor}
                onChange={paint}
                format={format}
                onFormat={setFormat}
                target={tx(
                  colorKey === "grid"
                    ? P.gridLineColor.label
                    : colorKey === "card"
                      ? P.cardColor.label
                      : colorKey === "stroke"
                        ? P.strokeColor.label
                        : colorKey === "text"
                          ? P.textColor.label
                          : P.backgroundColor.label,
                  locale,
                )}
                targets={[
                  tx(P.backgroundColor.label, locale),
                  ...(settings.showLayoutGrid ? [tx(P.gridLineColor.label, locale)] : []),
                  tx(P.cardColor.label, locale),
                  tx(P.strokeColor.label, locale),
                  tx(P.textColor.label, locale),
                ]}
                onTarget={(label) => {
                  const next =
                    label === tx(P.gridLineColor.label, locale)
                      ? "grid"
                      : label === tx(P.cardColor.label, locale)
                        ? "card"
                        : label === tx(P.strokeColor.label, locale)
                          ? "stroke"
                          : label === tx(P.textColor.label, locale)
                            ? "text"
                            : "background";
                  setPickerDraft(null);
                  setPicker(next);
                }}
              />
          </section>
        </Pop>
        </FloatWindow>
      </DockedWindows>
      </DockAnchorContext.Provider>
    </main>
    </PanelLocale.Provider>
  );
}
