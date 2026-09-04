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
import type { Copy, ResetDotProps, SettingsSection } from "./types";

export type SectionRowKind =
  | "color"
  | "orient"
  | "toggle"
  | "text"
  | "custom"
  | "number"
  | "pair"
  | "range"
  | "enum"
  | "anchor"
  | "xAnchor"
  | "textAlign";

export const ROOT_ROW_KINDS: SectionRowKind[] = [
  "color",
  "orient",
  "toggle",
  "text",
  "custom",
  "number",
  "pair",
  "range",
  "enum",
  "anchor",
  "xAnchor",
  "textAlign",
];

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
      return ["custom"];
    case "number":
      return parent === "toggle" ? ["custom"] : ["xAnchor", "toggle", "custom"];
    case "pair":
      return ["toggle", "custom"];
    case "custom":
      return [];
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
  const rows: Row[] = [];

  for (const item of section.colors ?? []) {
    rows.push({
      kind: "color",
      after: item.after,
      id: `color:${String(item.key)}`,
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
    });
  }
  for (const item of section.orients ?? []) {
    rows.push({
      kind: "orient",
      id: `orient:${String(item.key)}`,
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
    });
  }
  for (const item of section.toggles ?? []) {
    rows.push({
      kind: "toggle",
      after: item.after,
      id: `toggle:${String(item.key)}`,
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
          control={item.control}
          controlWidth={item.controlWidth}
          reduceMotion={reduceMotion}
          onChange={(value) =>
            patch({
              [item.key]: item.invert ? !value : value,
            } as Partial<TSettings>)
          }
          value={
            item.invert ? !Boolean(settings[item.key]) : Boolean(settings[item.key])
          }
          {...dotFor(item.key, infoOf(item.info), item.icon)}
        />
      ),
    });
  }
  for (const item of section.texts ?? []) {
    rows.push({
      kind: "text",
      after: item.after,
      id: `text:${String(item.key)}`,
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
    });
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
    rows.push({
      kind: "number",
      after: item.after,
      id: `number:${String(item.key)}`,
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
          tickStops={item.tickStops?.map((stop) => ({
            value: stop.value,
            label: t(stop.label),
          }))}
          unit={item.unit}
          value={Number(settings[item.key])}
          {...dotFor(item.key, infoOf(item.info), item.icon)}
        />
      ),
    });
  }
  for (const pair of section.pairs ?? []) {
    rows.push({
      kind: "pair",
      id: `pair:${pair.fields.map((field) => String(field.key)).join("-")}`,
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
    });
  }
  for (const item of section.ranges ?? []) {
    rows.push({
      kind: "range",
      after: item.after,
      id: `range:${String(item.fromKey)}-${String(item.toKey)}`,
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
    });
  }
  for (const item of section.enums ?? []) {
    rows.push({
      kind: "enum",
      after: item.after,
      id: `enum:${String(item.key)}`,
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
          }))}
          controlWidth={item.controlWidth}
          reduceMotion={reduceMotion}
          value={String(settings[item.key] ?? "")}
          {...dotFor(item.key, infoOf(item.info), item.icon)}
        />
      ),
    });
  }
  for (const item of section.anchors ?? []) {
    rows.push({
      kind: "anchor",
      after: item.after,
      id: `anchor:${String(item.key)}`,
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
    });
  }
  for (const item of section.xAnchors ?? []) {
    rows.push({
      kind: "xAnchor",
      after: item.after,
      id: `xAnchor:${String(item.key)}`,
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
    });
  }
  for (const item of section.textAligns ?? []) {
    rows.push({
      kind: "textAlign",
      after: item.after,
      id: `textAlign:${String(item.key)}`,
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
    });
  }

  const unused = new Set(rows);
  const out: ReactNode[] = [];
  const emit = (row: Row, parent: SectionRowKind | null) => {
    unused.delete(row);
    out.push(<Fragment key={row.id}>{row.node}</Fragment>);
    for (const kind of followerKinds(row.kind, parent)) {
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
