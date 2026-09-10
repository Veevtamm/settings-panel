"use client";

import { Fragment, type ReactNode } from "react";
import type { SfSymbolName } from "../sf-symbol";
import { SettingColor } from "./color";
import { SettingEnumDropdown, SettingText, SettingToggle } from "./fields";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";
import { SettingNumber, SettingPair, SettingRange } from "./number";
import {
  SettingAnchor,
  SettingFrameOrient,
  SettingTextAlign,
  SettingXAnchor,
} from "./pick";
import type {
  AnchorSetting,
  ColorSetting,
  Copy,
  EnumSetting,
  FrameOrientSetting,
  NumberSetting,
  PairSetting,
  RangeSetting,
  ResetDotProps,
  SettingsGroup,
  SettingsSection,
  TextAlignSetting,
  TextSetting,
  ToggleSetting,
  XAnchorSetting,
} from "./types";

export type SectionRowKind =
  | "color"
  | "orient"
  | "toggle"
  | "text"
  | "custom"
  | "number"
  | "derived"
  | "pair"
  | "range"
  | "enum"
  | "anchor"
  | "xAnchor"
  | "textAlign"
  | "ref";

export const ROOT_ROW_KINDS: SectionRowKind[] = [
  "color",
  "orient",
  "toggle",
  "text",
  "custom",
  "number",
  "derived",
  "pair",
  "range",
  "enum",
  "anchor",
  "xAnchor",
  "textAlign",
  "ref",
];

export type IndexedRow<TSettings> =
  | { kind: "number"; item: NumberSetting<TSettings> }
  | { kind: "toggle"; item: ToggleSetting<TSettings> }
  | { kind: "color"; item: ColorSetting<TSettings> }
  | { kind: "enum"; item: EnumSetting<TSettings> }
  | { kind: "text"; item: TextSetting<TSettings> }
  | { kind: "anchor"; item: AnchorSetting<TSettings> }
  | { kind: "xAnchor"; item: XAnchorSetting<TSettings> }
  | { kind: "textAlign"; item: TextAlignSetting<TSettings> }
  | { kind: "orient"; item: FrameOrientSetting<TSettings> }
  | { kind: "pair"; item: PairSetting<TSettings> }
  | { kind: "range"; item: RangeSetting<TSettings> };

export function indexRowsByKey<TSettings>(
  groups: readonly SettingsGroup<TSettings>[],
): Map<keyof TSettings, IndexedRow<TSettings>> {
  const map = new Map<keyof TSettings, IndexedRow<TSettings>>();
  const put = (key: keyof TSettings, row: IndexedRow<TSettings>) => {
    if (!map.has(key)) map.set(key, row);
  };
  for (const group of groups) {
    for (const section of group.sections) {
      for (const item of section.settings ?? []) {
        put(item.key, { kind: "number", item });
      }
      for (const item of section.toggles ?? []) {
        put(item.key, { kind: "toggle", item });
      }
      for (const item of section.colors ?? []) {
        put(item.key, { kind: "color", item });
      }
      for (const item of section.enums ?? []) {
        put(item.key, { kind: "enum", item });
      }
      for (const item of section.texts ?? []) {
        put(item.key, { kind: "text", item });
      }
      for (const item of section.anchors ?? []) {
        put(item.key, { kind: "anchor", item });
      }
      for (const item of section.xAnchors ?? []) {
        put(item.key, { kind: "xAnchor", item });
      }
      for (const item of section.textAligns ?? []) {
        put(item.key, { kind: "textAlign", item });
      }
      for (const item of section.orients ?? []) {
        put(item.key, { kind: "orient", item });
      }
      for (const item of section.pairs ?? []) {
        const row: IndexedRow<TSettings> = { kind: "pair", item };
        put(item.fields[0].key, row);
        put(item.fields[1].key, row);
      }
      for (const item of section.ranges ?? []) {
        const row: IndexedRow<TSettings> = { kind: "range", item };
        put(item.fromKey, row);
        put(item.toKey, row);
      }
    }
  }
  return map;
}

export function followerKinds(
  kind: SectionRowKind,
  parent: SectionRowKind | null,
): SectionRowKind[] {
  switch (kind) {
    case "color":
      return ["textAlign", "custom"];
    case "orient":
      return ["enum", "xAnchor", "custom"];
    case "enum":
      return parent === "orient"
        ? ["xAnchor", "textAlign", "custom"]
        : ["custom"];
    case "toggle":
      if (parent === "number") return ["range", "custom"];
      if (parent === "pair") return ["number", "custom"];
      return ["enum", "text", "number", "range", "anchor", "xAnchor", "custom"];
    case "text":
    case "range":
    case "anchor":
    case "xAnchor":
    case "textAlign":
    case "derived":
    case "ref":
      return ["custom"];
    case "number":
      return parent === "toggle"
        ? ["derived", "custom"]
        : ["xAnchor", "toggle", "derived", "custom"];
    case "pair":
      return ["toggle", "custom"];
    case "custom":
      return [];
  }
}

