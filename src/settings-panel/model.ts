"use client";

import type { CubicBezier } from "../lib/cubic-bezier";
import type { Copy, PanelLocale } from "./locale";
import { PANEL_COPY, tx } from "./locale";
import type {
  EasingTarget,
  SettingsGroup,
  PlayerSetting,
  SettingsPlace,
  SettingsSection,
} from "./types";
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
export const BEZIER_VIEW_ID = "bezier-view";
export const AXIS_VIEW_ID = "axis-view";
export const DEFAULT_PINNED_SECTIONS: readonly string[] = [];

export function withoutRetiredSectionIds(ids: readonly string[]) {
  return ids.filter((id) => id !== PRESETS_SECTION_ID && id !== PANEL_SECTION_ID);
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
  "refs",
  "derived",
] as const;

/** Row bags — keep in sync with `SectionRows`. */
export function sectionHasRows<TSettings>(section: SettingsSection<TSettings>) {
  return SECTION_ROW_BAGS.some((key) => {
    const bag = section[key];
    return Array.isArray(bag) && bag.length > 0;
  });
}

/** Keys one phase writes: duration, absolute start, stagger step. */
export function phaseKeys<TSettings>(
  phase: PlayerSetting<TSettings>["phases"][number],
): (keyof TSettings)[] {
  const keys: (keyof TSettings)[] = [phase.key];
  if (phase.startKey != null) keys.push(phase.startKey);
  if (phase.stagger != null) keys.push(phase.stagger.stepKey);
  return keys;
}

/** Every key a dock player writes: total + `phaseKeys` of each phase. */
export function playerKeySet<TSettings>(
  players: readonly PlayerSetting<TSettings>[],
): Set<keyof TSettings> {
  const keys = new Set<keyof TSettings>();
  for (const player of players) {
    keys.add(player.totalKey);
    for (const phase of player.phases) {
      for (const key of phaseKeys(phase)) keys.add(key);
    }
  }
  return keys;
}

/**
 * Phases live only on the timeline: number rows (and refs to them) whose key a
 * dock player already owns are not rendered. The values still count in
 * Reset / Copy through `players`.
 */
export function omitPlayerKeyRows<TSettings>(
  groups: readonly SettingsGroup<TSettings>[],
  players: readonly PlayerSetting<TSettings>[],
): SettingsGroup<TSettings>[] {
  const owned = playerKeySet(players);
  if (owned.size === 0) return [...groups];
  const out: SettingsGroup<TSettings>[] = [];
  for (const group of groups) {
    const sections: SettingsSection<TSettings>[] = [];
    for (const section of group.sections) {
      const settings = section.settings?.filter((row) => !owned.has(row.key));
      const refs = section.refs?.filter((row) => !owned.has(row.ref));
      const touched =
        (settings?.length ?? 0) !== (section.settings?.length ?? 0) ||
        (refs?.length ?? 0) !== (section.refs?.length ?? 0);
      if (!touched) {
        sections.push(section);
        continue;
      }
      const next = {
        ...section,
        settings: nonempty(settings),
        refs: nonempty(refs),
      };
      if (sectionHasRows(next)) sections.push(next);
    }
    if (sections.length === 0) continue;
    out.push({ ...group, sections });
  }
  return out;
}

/** Keep only rows whose keys sit in the picked place. Empty section → null. */
export function filterSectionByPlace<TSettings>(
  section: SettingsSection<TSettings>,
  keys: ReadonlySet<keyof TSettings>,
  placeId?: string,
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
    refs: nonempty(section.refs?.filter((row) => keep(row.ref))),
    derived: nonempty(
      section.derived?.filter(
        (row) =>
          (placeId != null && row.where?.includes(placeId)) ||
          (row.after != null && keep(row.after)),
      ),
    ),
  };
  return sectionHasRows(next) ? next : null;
}

