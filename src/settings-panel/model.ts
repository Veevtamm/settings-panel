"use client";

import type { CubicBezier } from "../lib/cubic-bezier";
import type { Copy, PanelLocale } from "./locale";
import { PANEL_COPY, tx } from "./locale";
import type { SettingsGroup, SettingsSection } from "./types";
import { SECTION_MS, EASE_OUT } from "./chrome";

export function valuesEqual(a: unknown, b: unknown) {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

export function isMember<T extends string>(
  value: unknown,
  all: readonly T[],
): value is T {
  return typeof value === "string" && (all as readonly string[]).includes(value);
}

export function mergeSectionOrder(current: string[], saved: string[] | undefined) {
  if (!saved?.length) return current;
  const have = new Set(current);
  const next = saved.filter((title) => have.has(title));
  const placed = new Set(next);
  for (const title of current) {
    if (placed.has(title)) continue;
    next.push(title);
    placed.add(title);
  }
  return next;
}

export const PRESETS_SECTION_ID = "presets";
export const PANEL_SECTION_ID = "panel";
export const PLACE_SECTION_ID = "place";
export const DEFAULT_PINNED_SECTIONS = [PANEL_SECTION_ID] as const;

export function withoutRetiredSectionIds(ids: readonly string[]) {
  return ids.filter((id) => id !== PRESETS_SECTION_ID);
}

/** Keep Panel Settings last unless the saved order already names it. */
export function mergeChromeSectionOrder(
  current: string[],
  saved: string[] | undefined,
) {
  const merged = mergeSectionOrder(
    current,
    saved ? withoutRetiredSectionIds(saved) : saved,
  );
  const named = new Set(saved ?? []);
  if (current.includes(PANEL_SECTION_ID) && !named.has(PANEL_SECTION_ID)) {
    return [...merged.filter((id) => id !== PANEL_SECTION_ID), PANEL_SECTION_ID];
  }
  return merged;
}

export function splitPinnedSectionRails(
  ordered: readonly string[],
  pinned: ReadonlySet<string>,
): { top: string[]; mid: string[] } {
  return {
    top: ordered.filter((id) => pinned.has(id)),
    mid: ordered.filter((id) => !pinned.has(id)),
  };
}

export type LiftSize = { width: number; height: number };
export type LiftXy = { x: number; y: number };

export function applyLiftTransform(
  el: HTMLElement | null,
  xy: LiftXy | null,
) {
  if (!el || !xy) return;
  el.style.transform = `translate3d(${xy.x}px, ${xy.y}px, 0)`;
}

export function clampLiftY(
  clientY: number,
  offsetY: number,
  panel: DOMRect,
  height: number,
) {
  const minY = panel.top;
  const maxY = panel.bottom - height;
  const y = clientY - offsetY;
  return maxY < minY ? minY : Math.min(maxY, Math.max(minY, y));
}

export function insertIndexFromClientY(
  blocks: readonly HTMLElement[],
  clientY: number,
) {
  let insertAt = 0;
  for (const block of blocks) {
    const rect = block.getBoundingClientRect();
    if (clientY > rect.top + rect.height / 2) insertAt += 1;
  }
  return insertAt;
}

export function blockTopsByAttr(
  blocks: readonly HTMLElement[],
  attr: "sectionId" | "subsectionTitle",
) {
  const fromTops = new Map<string, number>();
  for (const block of blocks) {
    const id =
      attr === "sectionId"
        ? block.dataset.sectionId
        : block.dataset.subsectionTitle;
    if (!id) continue;
    fromTops.set(id, block.getBoundingClientRect().top);
  }
  return fromTops;
}

export function moveTitleToIndex(order: string[], from: string, insertAt: number) {
  const fromIndex = order.indexOf(from);
  if (fromIndex < 0) return order;
  let at = insertAt;
  if (fromIndex < insertAt) at -= 1;
  at = Math.max(0, Math.min(order.length - 1, at));
  if (fromIndex === at) return order;
  const next = order.filter((title) => title !== from);
  next.splice(at, 0, from);
  return next;
}

export function playListFlip(
  root: Element,
  attr: "data-subsection-title" | "data-section-id",
  fromTops: Map<string, number>,
  skipId: string | null,
) {
  const flipShift = (block: HTMLElement) =>
    block.querySelector<HTMLElement>("[data-subsection-shift]") ??
    block.querySelector<HTMLElement>("[data-section-shift]") ??
    block;
  const blocks = [...root.querySelectorAll<HTMLElement>(`[${attr}]`)];
  for (const block of blocks) {
    const shift = flipShift(block);
    for (const anim of shift.getAnimations()) anim.cancel();
  }
  for (const block of blocks) {
    const title =
      attr === "data-section-id"
        ? block.dataset.sectionId
        : block.dataset.subsectionTitle;
    if (!title || title === skipId) continue;
    const fromTop = fromTops.get(title);
    if (fromTop == null) continue;
    const dy = fromTop - block.getBoundingClientRect().top;
    if (Math.abs(dy) < 0.5) continue;
    const shift = flipShift(block);
    shift.animate(
      [
        { transform: `translateY(${dy}px)` },
        { transform: "translateY(0px)" },
      ],
      { duration: SECTION_MS, easing: EASE_OUT },
    );
  }
}

export function visitSectionKeys<TSettings>(
  section: SettingsSection<TSettings>,
  visit: (key: keyof TSettings, label: string) => void,
  locale: PanelLocale = "ru",
) {
  const t = (copy: Copy) => tx(copy, locale);
  for (const row of section.settings ?? []) visit(row.key, t(row.label));
  for (const pair of section.pairs ?? []) {
    for (const field of pair.fields) visit(field.key, t(field.ariaLabel));
  }
  for (const row of section.ranges ?? []) {
    visit(row.fromKey, `${t(row.label)} ${tx(PANEL_COPY.rangeMin, locale)}`);
    visit(row.toKey, `${t(row.label)} ${tx(PANEL_COPY.rangeMax, locale)}`);
  }
  for (const row of section.colors ?? []) {
    visit(row.key, t(row.label));
    if (row.opacityKey) {
      visit(row.opacityKey, `${t(row.label)}: ${tx(PANEL_COPY.opacity, locale)}`);
    }
  }
  for (const row of section.toggles ?? []) visit(row.key, t(row.label));
  for (const row of section.anchors ?? []) visit(row.key, t(row.label));
  for (const row of section.xAnchors ?? []) visit(row.key, t(row.label));
  for (const row of section.textAligns ?? []) visit(row.key, t(row.label));
  for (const row of section.orients ?? []) visit(row.key, t(row.label));
  for (const row of section.enums ?? []) visit(row.key, t(row.label));
  for (const row of section.texts ?? []) visit(row.key, t(row.label));
  const player = section.player;
  if (player) {
    for (const phase of player.phases) {
      visit(phase.key, `${t(player.label)}: ${t(phase.caption)}`);
    }
  }
  for (const row of section.custom ?? []) {
    for (const item of row.keys ?? []) visit(item.key, t(item.label));
  }
}

function nonempty<T>(list: readonly T[] | undefined): T[] | undefined {
  return list != null && list.length > 0 ? [...list] : undefined;
}

const SECTION_ROW_BAGS = [
  "settings",
  "pairs",
  "ranges",
  "colors",
  "toggles",
  "anchors",
  "xAnchors",
  "textAligns",
  "orients",
  "enums",
  "texts",
  "custom",
] as const;

/** Non-player row bags — keep in sync with `SectionRows`. */
export function sectionHasStandardRows<TSettings>(
  section: SettingsSection<TSettings>,
) {
  return SECTION_ROW_BAGS.some((key) => {
    const bag = section[key];
    return Array.isArray(bag) && bag.length > 0;
  });
}

export function sectionHasRows<TSettings>(section: SettingsSection<TSettings>) {
  return sectionHasStandardRows(section) || section.player != null;
}

/** Hide a player that a place filter unmounted — HUD / scroll-view stay on `controller.open`. */
export function closePlayersHiddenByPlace<TSettings>(
  groups: readonly SettingsGroup<TSettings>[],
  keys: ReadonlySet<keyof TSettings> | null,
) {
  for (const group of groups) {
    for (const section of group.sections) {
      const player = section.player;
      if (!player) continue;
      const visible =
        keys == null || player.phases.some((phase) => keys.has(phase.key));
      if (!visible && player.controller.getState().open) {
        player.controller.setOpen(false);
      }
    }
  }
}

/** Keep only rows whose keys sit in the picked place. Empty section → null. */
export function filterSectionByPlace<TSettings>(
  section: SettingsSection<TSettings>,
  keys: ReadonlySet<keyof TSettings>,
): SettingsSection<TSettings> | null {
  const keep = (key: keyof TSettings) => keys.has(key);
  const next: SettingsSection<TSettings> = {
    ...section,
    visibilityKey:
      section.visibilityKey != null && keep(section.visibilityKey)
        ? section.visibilityKey
        : undefined,
    settings: nonempty(section.settings?.filter((row) => keep(row.key))),
    pairs: nonempty(
      section.pairs?.filter((row) => row.fields.some((field) => keep(field.key))),
    ),
    ranges: nonempty(
      section.ranges?.filter((row) => keep(row.fromKey) || keep(row.toKey)),
    ),
    colors: nonempty(
      section.colors?.filter(
        (row) => keep(row.key) || (row.opacityKey != null && keep(row.opacityKey)),
      ),
    ),
    toggles: nonempty(section.toggles?.filter((row) => keep(row.key))),
    anchors: nonempty(section.anchors?.filter((row) => keep(row.key))),
    xAnchors: nonempty(section.xAnchors?.filter((row) => keep(row.key))),
    textAligns: nonempty(section.textAligns?.filter((row) => keep(row.key))),
    orients: nonempty(section.orients?.filter((row) => keep(row.key))),
    enums: nonempty(section.enums?.filter((row) => keep(row.key))),
    texts: nonempty(section.texts?.filter((row) => keep(row.key))),
    custom: nonempty(
      section.custom?.filter((row) =>
        (row.keys ?? []).some((item) => keep(item.key)),
      ),
    ),
    player:
      section.player != null &&
      section.player.phases.some((phase) => keep(phase.key))
        ? section.player
        : undefined,
  };
  return sectionHasRows(next) ? next : null;
}

export function filterGroupsByPlace<TSettings>(
  groups: SettingsGroup<TSettings>[],
  keys: ReadonlySet<keyof TSettings>,
): SettingsGroup<TSettings>[] {
  const out: SettingsGroup<TSettings>[] = [];
  for (const group of groups) {
    const sections = group.sections
      .map((section) => filterSectionByPlace(section, keys))
      .filter((section): section is SettingsSection<TSettings> => section != null);
    if (sections.length === 0) continue;
    out.push({
      ...group,
      sections,
      visibilityKey:
        group.visibilityKey != null && keys.has(group.visibilityKey)
          ? group.visibilityKey
          : undefined,
    });
  }
  return out;
}

export function collectGroupKeys<TSettings>(
  groups: SettingsGroup<TSettings>[],
): Set<keyof TSettings> {
  const keys = new Set<keyof TSettings>();
  const add = (key: keyof TSettings | undefined) => {
    if (key != null) keys.add(key);
  };
  for (const group of groups) {
    add(group.visibilityKey);
    for (const section of group.sections) {
      add(section.visibilityKey);
      visitSectionKeys(section, (key) => add(key));
    }
  }
  return keys;
}

export function readMigratedPanelUi(
  panelId: string,
  suffix: ":subsection-order" | ":panel-settings" | ":snapshots",
  legacyPanelIds: readonly string[],
): string | null {
  const primaryKey = `${panelId}${suffix}`;
  const primary = localStorage.getItem(primaryKey);
  if (primary) return primary;
  for (const legacyId of legacyPanelIds) {
    const raw = localStorage.getItem(`${legacyId}${suffix}`);
    if (!raw) continue;
    try {
      localStorage.setItem(primaryKey, raw);
    } catch {
      /* quota / private mode */
    }
    return raw;
  }
  return null;
}

export function readEasings(
  settings: unknown,
): Record<string, CubicBezier> | undefined {
  if (
    settings !== null &&
    typeof settings === "object" &&
    "easings" in settings &&
    settings.easings !== null &&
    typeof settings.easings === "object"
  ) {
    return settings.easings as Record<string, CubicBezier>;
  }
  return undefined;
}

