import { formatBezierInput } from "../lib/cubic-bezier";
import { formatSpring, readSprings } from "../lib/spring";
import type { SfSymbolName } from "../sf-symbol";
import { copyKey, PANEL_COPY, tx, type PanelLocale } from "./locale";
import {
  AXIS_VIEW_ID,
  BEZIER_VIEW_ID,
  PANEL_SECTION_ID,
  collectGroupKeys,
  collectPlayerKeys,
  formatAgentDefaultsCopy,
  formatSettingCopyValue,
  mergeSectionOrder,
  readEasings,
  valuesEqual,
  visitPlayerKeys,
  visitSectionKeys,
} from "./model";
import type {
  EasingTarget,
  PlayerSetting,
  SettingsGroup,
  SpringTarget,
} from "./types";

/** Record fields edited in their own window (Bezier, Spring), counted per target. */
const WINDOW_KEYS = new Set(["easings", "springs"]);

export type ChangeModelInput<TSettings> = {
  settings: TSettings;
  defaultSettings?: TSettings;
  groups: readonly SettingsGroup<TSettings>[];
  players: readonly PlayerSetting<TSettings>[];
  easingTargets: readonly EasingTarget[];
  springTargets?: readonly SpringTarget[];
  hasCurveSection: boolean;
  sectionIcons: Record<string, SfSymbolName>;
};

/** What differs from `defaultSettings`: badge count, Reset / Copy, «only changed». */
export function changeModel<TSettings>(input: ChangeModelInput<TSettings>) {
  const {
    settings,
    defaultSettings,
    groups,
    players,
    easingTargets,
    springTargets = [],
    hasCurveSection,
    sectionIcons,
  } = input;
  const groupedKeys = collectGroupKeys(groups);
  const playerKeys = collectPlayerKeys(players);
  const pageKeys: readonly (keyof TSettings)[] =
    defaultSettings != null
      ? (Object.keys(defaultSettings) as (keyof TSettings)[])
      : (Object.keys(settings as object) as (keyof TSettings)[]);
  /** Keys without a row: the Axis plot owns them as one control. */
  const curveKeys = pageKeys.filter(
    (key) =>
      !WINDOW_KEYS.has(String(key)) &&
      !groupedKeys.has(key) &&
      !playerKeys.has(key),
  );
  const settingDiffers = (key: keyof TSettings) =>
    defaultSettings != null &&
    !valuesEqual(settings[key], defaultSettings[key]);
  const liveEasings = readEasings(settings);
  const defaultEasings = readEasings(defaultSettings);
  const changedEasingTargets =
    defaultSettings == null ||
    liveEasings == null ||
    defaultEasings == null ||
    easingTargets.length === 0
      ? []
      : easingTargets.filter(
          (target) =>
            !valuesEqual(liveEasings[target.id], defaultEasings[target.id]),
        );
  const liveSprings = readSprings(settings);
  const defaultSprings = readSprings(defaultSettings);
  const changedSpringTargets =
    defaultSettings == null || liveSprings == null || defaultSprings == null
      ? []
      : springTargets.filter(
          (target) =>
            !valuesEqual(liveSprings[target.id], defaultSprings[target.id]),
        );
  /** Keys that have a panel control. Hidden derived fields (frame W/H) stay out. */
  const listedControlKeys = pageKeys.filter(
    (key) =>
      !WINDOW_KEYS.has(String(key)) &&
      (groupedKeys.has(key) || playerKeys.has(key)),
  );
  const listedChangedKeys =
    defaultSettings == null ? [] : listedControlKeys.filter(settingDiffers);
  const curvePlotChanged = hasCurveSection && curveKeys.some(settingDiffers);
  const listedControlCount =
    listedControlKeys.length + (hasCurveSection ? 1 : 0);
  const changedCount =
    listedChangedKeys.length +
    changedEasingTargets.length +
    changedSpringTargets.length +
    (curvePlotChanged ? 1 : 0) +
    Object.keys(sectionIcons).length;
  return {
    pageKeys,
    curveKeys,
    settingDiffers,
    liveEasings,
    defaultEasings,
    changedEasingTargets,
    liveSprings,
    defaultSprings,
    changedSpringTargets,
    listedChangedKeys,
    curvePlotChanged,
    listedControlCount,
    changedCount,
  };
}

