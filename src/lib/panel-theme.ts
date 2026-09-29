"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_DOCK_CORNER,
  DOCK_CORNERS,
  type DockCorner,
} from "../settings-panel/chrome";
import type { PanelLocale } from "../settings-panel/locale";
import { isSfSymbolName, resolvePanelIcon, type SfSymbolName } from "../sf-symbol";

export type PanelTheme = "dark" | "light";
/** UI typeface of the panel. Geist is the consumer webfont; the rest are OS stacks, no files. */
export const PANEL_FONTS = [
  "geist",
  "system",
  "helvetica",
  "georgia",
] as const;
export type PanelFont = (typeof PANEL_FONTS)[number];

export function isPanelFont(value: unknown): value is PanelFont {
  return (
    typeof value === "string" &&
    (PANEL_FONTS as readonly string[]).includes(value)
  );
}

export type { PanelLocale };

export const CHROME_WINDOW_IDS = ["settings", "spring", "bezier", "axis"] as const;
export type ChromeWindowId = (typeof CHROME_WINDOW_IDS)[number];

function parseXy(pos: unknown): { x: number; y: number } | undefined {
  if (!pos || typeof pos !== "object" || Array.isArray(pos)) return;
  const rec = pos as Record<string, unknown>;
  if (
    typeof rec.x === "number" &&
    Number.isFinite(rec.x) &&
    typeof rec.y === "number" &&
    Number.isFinite(rec.y)
  ) {
    return { x: rec.x, y: rec.y };
  }
}

function parseChromeFloat(
  raw: unknown,
): PanelSettingsFile["chromeFloat"] | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const rec = raw as Record<string, unknown>;
  const next: NonNullable<PanelSettingsFile["chromeFloat"]> = {};
  for (const id of CHROME_WINDOW_IDS) {
    const pos = parseXy(rec[id]);
    if (pos) next[id] = pos;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export const PANEL_THEME_EVENT = "experimental:panel-theme";
/** Open a settings-panel view (scene group, Bezier, or Axis). */
export const PANEL_FOCUS_EVENT = "settings-panel:focus";

export type PanelFocusDetail = {
  panelId: string;
  /** Layer group, or `bezier` / `curves` / `axis` for the curve views. */
  group?: string;
  /** `easingTargets[].id` — opens the Bezier dock view on this target. */
  easingId?: string;
};

export function focusPanel(
  panelId: string,
  detail: Omit<PanelFocusDetail, "panelId"> = {},
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PanelFocusDetail>(PANEL_FOCUS_EVENT, {
      detail: { panelId, ...detail },
    }),
  );
}

export function panelThemeStorageKey(panelId: string) {
  return `${panelId}:panel-settings`;
}

export type PanelSettingsFile = {
  theme?: PanelTheme;
  /** Panel Settings segment. Omit = ru. Reset does not clear. */
  locale?: PanelLocale;
  /** UI typeface of the panel chrome. Omit = geist. Reset does not clear. */
  font?: PanelFont;
  /** Panel Settings: edit-sections mode (grip, pin, icon picker). */
  reorderSections?: boolean;
  /** Section ids including Panel Settings. */
  sectionOrder?: string[];
  /** Sections stacked above the scroll. Omit = Panel Settings. */
  pinnedSections?: string[];
  /** Panel window width px. Omit = 348. */
  panelWidth?: number;
  /** Panel window height px. Omit = hug content up to viewport. */
  panelHeight?: number;
  /** Viewport top-left of a free-floating panel. Omit / null = docked to the gear. */
  panelFloat?: { x: number; y: number } | null;
  /** Viewport top-left of a free-floating spring / Bezier / axis window. Omit = docked in the stack beside the scene. */
  chromeFloat?: Partial<Record<ChromeWindowId, { x: number; y: number }>> | null;
  /** Dock Bar slot (4 corners + top / bottom center). Omit = `defaultDockCorner` (top-center). Scene Reset and Panel Settings «Положение» do not clear it. */
  dockSlot?: DockCorner;
  /** Header Lucide glyphs (section / subsection / row). Omit / missing id = schema `icon`. Reset restores schema. */
  sectionIcons?: Record<string, SfSymbolName>;
  /**
   * Last group (and named subsection `copyKey`) where a row was edited.
   * Scene Reset does not clear.
   */
  lastEdited?: { group: string; section?: string };
};

export type { DockCorner as DockSlot };

function parseLastEdited(
  raw: unknown,
): { group: string; section?: string } | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.group !== "string" || rec.group.length === 0) return undefined;
  const next: { group: string; section?: string } = { group: rec.group };
  if (typeof rec.section === "string" && rec.section.length > 0) {
    next.section = rec.section;
  }
  return next;
}