export function filterGroupsByPlace<TSettings>(
  groups: SettingsGroup<TSettings>[],
  keys: ReadonlySet<keyof TSettings>,
  placeId?: string,
): SettingsGroup<TSettings>[] {
  const out: SettingsGroup<TSettings>[] = [];
  for (const group of groups) {
    const sections = group.sections
      .map((section) => filterSectionByPlace(section, keys, placeId))
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

function searchTexts(
  part: Copy | string | number | undefined | null,
): string[] {
  if (part == null) return [];
  if (typeof part === "number") return [String(part)];
  if (typeof part === "string") return [part];
  return [part.ru, part.en];
}

function searchTokens(text: string) {
  return text
    .toLowerCase()
    .replaceAll("ё", "е")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Label / title / key — not ⓘ info. Short mid-phrase words ("до") do not count. */
function searchMatch(
  q: string,
  ...parts: Array<Copy | string | number | undefined | null>
) {
  const nq = q.trim().toLowerCase().replaceAll("ё", "е");
  if (!nq) return true;
  return parts.flatMap(searchTexts).some((text) => {
    const tokens = searchTokens(
      text.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " "),
    );
    return tokens.some((tok) => {
      if (!tok.startsWith(nq)) return false;
      if (tok === nq && tok.length <= 2 && tokens.length > 1) return false;
      return true;
    });
  });
}

function sectionKeySet<TSettings>(section: SettingsSection<TSettings>) {
  const keys = new Set<string>();
  const add = (key: unknown) => {
    if (key != null && String(key) !== "") keys.add(String(key));
  };
  for (const row of section.settings ?? []) add(row.key);
  for (const row of section.pairs ?? []) {
    add(row.fields[0].key);
    add(row.fields[1].key);
  }
  for (const row of section.ranges ?? []) {
    add(row.fromKey);
    add(row.toKey);
  }
  for (const row of section.colors ?? []) {
    add(row.key);
    add(row.opacityKey);
  }
  for (const row of section.toggles ?? []) add(row.key);
  for (const row of section.anchors ?? []) add(row.key);
  for (const row of section.xAnchors ?? []) add(row.key);
  for (const row of section.textAligns ?? []) add(row.key);
  for (const row of section.orients ?? []) add(row.key);
  for (const row of section.enums ?? []) add(row.key);
  for (const row of section.texts ?? []) add(row.key);
  for (const row of section.custom ?? []) {
    for (const item of row.keys ?? []) add(item.key);
  }
  for (const row of section.refs ?? []) add(row.ref);
  for (const row of section.derived ?? []) add(row.id);
  return keys;
}

function dropAfterIfOrphan<T extends { after?: unknown }>(
  row: T,
  present: Set<string>,
): T {
  if (row.after == null || present.has(String(row.after))) return row;
  return { ...row, after: undefined };
}

/** `after` rows do not emit without a parent — drop the hook so they stay visible. */
function untetherOrphanAfter<TSettings>(
  section: SettingsSection<TSettings>,
): SettingsSection<TSettings> {
  const present = sectionKeySet(section);
  const map = <T extends { after?: unknown }>(
    rows: T[] | undefined,
  ): T[] | undefined =>
    nonempty(rows?.map((row) => dropAfterIfOrphan(row, present)));
  return {
    ...section,
    settings: map(section.settings),
    ranges: map(section.ranges),
    colors: map(section.colors),
    toggles: map(section.toggles),
    anchors: map(section.anchors),
    xAnchors: map(section.xAnchors),
    textAligns: map(section.textAligns),
    enums: map(section.enums),
    texts: map(section.texts),
    custom: map(section.custom),
    refs: map(section.refs),
    derived: map(section.derived),
  };
}

/** Matching easing targets for dock search. `null` = query empty (show all). */
export function filterEasingTargetsBySearch(
  targets: readonly EasingTarget[],
  query: string,
): EasingTarget[] | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  if (searchMatch(q, PANEL_COPY.bezierCurve, "bezier easing curve spline")) {
    return [...targets];
  }
  return targets.filter((target) => searchMatch(q, target.label, target.id));
}

function filterSectionBySearch<TSettings>(
  section: SettingsSection<TSettings>,
  q: string,
): SettingsSection<TSettings> | null {
  if (searchMatch(q, section.title)) return section;
  const next: SettingsSection<TSettings> = {
    ...section,
    settings: nonempty(
      section.settings?.filter((row) =>
        searchMatch(q, row.label, String(row.key)),
      ),
    ),
    pairs: nonempty(
      section.pairs?.filter(
        (row) =>
          searchMatch(q, row.label) ||
          row.fields.some((field) =>
            searchMatch(q, field.ariaLabel, String(field.key)),
          ),
      ),
    ),
    ranges: nonempty(
      section.ranges?.filter((row) =>
        searchMatch(q, row.label, String(row.fromKey), String(row.toKey)),
      ),
    ),
    colors: nonempty(
      section.colors?.filter((row) =>
        searchMatch(
          q,
          row.label,
          String(row.key),
          row.opacityKey != null ? String(row.opacityKey) : "",
        ),
      ),
    ),
    toggles: nonempty(
      section.toggles?.filter((row) =>
        searchMatch(
          q,
          row.label,
          row.onLabel,
          row.offLabel,
          String(row.key),
        ),
      ),
    ),
    anchors: nonempty(
      section.anchors?.filter((row) =>
        searchMatch(q, row.label, String(row.key)),
      ),
    ),
    xAnchors: nonempty(
      section.xAnchors?.filter((row) =>
        searchMatch(q, row.label, String(row.key)),
      ),
    ),
    textAligns: nonempty(
      section.textAligns?.filter((row) =>
        searchMatch(q, row.label, String(row.key)),
      ),
    ),
    orients: nonempty(
      section.orients?.filter((row) =>
        searchMatch(q, row.label, String(row.key)),
      ),
    ),
    enums: nonempty(
      section.enums?.filter(
        (row) =>
          searchMatch(q, row.label, String(row.key)) ||
          row.options.some((option) =>
            searchMatch(q, option.label, option.value),
          ),
      ),
    ),
    texts: nonempty(
      section.texts?.filter((row) =>
        searchMatch(q, row.label, String(row.key)),
      ),
    ),
    custom: nonempty(
      section.custom?.filter(
        (row) =>
          searchMatch(q, row.id) ||
          (row.keys ?? []).some((item) =>
            searchMatch(q, item.label, String(item.key)),
          ),
      ),
    ),
    refs: nonempty(
      section.refs?.filter((row) => searchMatch(q, String(row.ref))),
    ),
    derived: nonempty(
      section.derived?.filter((row) =>
        searchMatch(q, row.label, row.id),
      ),
    ),
  };
  const shown = untetherOrphanAfter(next);
  return sectionHasRows(shown) ? shown : null;
}

export function filterGroupsBySearch<TSettings>(
  groups: SettingsGroup<TSettings>[],
  query: string,
): SettingsGroup<TSettings>[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  const out: SettingsGroup<TSettings>[] = [];
  for (const group of groups) {
    if (searchMatch(q, group.title, group.id)) {
      out.push(group);
      continue;
    }
    const sections = group.sections
      .map((section) => filterSectionBySearch(section, q))
      .filter((section): section is SettingsSection<TSettings> => section != null);
    if (sections.length === 0) continue;
    out.push({ ...group, sections });
  }
  return out;
}

function inPlace(
  where: readonly string[] | undefined,
  placeId: string,
) {
  return where?.includes(placeId) === true;
}

/**
 * Effective `keys` / `easingIds` for pointer mode: rows (and easing targets)
 * whose `where` includes the place id, union explicit extras on the place.
 * Order follows group → section → default row bags (player first).
 */
export function resolvePlaces<TSettings>(
  groups: readonly SettingsGroup<TSettings>[],
  places: readonly SettingsPlace<TSettings>[],
  easingTargets?: readonly EasingTarget[],
): SettingsPlace<TSettings>[] {
  return places.map((place) => {
    const keys: (keyof TSettings)[] = [];
    const seen = new Set<PropertyKey>();
    const add = (key: keyof TSettings | undefined) => {
      if (key == null || seen.has(key)) return;
      seen.add(key);
      keys.push(key);
    };

    for (const group of groups) {
      if (inPlace(group.where, place.id)) add(group.visibilityKey);
      for (const section of group.sections) {
        if (inPlace(section.where, place.id)) add(section.visibilityKey);
        for (const row of section.colors ?? []) {
          if (!inPlace(row.where, place.id)) continue;
          add(row.key);
          add(row.opacityKey);
        }
        for (const row of section.orients ?? []) {
          if (inPlace(row.where, place.id)) add(row.key);
        }
        for (const row of section.toggles ?? []) {
          if (inPlace(row.where, place.id)) add(row.key);
        }
        for (const row of section.texts ?? []) {
          if (inPlace(row.where, place.id)) add(row.key);
        }
        for (const row of section.custom ?? []) {
          if (!inPlace(row.where, place.id)) continue;
          for (const item of row.keys ?? []) add(item.key);
        }
        for (const row of section.settings ?? []) {
          if (inPlace(row.where, place.id)) add(row.key);
        }
        for (const row of section.pairs ?? []) {
          if (!inPlace(row.where, place.id)) continue;
          add(row.fields[0].key);
          add(row.fields[1].key);
        }
        for (const row of section.ranges ?? []) {
          if (!inPlace(row.where, place.id)) continue;
          add(row.fromKey);
          add(row.toKey);
        }
        for (const row of section.enums ?? []) {
          if (inPlace(row.where, place.id)) add(row.key);
        }
        for (const row of section.anchors ?? []) {
          if (inPlace(row.where, place.id)) add(row.key);
        }
        for (const row of section.xAnchors ?? []) {
          if (inPlace(row.where, place.id)) add(row.key);
        }
        for (const row of section.textAligns ?? []) {
          if (inPlace(row.where, place.id)) add(row.key);
        }
        for (const row of section.refs ?? []) {
          if (inPlace(row.where, place.id)) add(row.ref);
        }
      }
    }

    for (const key of place.keys ?? []) add(key);

    const easingIds: string[] = [];
    const seenEasing = new Set<string>();
    const addEasing = (id: string) => {
      if (seenEasing.has(id)) return;
      seenEasing.add(id);
      easingIds.push(id);
    };
    for (const target of easingTargets ?? []) {
      if (inPlace(target.where, place.id)) addEasing(target.id);
    }
    for (const id of place.easingIds ?? []) addEasing(id);

    return { ...place, keys, easingIds };
  });
}

export function collectGroupKeys<TSettings>(
  groups: readonly SettingsGroup<TSettings>[],
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

/** Keys owned by a dock `SettingsTimeline` (`PlayerSetting` not in `groups`). */
export function collectPlayerKeys<TSettings>(
  players: readonly PlayerSetting<TSettings>[] | undefined,
): Set<keyof TSettings> {
  return playerKeySet(players ?? []);
}

export function visitPlayerKeys<TSettings>(
  player: PlayerSetting<TSettings>,
  visit: (key: keyof TSettings, label: string) => void,
  locale: PanelLocale,
) {
  const name = tx(player.label, locale);
  visit(player.totalKey, `${name}: ${tx(PANEL_COPY.animationTime, locale)}`);
  for (const phase of player.phases) {
    const caption = tx(phase.caption, locale);
    visit(phase.key, `${name}: ${caption}`);
    if (phase.startKey != null) {
      visit(
        phase.startKey,
        `${name}: ${caption} · ${tx(PANEL_COPY.clipStart, locale)}`,
      );
    }
    if (phase.stagger != null) {
      visit(
        phase.stagger.stepKey,
        `${name}: ${caption} · ${tx(PANEL_COPY.staggerStep, locale)}`,
      );
    }
  }
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

export function formatSettingCopyValue(value: unknown): string {
  return typeof value === "string" ||
    (typeof value === "object" && value !== null)
    ? JSON.stringify(value)
    : String(value);
}

export type AgentDefaultsSubsection = {
  title: string | null;
  lines: string[];
};

export type AgentDefaultsGroup = {
  title: string;
  subsections: AgentDefaultsSubsection[];
};

export function formatAgentDefaultsCopy(args: {
  header: string;
  iconsTitle: string;
  footer: string;
  groups: AgentDefaultsGroup[];
  trailingLines: string[];
  iconLines: string[];
}): string {
  const lines: string[] = [args.header];
  for (const group of args.groups) {
    lines.push(group.title);
    for (const sub of group.subsections) {
      if (sub.title != null) {
        lines.push(`  ${sub.title}`);
        for (const line of sub.lines) lines.push(`    ${line}`);
      } else {
        for (const line of sub.lines) lines.push(`  ${line}`);
      }
    }
  }
  for (const line of args.trailingLines) lines.push(line);
  if (args.iconLines.length > 0) {
    lines.push(args.iconsTitle);
    for (const line of args.iconLines) lines.push(`  ${line}`);
  }
  lines.push("");
  lines.push(args.footer);
  return lines.join("\n");
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