export type ChangeModel<TSettings> = ReturnType<typeof changeModel<TSettings>>;

type CopyBlock = { title: string | null; lines: string[] };

/** Row label per key (eyes: `Section: Показ`), as the panel shows it. */
export function labelsByKey<TSettings>(
  groups: readonly SettingsGroup<TSettings>[],
  players: readonly PlayerSetting<TSettings>[],
  locale: PanelLocale,
) {
  const labels = new Map<keyof TSettings, string>();
  const put = (key: keyof TSettings, label: string) => {
    if (!labels.has(key)) labels.set(key, label);
  };
  for (const group of groups) {
    if (group.visibilityKey) {
      put(
        group.visibilityKey,
        `${tx(group.title, locale)}: ${tx(PANEL_COPY.visibility, locale)}`,
      );
    }
    for (const section of group.sections) {
      if (section.visibilityKey) {
        put(
          section.visibilityKey,
          `${tx(section.title, locale)}: ${tx(PANEL_COPY.visibility, locale)}`,
        );
      }
      visitSectionKeys(section, put, locale);
    }
  }
  for (const player of players) visitPlayerKeys(player, put, locale);
  return labels;
}

/** Agent hand-off: `label (key): old → new`, grouped like the panel. */
export function formatDefaultsHandoff<TSettings>(args: {
  model: ChangeModel<TSettings>;
  settings: TSettings;
  defaults: TSettings;
  groups: readonly SettingsGroup<TSettings>[];
  players: readonly PlayerSetting<TSettings>[];
  subsectionOrder: Record<string, string[]>;
  sectionIcons: Record<string, SfSymbolName>;
  hasCurveSection: boolean;
  curveTitle: string;
  easingTitle: string;
  storageLabel: string;
  locale: PanelLocale;
}): string {
  const {
    model,
    settings,
    defaults,
    groups,
    players,
    subsectionOrder,
    sectionIcons,
    hasCurveSection,
    curveTitle,
    easingTitle,
    storageLabel,
    locale,
  } = args;
  const labels = labelsByKey(groups, players, locale);
  const put = (key: keyof TSettings, label: string) => {
    if (!labels.has(key)) labels.set(key, label);
  };
  if (hasCurveSection) {
    for (const key of model.curveKeys) {
      put(key, `${curveTitle}: ${String(key)}`);
    }
  }
  put("easings" as keyof TSettings, easingTitle);
  const fmt = formatSettingCopyValue;
  const copyKeys: (keyof TSettings)[] = [
    ...model.listedChangedKeys,
    ...(model.curvePlotChanged
      ? model.curveKeys.filter(model.settingDiffers)
      : []),
  ];
  const labelForIconId = (id: string): string => {
    if (id === PANEL_SECTION_ID) return tx(PANEL_COPY.panelSettings, locale);
    if (id === "bezier" || id === AXIS_VIEW_ID) return curveTitle;
    if (id === "curves" || id === BEZIER_VIEW_ID) return easingTitle;
    if (id === "row:presets") return tx(PANEL_COPY.presets, locale);
    if (id.startsWith("sub:")) {
      const rest = id.slice(4);
      const colon = rest.indexOf(":");
      const groupId = rest.slice(0, colon);
      const titleKey = rest.slice(colon + 1);
      const group = groups.find((item) => item.id === groupId);
      const section = group?.sections.find(
        (item) => copyKey(item.title) === titleKey,
      );
      const sectionLabel = section ? tx(section.title, locale) : titleKey;
      return group
        ? `${tx(group.title, locale)} / ${sectionLabel}`
        : sectionLabel;
    }
    if (id.startsWith("row:")) {
      const raw = id.slice(4);
      const first = raw.split("+")[0] as keyof TSettings;
      return labels.get(first) ?? raw;
    }
    const group = groups.find((item) => item.id === id);
    return group ? tx(group.title, locale) : id;
  };
  const valueLine = (key: keyof TSettings, next: unknown, prev?: unknown) => {
    const label = labels.get(key);
    const name = label ? `${label} (${String(key)})` : String(key);
    if (prev === undefined) return `${name}: ${fmt(next)}`;
    return `${name}: ${fmt(prev)} → ${fmt(next)}`;
  };
  const remaining = new Set(copyKeys);
  const emitKeys = (
    keys: readonly (keyof TSettings)[],
    title: string | null,
    subsections: CopyBlock[],
  ) => {
    const lines: string[] = [];
    for (const key of keys) {
      if (!remaining.has(key)) continue;
      remaining.delete(key);
      lines.push(valueLine(key, settings[key], defaults[key]));
    }
    if (lines.length === 0) return;
    const last = subsections[subsections.length - 1];
    if (title == null && last && last.title == null) {
      last.lines.push(...lines);
      return;
    }
    subsections.push({ title, lines });
  };
  const groupBlocks: { title: string; subsections: CopyBlock[] }[] = [];
  for (const group of groups) {
    const subsections: CopyBlock[] = [];
    if (group.visibilityKey) {
      emitKeys([group.visibilityKey], null, subsections);
    }
    for (const orderKey of mergeSectionOrder(
      group.sections.map((section) => copyKey(section.title)),
      subsectionOrder[group.id],
    )) {
      const section = group.sections.find(
        (item) => copyKey(item.title) === orderKey,
      );
      if (!section) continue;
      const keys: (keyof TSettings)[] = [];
      if (section.visibilityKey) keys.push(section.visibilityKey);
      visitSectionKeys(section, (key) => keys.push(key));
      emitKeys(
        keys,
        section.untitled ? null : tx(section.title, locale),
        subsections,
      );
    }
    if (subsections.length > 0) {
      groupBlocks.push({ title: tx(group.title, locale), subsections });
    }
  }
  for (const player of players) {
    const keys: (keyof TSettings)[] = [];
    visitPlayerKeys(player, (key) => keys.push(key), locale);
    const subsections: CopyBlock[] = [];
    emitKeys(keys, null, subsections);
    if (subsections.length > 0) {
      groupBlocks.push({ title: tx(player.label, locale), subsections });
    }
  }
  const trailingLines = copyKeys
    .filter((key) => remaining.has(key))
    .map((key) => valueLine(key, settings[key], defaults[key]));
  for (const target of model.changedEasingTargets) {
    const curve = model.liveEasings?.[target.id];
    if (curve == null) continue;
    const name = `${tx(target.label, locale)} (easings.${target.id})`;
    const oldCurve = model.defaultEasings?.[target.id];
    trailingLines.push(
      oldCurve != null
        ? `${name}: ${formatBezierInput(oldCurve)} → ${formatBezierInput(curve)}`
        : `${name}: ${formatBezierInput(curve)}`,
    );
  }
  for (const target of model.changedSpringTargets) {
    const spring = model.liveSprings?.[target.id];
    if (spring == null) continue;
    const name = `${tx(target.label, locale)} (springs.${target.id})`;
    const oldSpring = model.defaultSprings?.[target.id];
    trailingLines.push(
      oldSpring != null
        ? `${name}: ${formatSpring(oldSpring)} → ${formatSpring(spring)}`
        : `${name}: ${formatSpring(spring)}`,
    );
  }
  const iconLines = Object.entries(sectionIcons).map(([id, name]) =>
    tx(PANEL_COPY.copyIcon(labelForIconId(id), name), locale),
  );
  return formatAgentDefaultsCopy({
    header: tx(
      PANEL_COPY.copyDefaultsAgentHeader(
        storageLabel,
        model.changedCount,
        model.listedControlCount,
      ),
      locale,
    ),
    iconsTitle: tx(PANEL_COPY.copyDefaultsIcons, locale),
    footer: tx(PANEL_COPY.copyDefaultsAgentFooter, locale),
    groups: groupBlocks,
    trailingLines,
    iconLines,
  });
}