function parseSectionIcons(raw: unknown): Record<string, SfSymbolName> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const next: Record<string, SfSymbolName> = {};
  for (const [id, name] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof name === "string" && isSfSymbolName(name)) {
      const lucide = resolvePanelIcon(name);
      if (lucide) next[id] = lucide;
    }
  }
  return Object.keys(next).length ? next : undefined;
}

const parsedFileCache = new Map<string, PanelSettingsFile>();

export function parsePanelSettingsObject(raw: string | null): PanelSettingsFile {
  if (!raw) return {};
  const cached = parsedFileCache.get(raw);
  if (cached) return cached;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const rec = parsed as Record<string, unknown>;
    const next: PanelSettingsFile = {};
    if (rec.theme === "light" || rec.theme === "dark") next.theme = rec.theme;
    if (rec.locale === "ru" || rec.locale === "en") next.locale = rec.locale;
    if (isPanelFont(rec.font)) next.font = rec.font;
    if (typeof rec.reorderSections === "boolean") {
      next.reorderSections = rec.reorderSections;
    }
    if (
      Array.isArray(rec.sectionOrder) &&
      rec.sectionOrder.every((id) => typeof id === "string")
    ) {
      next.sectionOrder = rec.sectionOrder;
    }
    if (
      Array.isArray(rec.pinnedSections) &&
      rec.pinnedSections.every((id) => typeof id === "string")
    ) {
      next.pinnedSections = rec.pinnedSections;
    }
    if (DOCK_CORNERS.includes(rec.dockSlot as DockCorner)) {
      next.dockSlot = rec.dockSlot as DockCorner;
    }
    if (typeof rec.panelWidth === "number" && Number.isFinite(rec.panelWidth)) {
      next.panelWidth = rec.panelWidth;
    }
    if (
      typeof rec.panelHeight === "number" &&
      Number.isFinite(rec.panelHeight)
    ) {
      next.panelHeight = rec.panelHeight;
    }
    const panelPos = parseXy(rec.panelFloat);
    if (panelPos) next.panelFloat = panelPos;
    const chromePos = parseChromeFloat(rec.chromeFloat);
    if (chromePos) next.chromeFloat = chromePos;
    const icons = parseSectionIcons(rec.sectionIcons);
    if (icons) next.sectionIcons = icons;
    const lastEdited = parseLastEdited(rec.lastEdited);
    if (lastEdited) next.lastEdited = lastEdited;
    if (parsedFileCache.size > 64) parsedFileCache.clear();
    parsedFileCache.set(raw, next);
    return next;
  } catch {
    return {};
  }
}

export function readPanelSettings(
  panelId: string,
  legacyPanelIds: readonly string[] = [],
): PanelSettingsFile {
  if (typeof window === "undefined") return {};
  const primary = window.localStorage.getItem(panelThemeStorageKey(panelId));
  if (primary) return parsePanelSettingsObject(primary);
  for (const legacyId of legacyPanelIds) {
    const raw = window.localStorage.getItem(panelThemeStorageKey(legacyId));
    if (!raw) continue;
    return parsePanelSettingsObject(raw);
  }
  return {};
}

export function pickPanelLayout(file: PanelSettingsFile): PanelSettingsFile {
  const next: PanelSettingsFile = {};
  if (file.dockSlot) next.dockSlot = file.dockSlot;
  if (file.panelFloat !== undefined) next.panelFloat = file.panelFloat;
  if (file.chromeFloat) next.chromeFloat = file.chromeFloat;
  if (file.panelWidth != null) next.panelWidth = file.panelWidth;
  if (file.panelHeight != null) next.panelHeight = file.panelHeight;
  if (file.theme) next.theme = file.theme;
  if (file.locale) next.locale = file.locale;
  if (file.font) next.font = file.font;
  return next;
}

export function panelLayoutHasChrome(file: PanelSettingsFile) {
  return (
    file.dockSlot != null ||
    file.panelFloat != null ||
    file.chromeFloat != null ||
    file.panelWidth != null ||
    file.panelHeight != null
  );
}

/** Dock, float, and window size. `layoutPanelId` shares them across scenes. */
export function readPanelLayout(
  panelId: string,
  layoutPanelId?: string,
  legacyPanelIds: readonly string[] = [],
): PanelSettingsFile {
  if (layoutPanelId) {
    const shared = readPanelSettings(layoutPanelId);
    if (panelLayoutHasChrome(shared)) return pickPanelLayout(shared);
  }
  const scene = readPanelSettings(panelId, legacyPanelIds);
  if (panelLayoutHasChrome(scene)) {
    const layout = pickPanelLayout(scene);
    if (layoutPanelId) writePanelSettings(layoutPanelId, layout);
    return layout;
  }
  return {};
}

