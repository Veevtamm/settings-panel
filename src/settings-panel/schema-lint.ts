import { L, type Copy, type LocaleText } from "./locale";
import { resolvePlaces, visitSectionKeys } from "./model";
import type { ParamEntry } from "./params";
import type {
  EasingTarget,
  SettingsGroup,
  SettingsLayer,
  SettingsPlace,
  SettingsSection,
} from "./types";

export const LAYER_GROUP_IDS = [
  "timings",
  "layout",
  "type",
  "color",
  "motion",
  "grid",
] as const satisfies readonly SettingsLayer[];

/** Group ids that are not layers. `honeycomb` is the /2 exception. */
export const EXTRA_GROUP_IDS = ["honeycomb"] as const;

/** `defaultOpenSections` may name these even when they are not `groups[].id`. */
export const SERVICE_OPEN_IDS = [
  "panel",
  "bezier",
  "curves",
  "place",
] as const;

export const LAYER_GROUP_TITLES: Record<SettingsLayer, LocaleText> = {
  timings: L("Тайминги", "Timings"),
  layout: L("Раскладка", "Layout"),
  type: L("Шрифт", "Type"),
  color: L("Цвет", "Color"),
  motion: L("Движение", "Motion"),
  grid: L("Сетка", "Grid"),
};

export type SchemaLintIssue = {
  code:
    | "unknown-open-section"
    | "unknown-group-id"
    | "duplicate-group-id"
    | "layer-title"
    | "bare-copy"
    | "unknown-after"
    | "missing-ref"
    | "duplicate-row"
    | "row-without-default"
    | "empty-place"
    | "unknown-place"
    | "row-without-control";
  message: string;
};

export type SchemaLintInput<TSettings> = {
  groups: readonly SettingsGroup<TSettings>[];
  defaultSettings?: TSettings;
  defaultOpenSections?: readonly string[];
  places?: readonly SettingsPlace<TSettings>[];
  easingTargets?: readonly EasingTarget[];
  /** When passed, every non-`value` param must appear as a row (or custom/player/pair/range). */
  params?: Record<string, ParamEntry & { key?: PropertyKey }>;
};

function isLayerId(id: string): id is SettingsLayer {
  return (LAYER_GROUP_IDS as readonly string[]).includes(id);
}

function walkCopy(copy: Copy | undefined, onBare: () => void) {
  if (copy == null) return;
  if (typeof copy === "string") onBare();
}

function collectSectionCopies<TSettings>(
  section: SettingsSection<TSettings>,
  visit: (copy: Copy | undefined) => void,
) {
  visit(section.title);
  for (const row of section.settings ?? []) {
    visit(row.label);
    visit(row.info);
    for (const tick of row.tickStops ?? []) visit(tick.label);
  }
  for (const row of section.toggles ?? []) {
    visit(row.label);
    visit(row.info);
    visit(row.onLabel);
    visit(row.offLabel);
  }
  for (const row of [
    ...(section.colors ?? []),
    ...(section.enums ?? []),
    ...(section.texts ?? []),
    ...(section.anchors ?? []),
    ...(section.xAnchors ?? []),
    ...(section.textAligns ?? []),
    ...(section.orients ?? []),
  ]) {
    visit(row.label);
    visit(row.info);
  }
  for (const row of section.enums ?? []) {
    for (const option of row.options) visit(option.label);
  }
  for (const pair of section.pairs ?? []) {
    visit(pair.label);
    visit(pair.info);
    for (const field of pair.fields) visit(field.ariaLabel);
  }
  for (const row of section.ranges ?? []) {
    visit(row.label);
    visit(row.info);
  }
  for (const row of section.custom ?? []) {
    for (const item of row.keys ?? []) visit(item.label);
  }
  for (const row of section.derived ?? []) {
    visit(row.label);
    visit(row.info);
  }
  const player = section.player;
  if (player) {
    visit(player.label);
    visit(player.info);
    for (const phase of player.phases) visit(phase.caption);
  }
}

function collectAfter<TSettings>(
  section: SettingsSection<TSettings>,
  add: (after: keyof TSettings, via: string) => void,
) {
  const bags = [
    section.settings,
    section.toggles,
    section.colors,
    section.enums,
    section.texts,
    section.anchors,
    section.xAnchors,
    section.textAligns,
    section.orients,
    section.ranges,
    section.custom,
    section.refs,
    section.derived,
  ];
  for (const bag of bags) {
    for (const row of bag ?? []) {
      if ("after" in row && row.after != null) {
        add(row.after, String(row.after));
      }
    }
  }
}

function sourceKeysOf<TSettings>(
  groups: readonly SettingsGroup<TSettings>[],
): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (key: PropertyKey) => {
    const id = String(key);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  };
  for (const group of groups) {
    for (const section of group.sections) {
      visitSectionKeys(section, (key) => bump(key));
      if (section.player && !counts.has(String(section.player.totalKey))) {
        bump(section.player.totalKey);
      }
      if (
        section.visibilityKey &&
        !counts.has(String(section.visibilityKey))
      ) {
        bump(section.visibilityKey);
      }
    }
    if (group.visibilityKey && !counts.has(String(group.visibilityKey))) {
      bump(group.visibilityKey);
    }
  }
  return counts;
}