function formatDerivedValue(
  value: number | string,
  format?: (value: number | string) => string,
) {
  if (format) return format(value);
  if (typeof value === "string") return value;
  if (!Number.isFinite(value)) return String(value);
  return String(Number(value.toFixed(2)));
}

const missingRefWarned = new Set<string>();

function warnMissingRef(key: string) {
  if (missingRefWarned.has(key)) return;
  missingRefWarned.add(key);
  if (typeof console !== "undefined") {
    console.warn(`settings-panel: ref "${key}" has no source row`);
  }
}

export function SectionRows<TSettings>({
  section,
  settings,
  onSettingsChange,
  reduceMotion,
  numberDefault,
  dotFor,
  dotForKeys,
  locale,
  rowIndex,
}: {
  section: SettingsSection<TSettings>;
  settings: TSettings;
  onSettingsChange: (next: Partial<TSettings>) => void;
  reduceMotion: boolean;
  locale: PanelLocale;
  numberDefault: (key: keyof TSettings) => number | undefined;
  dotFor: (
    key: keyof TSettings,
    info?: string,
    icon?: SfSymbolName,
  ) => ResetDotProps;
  dotForKeys: (
    keys: readonly (keyof TSettings)[],
    info?: string,
    icon?: SfSymbolName,
  ) => ResetDotProps;
  rowIndex: Map<keyof TSettings, IndexedRow<TSettings>>;
}) {
  type Row = {
    after?: keyof TSettings;
    id: string;
    keys: readonly (keyof TSettings)[];
    kind: SectionRowKind;
    node: ReactNode;
  };

  const t = (copy: Copy | undefined) => tx(copy, locale);
  const infoOf = (info?: Copy) => (info == null ? undefined : t(info));
  const patch = (next: Partial<TSettings>) => onSettingsChange(next);

  const fromIndexed = (
    source: IndexedRow<TSettings>,
    id: string,
    after?: keyof TSettings,
  ): Row => {
    switch (source.kind) {
      case "color": {
        const item = source.item;
        return {
          kind: "color",
          after,
          id,
          keys: item.opacityKey ? [item.key, item.opacityKey] : [item.key],
          node: (
            <SettingColor
              label={t(item.label)}
              locale={locale}
              onChange={(value) =>
                patch({ [item.key]: value } as Partial<TSettings>)
              }
              value={String(settings[item.key] ?? "#000000")}
              opacity={
                item.opacityKey != null
                  ? Number(settings[item.opacityKey])
                  : undefined
              }
              onOpacityChange={
                item.opacityKey != null
                  ? (value) =>
                      patch({ [item.opacityKey!]: value } as Partial<TSettings>)
                  : undefined
              }
              {...(item.opacityKey != null
                ? dotForKeys(
                    [item.key, item.opacityKey],
                    infoOf(item.info),
                    item.icon,
                  )
                : dotFor(item.key, infoOf(item.info), item.icon))}
            />
          ),
        };
      }
      case "orient": {
        const item = source.item;
        return {
          kind: "orient",
          after,
          id,
          keys: [item.key],
          node: (
            <SettingFrameOrient
              label={t(item.label)}
              locale={locale}
              onChange={(value) =>
                patch({ [item.key]: value } as Partial<TSettings>)
              }
              value={String(settings[item.key] ?? "square")}
              {...dotFor(item.key, infoOf(item.info), item.icon)}
            />
          ),
        };
      }
      case "toggle": {
        const item = source.item;
        return {
          kind: "toggle",
          after,
          id,
          keys: [item.key],
          node: (
            <SettingToggle
              label={t(item.label)}
              onLabel={
                item.onLabel != null
                  ? t(item.onLabel)
                  : tx(PANEL_COPY.on, locale)
              }
              offLabel={
                item.offLabel != null
                  ? t(item.offLabel)
                  : tx(PANEL_COPY.off, locale)
              }
              onIcon={item.onIcon}
              offIcon={item.offIcon}
              control={item.control}
              controlWidth={item.controlWidth}
              reduceMotion={reduceMotion}
              onChange={(value) =>
                patch({
                  [item.key]: item.invert ? !value : value,
                } as Partial<TSettings>)
              }
              value={
                item.invert
                  ? !Boolean(settings[item.key])
                  : Boolean(settings[item.key])
              }
              {...dotFor(item.key, infoOf(item.info), item.icon)}
            />
          ),
        };
      }
      case "text": {
        const item = source.item;
        return {
          kind: "text",
          after,
          id,
          keys: [item.key],
          node: (
            <SettingText
              label={t(item.label)}
              onChange={(value) =>
                patch({ [item.key]: value } as Partial<TSettings>)
              }
              value={String(settings[item.key] ?? "")}
              {...dotFor(item.key, infoOf(item.info), item.icon)}
            />
          ),
        };
      }
      case "number": {
        const item = source.item;
        return {
          kind: "number",
          after,
          id,
          keys: [item.key],
          node: (
            <SettingNumber
              defaultValue={numberDefault(item.key)}
              label={t(item.label)}
              max={item.max}
              min={item.min}
              onChange={(value) =>
                patch({ [item.key]: value } as Partial<TSettings>)
              }
              reduceMotion={reduceMotion}
              scrub={item.scrub}
              stepper={item.stepper}
              step={item.step}
              tickSnap={item.tickSnap}
              tickStops={item.tickStops?.map((stop) => ({
                value: stop.value,
                label: t(stop.label),
              }))}
              trailing={item.trailing}
              readOnly={item.readOnly}
              readOnlyLabel={item.readOnlyLabel}
              unit={item.unit}
              value={Number(settings[item.key])}
              {...dotFor(item.key, infoOf(item.info), item.icon)}
            />
          ),
        };
      }
      case "pair": {
        const pair = source.item;
        return {
          kind: "pair",
          after,
          id,
          keys: [pair.fields[0].key, pair.fields[1].key],
          node: (
            <SettingPair
              pair={{
                ...pair,
                label: t(pair.label),
                info: infoOf(pair.info),
                fields: [
                  { ...pair.fields[0], ariaLabel: t(pair.fields[0].ariaLabel) },
                  { ...pair.fields[1], ariaLabel: t(pair.fields[1].ariaLabel) },
                ],
              }}
              values={[
                Number(settings[pair.fields[0].key]),
                Number(settings[pair.fields[1].key]),
              ]}
              onCommit={(key, value) =>
                patch({ [key]: value } as Partial<TSettings>)
              }
              {...dotForKeys(
                [pair.fields[0].key, pair.fields[1].key],
                infoOf(pair.info),
                pair.icon,
              )}
            />
          ),
        };
      }
      case "range": {
        const item = source.item;
        return {
          kind: "range",
          after,
          id,
          keys: [item.fromKey, item.toKey],
          node: (
            <SettingRange
              from={Number(settings[item.fromKey])}
              label={t(item.label)}
              max={item.max}
              min={item.min}
              onChange={({ from, to }) =>
                patch({
                  [item.fromKey]: from,
                  [item.toKey]: to,
                } as Partial<TSettings>)
              }
              step={item.step}
              to={Number(settings[item.toKey])}
              track={item.track}
              unit={item.unit}
              {...dotForKeys(
                [item.fromKey, item.toKey],
                infoOf(item.info),
                item.icon,
              )}
            />
          ),
        };
      }
      case "enum": {
        const item = source.item;
        return {
          kind: "enum",
          after,
          id,
          keys: [item.key],
          node: (
            <SettingEnumDropdown
              label={t(item.label)}
              onChange={(value) =>
                patch({ [item.key]: value } as Partial<TSettings>)
              }
              options={item.options.map((option) => ({
                value: option.value,
                label: t(option.label),
                mark: option.mark,
              }))}
              control={item.control}
              controlWidth={item.controlWidth}
              reduceMotion={reduceMotion}
              value={String(settings[item.key] ?? "")}
              {...dotFor(item.key, infoOf(item.info), item.icon)}
            />
          ),
        };
      }
      case "anchor": {
        const item = source.item;
        return {
          kind: "anchor",
          after,
          id,
          keys: [item.key],
          node: (
            <SettingAnchor
              label={t(item.label)}
              locale={locale}
              onChange={(value) =>
                patch({ [item.key]: value } as Partial<TSettings>)
              }
              value={String(settings[item.key] ?? "center")}
              {...dotFor(item.key, infoOf(item.info), item.icon)}
            />
          ),
        };
      }
      case "xAnchor": {
        const item = source.item;
        return {
          kind: "xAnchor",
          after,
          id,
          keys: [item.key],
          node: (
            <SettingXAnchor
              label={t(item.label)}
              locale={locale}
              onChange={(value) =>
                patch({ [item.key]: value } as Partial<TSettings>)
              }
              value={String(settings[item.key] ?? "center")}
              {...dotFor(item.key, infoOf(item.info), item.icon)}
            />
          ),
        };
      }
      case "textAlign": {
        const item = source.item;
        return {
          kind: "textAlign",
          after,
          id,
          keys: [item.key],
          node: (
            <SettingTextAlign
              label={t(item.label)}
              locale={locale}
              onChange={(value) =>
                patch({ [item.key]: value } as Partial<TSettings>)
              }
              value={String(settings[item.key] ?? "left")}
              {...dotFor(item.key, infoOf(item.info), item.icon)}
            />
          ),
        };
      }
    }
  };

  const rows: Row[] = [];

  for (const item of section.colors ?? []) {
    rows.push(
      fromIndexed(
        { kind: "color", item },
        `color:${String(item.key)}`,
        item.after,
      ),
    );
  }
  for (const item of section.orients ?? []) {
    rows.push(fromIndexed({ kind: "orient", item }, `orient:${String(item.key)}`));
  }
  for (const item of section.toggles ?? []) {
    rows.push(
      fromIndexed(
        { kind: "toggle", item },
        `toggle:${String(item.key)}`,
        item.after,
      ),
    );
  }
  for (const item of section.texts ?? []) {
    rows.push(
      fromIndexed({ kind: "text", item }, `text:${String(item.key)}`, item.after),
    );
  }
  for (const item of section.custom ?? []) {
    rows.push({
      kind: "custom",
      after: item.after,
      id: `custom:${item.id}`,
      keys: (item.keys ?? []).map((entry) => entry.key),
      node: item.render({
        settings,
        onSettingsChange,
        locale,
        rowReset: (key, info) =>
          dotFor(key, info == null ? undefined : t(info)),
      }),
    });
  }
  for (const item of section.settings ?? []) {
    rows.push(
      fromIndexed(
        { kind: "number", item },
        `number:${String(item.key)}`,
        item.after,
      ),
    );
  }
  for (const item of section.derived ?? []) {
    const raw = item.compute(settings);
    const label = formatDerivedValue(raw, item.format);
    rows.push({
      kind: "derived",
      after: item.after,
      id: `derived:${item.id}`,
      keys: [],
      node: (
        <SettingNumber
          label={t(item.label)}
          max={0}
          min={0}
          onChange={() => {}}
          reduceMotion={reduceMotion}
          readOnly
          readOnlyLabel={label}
          unit={item.unit}
          value={typeof raw === "number" ? raw : 0}
          info={infoOf(item.info)}
          icon={item.icon}
          locale={locale}
        />
      ),
    });
  }
  for (const pair of section.pairs ?? []) {
    rows.push(
      fromIndexed(
        { kind: "pair", item: pair },
        `pair:${pair.fields.map((field) => String(field.key)).join("-")}`,
      ),
    );
  }
  for (const item of section.ranges ?? []) {
    rows.push(
      fromIndexed(
        { kind: "range", item },
        `range:${String(item.fromKey)}-${String(item.toKey)}`,
        item.after,
      ),
    );
  }
  for (const item of section.enums ?? []) {
    rows.push(
      fromIndexed({ kind: "enum", item }, `enum:${String(item.key)}`, item.after),
    );
  }
  for (const item of section.anchors ?? []) {
    rows.push(
      fromIndexed(
        { kind: "anchor", item },
        `anchor:${String(item.key)}`,
        item.after,
      ),
    );
  }
  for (const item of section.xAnchors ?? []) {
    rows.push(
      fromIndexed(
        { kind: "xAnchor", item },
        `xAnchor:${String(item.key)}`,
        item.after,
      ),
    );
  }
  for (const item of section.textAligns ?? []) {
    rows.push(
      fromIndexed(
        { kind: "textAlign", item },
        `textAlign:${String(item.key)}`,
        item.after,
      ),
    );
  }
  for (const item of section.refs ?? []) {
    const source = rowIndex.get(item.ref);
    if (source == null) {
      warnMissingRef(String(item.ref));
      continue;
    }
    const resolved = fromIndexed(
      source,
      `ref:${String(item.ref)}`,
      item.after,
    );
    rows.push({ ...resolved, kind: "ref", id: `ref:${String(item.ref)}` });
  }

  const unused = new Set(rows);
  const out: ReactNode[] = [];
  const emit = (row: Row, parent: SectionRowKind | null) => {
    unused.delete(row);
    out.push(<Fragment key={row.id}>{row.node}</Fragment>);
    const preferred = followerKinds(row.kind, parent);
    const kinds = [
      ...preferred,
      ...ROOT_ROW_KINDS.filter((kind) => !preferred.includes(kind)),
    ];
    for (const kind of kinds) {
      for (const child of rows) {
        if (!unused.has(child) || child.kind !== kind || child.after == null) {
          continue;
        }
        if (!row.keys.includes(child.after)) continue;
        emit(child, row.kind);
      }
    }
  };
  for (const kind of ROOT_ROW_KINDS) {
    for (const row of rows) {
      if (!unused.has(row) || row.kind !== kind || row.after != null) continue;
      emit(row, null);
    }
  }
  return out;
}