export function writePanelSettings(
  panelId: string,
  patch: PanelSettingsFile,
) {
  if (typeof window === "undefined") return;
  const prev = readPanelSettings(panelId);
  const next: PanelSettingsFile = { ...prev, ...patch };
  if (patch.sectionOrder !== undefined) next.sectionOrder = patch.sectionOrder;
  if (patch.pinnedSections !== undefined) {
    next.pinnedSections = patch.pinnedSections;
  }
  if (patch.panelWidth !== undefined) next.panelWidth = patch.panelWidth;
  if (patch.panelHeight !== undefined) next.panelHeight = patch.panelHeight;
  if (patch.panelFloat !== undefined) {
    if (patch.panelFloat === null) delete next.panelFloat;
    else next.panelFloat = patch.panelFloat;
  }
  if (patch.chromeFloat !== undefined) {
    if (
      patch.chromeFloat == null ||
      Object.keys(patch.chromeFloat).length === 0
    ) {
      delete next.chromeFloat;
    } else next.chromeFloat = patch.chromeFloat;
  }
  if (patch.sectionIcons !== undefined) {
    if (Object.keys(patch.sectionIcons).length === 0) delete next.sectionIcons;
    else next.sectionIcons = patch.sectionIcons;
  }
  try {
    window.localStorage.setItem(
      panelThemeStorageKey(panelId),
      JSON.stringify(next),
    );
  } catch {
    /* quota / private mode */
    return;
  }
  const theme = next.theme === "light" ? "light" : "dark";
  window.dispatchEvent(
    new CustomEvent(PANEL_THEME_EVENT, { detail: { panelId, theme } }),
  );
}

export function readPanelTheme(
  panelId: string,
  legacyPanelIds: readonly string[] = [],
): PanelTheme {
  return readPanelSettings(panelId, legacyPanelIds).theme === "light"
    ? "light"
    : "dark";
}

export function readPanelLocale(
  panelId: string,
  legacyPanelIds: readonly string[] = [],
): PanelLocale {
  return readPanelSettings(panelId, legacyPanelIds).locale === "en"
    ? "en"
    : "ru";
}

export function readPanelFont(
  panelId: string,
  legacyPanelIds: readonly string[] = [],
): PanelFont {
  const stored = readPanelSettings(panelId, legacyPanelIds).font;
  return isPanelFont(stored) ? stored : "geist";
}

export function writePanelTheme(panelId: string, theme: PanelTheme) {
  writePanelSettings(panelId, { theme });
}

export function writePanelLocale(panelId: string, locale: PanelLocale) {
  writePanelSettings(panelId, { locale });
}

export function writePanelFont(panelId: string, font: PanelFont) {
  writePanelSettings(panelId, { font });
}

export function closestPanelFont(el: Element | null): PanelFont {
  const raw = el?.closest("[data-panel-font]")?.getAttribute("data-panel-font");
  return isPanelFont(raw) ? raw : "geist";
}

export function subscribePanelTheme(
  panelId: string,
  onChange: () => void,
): () => void {
  const onCustom = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as { panelId?: string } | undefined;
    if (detail?.panelId === panelId) onChange();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === panelThemeStorageKey(panelId)) onChange();
  };
  window.addEventListener(PANEL_THEME_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PANEL_THEME_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePanelTheme(
  panelId: string,
  legacyPanelIds: readonly string[] = [],
): PanelTheme {
  return useSyncExternalStore(
    (onChange) => subscribePanelTheme(panelId, onChange),
    () => readPanelTheme(panelId, legacyPanelIds),
    () => "dark",
  );
}

export function usePanelLocale(
  panelId: string,
  legacyPanelIds: readonly string[] = [],
): PanelLocale {
  return useSyncExternalStore(
    (onChange) => subscribePanelTheme(panelId, onChange),
    () => readPanelLocale(panelId, legacyPanelIds),
    () => "ru",
  );
}

export function usePanelFont(
  panelId: string,
  legacyPanelIds: readonly string[] = [],
): PanelFont {
  return useSyncExternalStore(
    (onChange) => subscribePanelTheme(panelId, onChange),
    () => readPanelFont(panelId, legacyPanelIds),
    () => "geist",
  );
}

/** Dock Bar slot from `${layoutPanelId ?? panelId}:panel-settings`. */
export function useDockSlot(
  panelId: string | undefined,
  layoutPanelId?: string,
  fallback: DockCorner = DEFAULT_DOCK_CORNER,
) {
  const storeId = layoutPanelId ?? panelId;
  return useSyncExternalStore(
    (onChange) => (storeId ? subscribePanelTheme(storeId, onChange) : () => {}),
    () =>
      (storeId ? readPanelSettings(storeId).dockSlot : undefined) ?? fallback,
    () => fallback,
  );
}