export function lintSettingsSchema<TSettings>(
  input: SchemaLintInput<TSettings>,
): SchemaLintIssue[] {
  const issues: SchemaLintIssue[] = [];
  const push = (code: SchemaLintIssue["code"], message: string) => {
    issues.push({ code, message });
  };

  const groupIds = new Set<string>();
  for (const group of input.groups) {
    if (groupIds.has(group.id)) {
      push("duplicate-group-id", `duplicate group id "${group.id}"`);
    }
    groupIds.add(group.id);
    if (
      !isLayerId(group.id) &&
      !(EXTRA_GROUP_IDS as readonly string[]).includes(group.id)
    ) {
      push(
        "unknown-group-id",
        `group "${group.id}" is not a layer (timings/layout/type/color/motion/grid) or honeycomb`,
      );
    }
    if (isLayerId(group.id)) {
      const expected = LAYER_GROUP_TITLES[group.id];
      if (typeof group.title === "string") {
        push(
          "bare-copy",
          `group "${group.id}" title is a bare string — use L("${expected.ru}","${expected.en}")`,
        );
      } else if (group.title.ru !== expected.ru || group.title.en !== expected.en) {
        push(
          "layer-title",
          `group "${group.id}" title is "${group.title.ru}"/"${group.title.en}", expected ${expected.ru}/${expected.en}`,
        );
      }
    }
    walkCopy(group.title, () => {
      if (isLayerId(group.id)) return;
      push("bare-copy", `group "${group.id}" title is a bare string — use L()`);
    });
    for (const section of group.sections) {
      collectSectionCopies(section, (copy) => {
        walkCopy(copy, () => {
          push(
            "bare-copy",
            `bare string copy in group "${group.id}" / ${typeof section.title === "string" ? section.title : section.title.ru} — use L()`,
          );
        });
      });
    }
  }

  for (const target of input.easingTargets ?? []) {
    walkCopy(target.label, () => {
      push(
        "bare-copy",
        `easing target "${target.id}" label is a bare string — use L()`,
      );
    });
    for (const id of target.where ?? []) {
      if (input.places && !input.places.some((place) => place.id === id)) {
        push(
          "unknown-place",
          `easing "${target.id}" where names unknown place "${id}"`,
        );
      }
    }
  }
  for (const place of input.places ?? []) {
    walkCopy(place.label, () => {
      push(
        "bare-copy",
        `place "${place.id}" label is a bare string — use L()`,
      );
    });
  }

  const allowedOpen = new Set<string>([
    ...(LAYER_GROUP_IDS as readonly string[]),
    ...(EXTRA_GROUP_IDS as readonly string[]),
    ...(SERVICE_OPEN_IDS as readonly string[]),
    ...groupIds,
  ]);
  for (const id of input.defaultOpenSections ?? []) {
    if (!allowedOpen.has(id)) {
      push(
        "unknown-open-section",
        `defaultOpenSections names "${id}", which is not a layer, honeycomb, or a group on this panel`,
      );
    }
  }

  const rowKeys = sourceKeysOf(input.groups);
  for (const [key, count] of rowKeys) {
    if (count > 1) {
      push(
        "duplicate-row",
        `key "${key}" is declared ${count} times — use refs for a second section`,
      );
    }
  }

  const rowKeySet = new Set(rowKeys.keys());
  for (const group of input.groups) {
    for (const section of group.sections) {
      collectAfter(section, (after) => {
        if (!rowKeySet.has(String(after))) {
          push(
            "unknown-after",
            `after: "${String(after)}" in group "${group.id}" has no row`,
          );
        }
      });
      for (const ref of section.refs ?? []) {
        if (!rowKeySet.has(String(ref.ref))) {
          push(
            "missing-ref",
            `ref: "${String(ref.ref)}" in group "${group.id}" has no source row`,
          );
        }
      }
    }
  }

  if (input.defaultSettings != null && typeof input.defaultSettings === "object") {
    for (const key of rowKeySet) {
      if (key === "easings") continue;
      if (!(key in (input.defaultSettings as object))) {
        push(
          "row-without-default",
          `row "${key}" has no key in defaultSettings`,
        );
      }
    }
  }

  if (input.params) {
    for (const [name, entry] of Object.entries(input.params)) {
      if (entry.kind === "value") continue;
      if (!rowKeySet.has(name)) {
        push(
          "row-without-control",
          `param "${name}" (${entry.kind}) has no row in groups`,
        );
      }
      for (const id of entry.where ?? []) {
        const known = input.places?.some((place) => place.id === id);
        if (input.places && !known) {
          push(
            "unknown-place",
            `param "${name}" where names unknown place "${id}"`,
          );
        }
      }
    }
  }

  if (input.places?.length) {
    const resolved = resolvePlaces(
      input.groups,
      input.places,
      input.easingTargets,
    );
    for (const place of resolved) {
      if ((place.keys?.length ?? 0) === 0 && !place.easingIds?.length) {
        push(
          "empty-place",
          `place "${place.id}" has no keys and no easingIds`,
        );
      }
    }
  }

  const seen = new Set<string>();
  return issues.filter((issue) => {
    const id = `${issue.code}:${issue.message}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

const warned = new Set<string>();

/** Dev console: one warn per panelId+issue. Safe to call every render. */
export function reportSettingsSchemaLint(
  panelId: string,
  issues: readonly SchemaLintIssue[],
) {
  if (typeof console === "undefined") return;
  for (const issue of issues) {
    const id = `${panelId}:${issue.code}:${issue.message}`;
    if (warned.has(id)) continue;
    warned.add(id);
    console.warn(`settings-panel[${panelId}]: ${issue.code}: ${issue.message}`);
  }
}
