"use client";

import { useSyncExternalStore } from "react";
import type { PanelLocale } from "../settings-panel/locale";

export type PanelTheme = "dark" | "light";
export type { PanelLocale };

export const PANEL_THEME_EVENT = "experimental:panel-theme";

export function panelThemeStorageKey(panelId: string) {
  return `${panelId}:panel-settings`;
}

export type PanelSettingsFile = {
  theme?: PanelTheme;
  /** Panel Settings segment. Omit = ru. Reset does not clear. */
  locale?: PanelLocale;
  /** Panel Settings: section reorder mode (Изменить / Сохранить). */
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
  /** Gear dock corner. Omit = top-left. Reset does not clear. */
  dockCorner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** @deprecated migrated to dockCorner */
  dockX?: number;
  dockY?: number;
};

export function parsePanelSettingsObject(raw: string | null): PanelSettingsFile {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const rec = parsed as Record<string, unknown>;
    const next: PanelSettingsFile = {};
    if (rec.theme === "light" || rec.theme === "dark") next.theme = rec.theme;
    if (rec.locale === "ru" || rec.locale === "en") next.locale = rec.locale;
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
    if (
      rec.dockCorner === "top-left" ||
      rec.dockCorner === "top-right" ||
      rec.dockCorner === "bottom-left" ||
      rec.dockCorner === "bottom-right"
    ) {
      next.dockCorner = rec.dockCorner;
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
    if (rec.panelFloat && typeof rec.panelFloat === "object" && !Array.isArray(rec.panelFloat)) {
      const pos = rec.panelFloat as Record<string, unknown>;
      if (
        typeof pos.x === "number" &&
        Number.isFinite(pos.x) &&
        typeof pos.y === "number" &&
        Number.isFinite(pos.y)
      ) {
        next.panelFloat = { x: pos.x, y: pos.y };
      }
    }
    if (typeof rec.dockX === "number" && Number.isFinite(rec.dockX)) {
      next.dockX = rec.dockX;
    }
    if (typeof rec.dockY === "number" && Number.isFinite(rec.dockY)) {
      next.dockY = rec.dockY;
    }
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
  delete next.dockX;
  delete next.dockY;
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

export function writePanelTheme(panelId: string, theme: PanelTheme) {
  writePanelSettings(panelId, { theme });
}

export function writePanelLocale(panelId: string, locale: PanelLocale) {
  writePanelSettings(panelId, { locale });
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
