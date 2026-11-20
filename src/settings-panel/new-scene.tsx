"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { evalNumberExpression } from "../lib/eval-number-expression";
import {
  usePanelLocale,
  usePanelTheme,
  writePanelLocale,
  writePanelTheme,
  type PanelLocale,
} from "../lib/panel-theme";
import { usePrefersReducedMotion } from "../lib/prefers-reduced-motion";
import {
  encodeSettingsToken,
  settingsLinkUrl,
} from "../lib/settings-transfer";
import { PANEL_VERSION } from "../version";
import { resolvePanelIcon, type PanelIconName } from "../panel-icon";
import {
  AnchorPick,
  ChangedName,
  ColorPicker,
  CommandMark,
  DockAnchorContext,
  DockButton,
  DockedWindows,
  FloatWindow,
  FloatingMenu,
  IconPick,
  KeyCap,
  KitTheme,
  Menu,
  MotionWindow,
  NEW_PANEL_H_MIN,
  NEW_PANEL_W_MAX,
  NEW_PANEL_W_MIN,
  PanelIcon,
  PanelLocale as KitLocale,
  ParametersPanel,
  Pop,
  Row,
  RowHint,
  ScreenDock,
  Section,
  SectionCollapse,
  SectionFoldContext,
  Segment,
  Sortable,
  StepMark,
  Track,
  ValueField,
  formatColor,
  hexToHsva,
  hsvaToRgb,
  panelHeightCap,
  parseColorInput,
  rgbToHex,
  rowLabel,
  trimNum,
  type ColorFormat,
  type DockAnchor,
  type Hsva,
} from "./kit-ui";
import { tx, type Copy } from "./locale";
import { PanelStyleProvider } from "./panel-style";
import type {
  ColorSetting,
  CustomSetting,
  DerivedSetting,
  EnumSetting,
  EasingTarget,
  FrameOrientSetting,
  NumberSetting,
  PairSetting,
  RangeSetting,
  SettingsGroup,
  SettingsSection,
  SpringTarget,
  TextSetting,
  ToggleSetting,
  XAnchorSetting,
  TextAlignSetting,
  AnchorSetting,
} from "./types";
import type { CubicBezier } from "../lib/cubic-bezier";
import type { SpringConfig } from "../lib/spring";

type SceneProps<TSettings> = {
  panelId: string;
  layoutPanelId: string;
  settings: TSettings;
  defaultSettings?: TSettings;
  onSettingsChange: (patch: Partial<TSettings>) => void;
  onReset?: () => void;
  groups: readonly SettingsGroup<TSettings>[];
  easingTargets: readonly EasingTarget[];
  springTargets: readonly SpringTarget[];
  curveSection?: ReactNode;
  curveSectionTitle?: Copy;
  curveSectionIcon?: PanelIconName;
  dockExtra?: ReactNode;
  sceneIcon?: PanelIconName;
};

type RowItem = {
  id: string;
  label: string;
  after?: string;
  keys: string[];
  node: ReactNode;
};

function commitNumber(
  raw: string,
  current: number,
  min: number,
  max: number,
  apply: (value: number) => void,
) {
  const parsed = evalNumberExpression(raw, current);
  if (parsed == null) return;
  apply(Math.min(max, Math.max(min, parsed)));
}

function changedValue(left: unknown, right: unknown) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function Name({
  label,
  changed,
  onReset,
  hint,
}: {
  label: string;
  changed: boolean;
  onReset: () => void;
  hint?: string;
}) {
  const name = <ChangedName changed={changed} label={label} onReset={onReset} />;
  return hint ? <RowHint text={hint}>{name}</RowHint> : name;
}

function Switch({
  on,
  label,
  onClick,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
}) {
  const reduce = usePrefersReducedMotion();
  const motion = reduce
    ? ""
    : "transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]";
  const slide = reduce
    ? ""
    : "transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      className={`relative h-6 w-12 rounded inset-ring inset-ring-white ${on ? "bg-white" : "bg-transparent"} ${motion}`}
    >
      <span
        className={`absolute top-0 left-0 size-6 rounded bg-black inset-ring inset-ring-white ${on ? "translate-x-6" : ""} ${slide}`}
      />
    </button>
  );
}

function Stepper({
  value,
  min,
  max,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (next: number) => void;
}) {
  return (
    <span className="flex h-6 w-24 items-center justify-between rounded text-white inset-ring inset-ring-white">
      <button
        type="button"
        aria-label={label}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex size-6 items-center justify-center rounded bg-white text-black disabled:opacity-30"
      >
        <StepMark kind="minus" />
      </button>
      <span>{value}</span>
      <button
        type="button"
        aria-label={label}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex size-6 items-center justify-center rounded bg-white text-black disabled:opacity-30"
      >
        <StepMark kind="plus" />
      </button>
    </span>
  );
}

function orderRows(items: RowItem[]) {
  const unused = new Set(items);
  const out: RowItem[] = [];
  const take = (parent: string[] | null) => {
    for (const item of items) {
      if (!unused.has(item)) continue;
      const match =
        parent == null ? item.after == null : parent.includes(item.after ?? "");
      if (!match) continue;
      unused.delete(item);
      out.push(item);
      take(item.keys);
    }
  };
  take(null);
  for (const item of items) if (unused.has(item)) out.push(item);
  return out;
}

export function NewScene<TSettings extends Record<string, unknown>>({
  panelId,
  layoutPanelId,
  settings,
  defaultSettings,
  onSettingsChange,
  onReset,
  groups,
  easingTargets,
  springTargets,
  curveSection,
  curveSectionTitle,
  curveSectionIcon = "waypoints",
  dockExtra,
}: SceneProps<TSettings>) {
  const locale = usePanelLocale(layoutPanelId);
  const theme = usePanelTheme(layoutPanelId);
  const reduce = usePrefersReducedMotion();
  const tt = (ru: string, en: string) => (locale === "en" ? en : ru);
  const labelOf = (copy: Copy) => tx(copy, locale);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [motionOpen, setMotionOpen] = useState(false);
  const [motionType, setMotionType] = useState<"easing" | "physics">(
    easingTargets.length > 0 ? "easing" : "physics",
  );
  const [curveId, setCurveId] = useState(easingTargets[0]?.id ?? "");
  const [springId, setSpringId] = useState(springTargets[0]?.id ?? "");
  const [axisOpen, setAxisOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteKey, setPaletteKey] = useState("");
  const [format, setFormat] = useState<ColorFormat>("hex");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrubKey, setScrubKey] = useState<string | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [panelW, setPanelW] = useState(NEW_PANEL_W_MIN);
  const [panelH, setPanelH] = useState<number | null>(null);
  const [placeEpoch, setPlaceEpoch] = useState(0);
  const [dockAnchor, setDockAnchor] = useState<DockAnchor | null>(null);
  const [copied, setCopied] = useState<"file" | "link" | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const colors = useMemo(() => {
    const list: { key: string; opacityKey?: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const group of groups) {
      for (const section of group.sections) {
        for (const color of section.colors ?? []) {
          const key = String(color.key);
          if (seen.has(key)) continue;
          seen.add(key);
          list.push({
            key,
            opacityKey:
              color.opacityKey == null ? undefined : String(color.opacityKey),
            label: labelOf(color.label),
          });
        }
      }
    }
    return list;
  }, [groups, locale]);

  const activeColor = colors.find((color) => color.key === paletteKey) ?? colors[0];
  const activeHsva = (): Hsva => {
    if (!activeColor) return { h: 0, s: 0, v: 0, a: 1 };
    const raw = String(settings[activeColor.key] ?? "#000000");
    const body = raw.replace("#", "");
    const hex = /^[0-9a-fA-F]{6}$/.test(body) ? `#${body}` : "#000000";
    const percent = activeColor.opacityKey
      ? Number(settings[activeColor.opacityKey])
      : 100;
    return (
      hexToHsva(hex, (Number.isFinite(percent) ? percent : 100) / 100) ?? {
        h: 0,
        s: 0,
        v: 0,
        a: 1,
      }
    );
  };

  const paint = (next: Hsva) => {
    if (!activeColor) return;
    const patch = {
      [activeColor.key]: `#${rgbToHex(hsvaToRgb(next))}`,
    } as Partial<TSettings>;
    if (activeColor.opacityKey) {
      (patch as Record<string, number>)[activeColor.opacityKey] = Math.round(
        next.a * 100,
      );
    }
    onSettingsChange(patch);
  };

  const differ = (key: string) =>
    defaultSettings != null &&
    changedValue(settings[key], defaultSettings[key]);

  const changedKeys = defaultSettings
    ? (Object.keys(defaultSettings) as (keyof TSettings)[]).filter((key) =>
        changedValue(settings[key], defaultSettings[key]),
      )
    : [];

  const easings = (settings.easings ?? {}) as Record<string, CubicBezier>;
  const springs = (settings.springs ?? {}) as Record<string, SpringConfig>;
  const curve = easings[curveId] ?? easings[easingTargets[0]?.id ?? ""] ?? {
    x1: 0.22,
    y1: 1,
    x2: 0.36,
    y2: 1,
  };
  const spring =
    springs[springId] ??
    springs[springTargets[0]?.id ?? ""] ?? {
      stiffness: 170,
      damping: 26,
      mass: 1,
    };
  const query = searchQuery.trim().toLowerCase();

  function rowsOf(section: SettingsSection<TSettings>): RowItem[] {
    const items: RowItem[] = [];
    const push = (item: RowItem) => items.push(item);
    const hint = (info?: Copy) => (info ? labelOf(info) : undefined);

    for (const color of section.colors ?? []) {
      push(colorRow(color));
    }
    for (const item of section.orients ?? []) push(orientRow(item));
    for (const item of section.toggles ?? []) push(toggleRow(item));
    for (const item of section.settings ?? []) push(numberRow(item));
    for (const item of section.pairs ?? []) push(pairRow(item));
    for (const item of section.ranges ?? []) push(rangeRow(item));
    for (const item of section.xAnchors ?? []) push(xAnchorRow(item));
    for (const item of section.textAligns ?? []) push(textAlignRow(item));
    for (const item of section.anchors ?? []) push(anchorRow(item));
    for (const item of section.enums ?? []) push(enumRow(item));
    for (const item of section.texts ?? []) push(textRow(item));
    for (const item of section.derived ?? []) push(derivedRow(item));
    for (const item of section.custom ?? []) push(customRow(item));

    return orderRows(
      query
        ? items.filter((item) => item.label.toLowerCase().includes(query))
        : items,
    );

    function colorRow(color: ColorSetting<TSettings>): RowItem {
      const key = String(color.key);
      const hex = String(settings[key] ?? "#000000").replace("#", "");
      const opacityKey = color.opacityKey == null ? undefined : String(color.opacityKey);
      const opacity = opacityKey ? Number(settings[opacityKey]) : undefined;
      const name = labelOf(color.label);
      return {
        id: key,
        label: name,
        after: color.after == null ? undefined : String(color.after),
        keys: opacityKey ? [key, opacityKey] : [key],
        node: (
          <Row key={key}>
            <Name
              label={name}
              changed={differ(key) || (opacityKey ? differ(opacityKey) : false)}
              hint={hint(color.info)}
              onReset={() => {
                if (!defaultSettings) return;
                const patch = { [key]: defaultSettings[key] } as Partial<TSettings>;
                if (opacityKey) {
                  (patch as Record<string, unknown>)[opacityKey] =
                    defaultSettings[opacityKey];
                }
                onSettingsChange(patch);
              }}
            />
            <span className="flex items-center gap-2">
              <ValueField
                value={formatColor(
                  hexToHsva(`#${hex}`, (opacity ?? 100) / 100) ?? {
                    h: 0,
                    s: 0,
                    v: 0,
                    a: 1,
                  },
                  format,
                ).replace("#", "")}
                unit={format.toUpperCase()}
                onCommit={(next) => {
                  const parsed = parseColorInput(next, format, (opacity ?? 100) / 100);
                  if (!parsed) return;
                  const patch = {
                    [key]: `#${rgbToHex(hsvaToRgb(parsed))}`,
                  } as Partial<TSettings>;
                  if (opacityKey) {
                    (patch as Record<string, number>)[opacityKey] = Math.round(
                      parsed.a * 100,
                    );
                  }
                  onSettingsChange(patch);
                }}
              />
              {opacityKey ? (
                <ValueField
                  value={String(opacity ?? 0)}
                  current={opacity ?? 0}
                  min={0}
                  max={100}
                  unit="%"
                  onCommit={(next) =>
                    commitNumber(next, opacity ?? 0, 0, 100, (value) =>
                      onSettingsChange({ [opacityKey]: value } as Partial<TSettings>),
                    )
                  }
                />
              ) : null}
              <button
                type="button"
                aria-label={tt("Палитра", "Palette")}
                aria-pressed={paletteOpen && paletteKey === key}
                onClick={() => {
                  setPaletteKey(key);
                  setPaletteOpen(true);
                }}
                className="size-6 rounded"
                style={{ background: `#${hex}` }}
              />
            </span>
          </Row>
        ),
      };
    }

    function numberRow(item: NumberSetting<TSettings>): RowItem {
      const key = String(item.key);
      const value = Number(settings[key] ?? 0);
      const name = labelOf(item.label);
      const home =
        defaultSettings == null ? undefined : Number(defaultSettings[key]);
      const field = item.stepper ? (
        <Stepper
          value={value}
          min={item.min}
          max={item.max}
          label={name}
          onChange={(next) =>
            onSettingsChange({ [key]: next } as Partial<TSettings>)
          }
        />
      ) : item.readOnly ? (
        <span className="text-[14px] leading-[18px] text-white/50">
          {item.readOnlyLabel ?? trimNum(value)}
          {item.unit ? ` ${item.unit}` : ""}
        </span>
      ) : (
        <ValueField
          value={trimNum(value)}
          current={value}
          min={item.min}
          max={item.max}
          step={item.step}
          unit={item.unit}
          onCommit={(next) =>
            commitNumber(next, value, item.min, item.max, (parsed) =>
              onSettingsChange({ [key]: parsed } as Partial<TSettings>),
            )
          }
        />
      );
      return {
        id: key,
        label: name,
        after: item.after == null ? undefined : String(item.after),
        keys: [key],
        node: (
          <Row key={key} layout={item.scrub && !item.stepper ? "stack" : "row"}>
            {item.scrub && !item.stepper ? (
              <>
                <span className="flex h-6 w-full items-center justify-between">
                  <Name
                    label={name}
                    changed={differ(key)}
                    hint={hint(item.info)}
                    onReset={() =>
                      defaultSettings &&
                      onSettingsChange({
                        [key]: defaultSettings[key],
                      } as Partial<TSettings>)
                    }
                  />
                  <span className="flex items-center gap-1">
                    {field}
                    <ScrubButton
                      open={scrubKey === key}
                      label={tt("Линейка", "Slider")}
                      onClick={() =>
                        setScrubKey((current) => (current === key ? null : key))
                      }
                    />
                  </span>
                </span>
                <SectionCollapse open={scrubKey === key} reduceMotion={reduce}>
                  <div className="pt-1">
                    <Track
                      min={item.min}
                      max={Math.max(item.max, value)}
                      start={value}
                      step={item.step}
                      home={home}
                      handle="square"
                      onChange={(next) =>
                        onSettingsChange({ [key]: next } as Partial<TSettings>)
                      }
                    />
                  </div>
                </SectionCollapse>
              </>
            ) : (
              <>
                <Name
                  label={name}
                  changed={differ(key)}
                  hint={hint(item.info)}
                  onReset={() =>
                    defaultSettings &&
                    onSettingsChange({
                      [key]: defaultSettings[key],
                    } as Partial<TSettings>)
                  }
                />
                {field}
              </>
            )}
          </Row>
        ),
      };
    }

    function toggleRow(item: ToggleSetting<TSettings>): RowItem {
      const key = String(item.key);
      const value = Boolean(settings[key]);
      const name = labelOf(item.label);
      const onLabel = item.onLabel ? labelOf(item.onLabel) : tt("Вкл", "On");
      const offLabel = item.offLabel ? labelOf(item.offLabel) : tt("Выкл", "Off");
      let control: ReactNode;
      if (item.control === "segment") {
        control = (
          <Segment
            value={value ? "on" : "off"}
            onChange={(next) =>
              onSettingsChange({ [key]: next === "on" } as Partial<TSettings>)
            }
            options={[
              {
                id: "off",
                label: offLabel,
                ...(item.offIcon && resolvePanelIcon(item.offIcon)
                  ? { icon: resolvePanelIcon(item.offIcon)! }
                  : {}),
              },
              {
                id: "on",
                label: onLabel,
                ...(item.onIcon && resolvePanelIcon(item.onIcon)
                  ? { icon: resolvePanelIcon(item.onIcon)! }
                  : {}),
              },
            ]}
          />
        );
      } else if (item.control === "action") {
        control = (
          <button
            type="button"
            onClick={() =>
              onSettingsChange({ [key]: !value } as Partial<TSettings>)
            }
            className="h-6 rounded bg-white px-2 text-[14px] leading-none text-black"
          >
            {value ? onLabel : offLabel}
          </button>
        );
      } else {
        control = (
          <Switch
            on={value}
            label={name}
            onClick={() =>
              onSettingsChange({ [key]: !value } as Partial<TSettings>)
            }
          />
        );
      }
      return {
        id: key,
        label: name,
        after: item.after == null ? undefined : String(item.after),
        keys: [key],
        node: (
          <Row key={key}>
            <Name
              label={name}
              changed={differ(key)}
              hint={hint(item.info)}
              onReset={() =>
                defaultSettings &&
                onSettingsChange({
                  [key]: defaultSettings[key],
                } as Partial<TSettings>)
              }
            />
            {control}
          </Row>
        ),
      };
    }

    function orientRow(item: FrameOrientSetting<TSettings>): RowItem {
      const key = String(item.key);
      const name = labelOf(item.label);
      const value = String(settings[key] ?? "square") as "square" | "portrait" | "landscape";
      return {
        id: key,
        label: name,
        after: item.after == null ? undefined : String(item.after),
        keys: [key],
        node: (
          <Row key={key}>
            <Name
              label={name}
              changed={differ(key)}
              hint={hint(item.info)}
              onReset={() =>
                defaultSettings &&
                onSettingsChange({ [key]: defaultSettings[key] } as Partial<TSettings>)
              }
            />
            <IconPick
              value={value}
              onChange={(next) =>
                onSettingsChange({ [key]: next } as Partial<TSettings>)
              }
              options={[
                { id: "square", icon: "square" },
                { id: "portrait", icon: "rectangle-vertical" },
                { id: "landscape", icon: "rectangle-horizontal" },
              ]}
            />
          </Row>
        ),
      };
    }

    function xAnchorRow(item: XAnchorSetting<TSettings>): RowItem {
      const key = String(item.key);
      const name = labelOf(item.label);
      const value = String(settings[key] ?? "center") as "left" | "center" | "right";
      return {
        id: key,
        label: name,
        after: item.after == null ? undefined : String(item.after),
        keys: [key],
        node: (
          <Row key={key}>
            <Name
              label={name}
              changed={differ(key)}
              hint={hint(item.info)}
              onReset={() =>
                defaultSettings &&
                onSettingsChange({ [key]: defaultSettings[key] } as Partial<TSettings>)
              }
            />
            <IconPick
              value={value}
              onChange={(next) =>
                onSettingsChange({ [key]: next } as Partial<TSettings>)
              }
              options={[
                { id: "left", icon: "align-start-vertical" },
                { id: "center", icon: "align-center-vertical" },
                { id: "right", icon: "align-end-vertical" },
              ]}
            />
          </Row>
        ),
      };
    }

    function textAlignRow(item: TextAlignSetting<TSettings>): RowItem {
      const key = String(item.key);
      const name = labelOf(item.label);
      const value = String(settings[key] ?? "left") as
        | "left"
        | "center"
        | "right"
        | "justify";
      return {
        id: key,
        label: name,
        after: item.after == null ? undefined : String(item.after),
        keys: [key],
        node: (
          <Row key={key}>
            <Name
              label={name}
              changed={differ(key)}
              onReset={() =>
                defaultSettings &&
                onSettingsChange({ [key]: defaultSettings[key] } as Partial<TSettings>)
              }
            />
            <IconPick
              value={value}
              onChange={(next) =>
                onSettingsChange({ [key]: next } as Partial<TSettings>)
              }
              options={[
                { id: "left", icon: "align-left" },
                { id: "center", icon: "align-center" },
                { id: "right", icon: "align-right" },
                { id: "justify", icon: "align-justify" },
              ]}
            />
          </Row>
        ),
      };
    }

    function anchorRow(item: AnchorSetting<TSettings>): RowItem {
      const key = String(item.key);
      const name = labelOf(item.label);
      const value = String(settings[key] ?? "center") as
        | "top left"
        | "top"
        | "top right"
        | "left"
        | "center"
        | "right"
        | "bottom left"
        | "bottom"
        | "bottom right";
      return {
        id: key,
        label: name,
        after: item.after == null ? undefined : String(item.after),
        keys: [key],
        node: (
          <Row key={key} layout="stack">
            <span className="flex h-6 w-full items-center">
              <Name
                label={name}
                changed={differ(key)}
                onReset={() =>
                  defaultSettings &&
                  onSettingsChange({ [key]: defaultSettings[key] } as Partial<TSettings>)
                }
              />
            </span>
            <AnchorPick
              value={value}
              onChange={(next) =>
                onSettingsChange({ [key]: next } as Partial<TSettings>)
              }
            />
          </Row>
        ),
      };
    }

    function enumRow(item: EnumSetting<TSettings>): RowItem {
      const key = String(item.key);
      const name = labelOf(item.label);
      const value = String(settings[key] ?? "");
      const options = item.options.map((option) => ({
        id: option.value,
        label: labelOf(option.label),
      }));
      const current = options.find((option) => option.id === value);
      if (item.control === "segment") {
        return {
          id: key,
          label: name,
          after: item.after == null ? undefined : String(item.after),
          keys: [key],
          node: (
            <Row key={key}>
              <Name
                label={name}
                changed={differ(key)}
                hint={hint(item.info)}
                onReset={() =>
                  defaultSettings &&
                  onSettingsChange({ [key]: defaultSettings[key] } as Partial<TSettings>)
                }
              />
              <Segment
                value={value}
                onChange={(next) =>
                  onSettingsChange({ [key]: next } as Partial<TSettings>)
                }
                options={options.map((option) => ({
                  id: option.id,
                  label: option.label,
                }))}
              />
            </Row>
          ),
        };
      }
      return {
        id: key,
        label: name,
        after: item.after == null ? undefined : String(item.after),
        keys: [key],
        node: <EnumMenu key={key} name={name} valueLabel={current?.label ?? value} options={options} changed={differ(key)} hint={hint(item.info)} onReset={() => defaultSettings && onSettingsChange({ [key]: defaultSettings[key] } as Partial<TSettings>)} onChange={(next) => onSettingsChange({ [key]: next } as Partial<TSettings>)} />,
      };
    }

    function pairRow(item: PairSetting<TSettings>): RowItem {
      const name = labelOf(item.label);
      const [a, b] = item.fields;
      return {
        id: `${String(a.key)}-${String(b.key)}`,
        label: name,
        after: item.after == null ? undefined : String(item.after),
        keys: [String(a.key), String(b.key)],
        node: (
          <Row key={`${String(a.key)}-${String(b.key)}`}>
            <Name
              label={name}
              changed={differ(String(a.key)) || differ(String(b.key))}
              hint={hint(item.info)}
              onReset={() =>
                defaultSettings &&
                onSettingsChange({
                  [String(a.key)]: defaultSettings[String(a.key)],
                  [String(b.key)]: defaultSettings[String(b.key)],
                } as Partial<TSettings>)
              }
            />
            <span className="flex items-center gap-3">
              {[a, b].map((field) => {
                const key = String(field.key);
                const value = Number(settings[key] ?? 0);
                return (
                  <ValueField
                    key={key}
                    value={trimNum(value)}
                    current={value}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    unit={field.unit}
                    onCommit={(next) =>
                      commitNumber(next, value, field.min, field.max, (parsed) =>
                        onSettingsChange({ [key]: parsed } as Partial<TSettings>),
                      )
                    }
                  />
                );
              })}
            </span>
          </Row>
        ),
      };
    }

    function rangeRow(item: RangeSetting<TSettings>): RowItem {
      const from = String(item.fromKey);
      const to = String(item.toKey);
      const name = labelOf(item.label);
      const start = Number(settings[from] ?? item.min);
      const end = Number(settings[to] ?? item.max);
      return {
        id: `${from}-${to}`,
        label: name,
        after: item.after == null ? undefined : String(item.after),
        keys: [from, to],
        node: (
          <Row key={`${from}-${to}`} layout="stack">
            <span className="flex h-6 w-full items-center justify-between">
              <Name
                label={name}
                changed={differ(from) || differ(to)}
                hint={hint(item.info)}
                onReset={() =>
                  defaultSettings &&
                  onSettingsChange({
                    [from]: defaultSettings[from],
                    [to]: defaultSettings[to],
                  } as Partial<TSettings>)
                }
              />
              <span className="flex items-center gap-3">
                <ValueField
                  value={trimNum(start)}
                  current={start}
                  min={item.min}
                  max={end}
                  step={item.step}
                  unit={item.unit}
                  onCommit={(next) =>
                    commitNumber(next, start, item.min, end, (parsed) =>
                      onSettingsChange({ [from]: parsed } as Partial<TSettings>),
                    )
                  }
                />
                <ValueField
                  value={trimNum(end)}
                  current={end}
                  min={start}
                  max={item.max}
                  step={item.step}
                  unit={item.unit}
                  onCommit={(next) =>
                    commitNumber(next, end, start, item.max, (parsed) =>
                      onSettingsChange({ [to]: parsed } as Partial<TSettings>),
                    )
                  }
                />
                {item.track === false ? null : (
                  <ScrubButton
                    open={scrubKey === `${from}-${to}`}
                    label={tt("Линейка", "Slider")}
                    onClick={() =>
                      setScrubKey((current) =>
                        current === `${from}-${to}` ? null : `${from}-${to}`,
                      )
                    }
                  />
                )}
              </span>
            </span>
            {item.track === false ? null : (
              <SectionCollapse
                open={scrubKey === `${from}-${to}`}
                reduceMotion={reduce}
              >
                <div className="pt-1">
                  <Track
                    dual
                    min={item.min}
                    max={item.max}
                    start={start}
                    end={end}
                    step={item.step}
                    home={defaultSettings ? Number(defaultSettings[from]) : undefined}
                    homeEnd={defaultSettings ? Number(defaultSettings[to]) : undefined}
                    handle="square"
                    onChange={(nextStart, nextEnd) =>
                      onSettingsChange({
                        [from]: nextStart,
                        [to]: nextEnd,
                      } as Partial<TSettings>)
                    }
                  />
                </div>
              </SectionCollapse>
            )}
          </Row>
        ),
      };
    }

    function textRow(item: TextSetting<TSettings>): RowItem {
      const key = String(item.key);
      const name = labelOf(item.label);
      const value = String(settings[key] ?? "");
      return {
        id: key,
        label: name,
        after: item.after == null ? undefined : String(item.after),
        keys: [key],
        node: (
          <Row key={key}>
            <Name
              label={name}
              changed={differ(key)}
              onReset={() =>
                defaultSettings &&
                onSettingsChange({ [key]: defaultSettings[key] } as Partial<TSettings>)
              }
            />
            <ValueField
              value={value}
              onCommit={(next) =>
                onSettingsChange({ [key]: next } as Partial<TSettings>)
              }
            />
          </Row>
        ),
      };
    }

    function derivedRow(item: DerivedSetting<TSettings>): RowItem {
      const name = labelOf(item.label);
      const value = item.compute(settings);
      const text = item.format ? item.format(value) : String(value);
      return {
        id: item.id,
        label: name,
        after: item.after == null ? undefined : String(item.after),
        keys: [item.id],
        node: (
          <Row key={item.id}>
            <span className={rowLabel}>{name}</span>
            <span className="text-[14px] leading-[18px] text-white/50">
              {text}
              {item.unit ? ` ${item.unit}` : ""}
            </span>
          </Row>
        ),
      };
    }

    function customRow(item: CustomSetting<TSettings>): RowItem {
      const name = item.keys?.[0] ? labelOf(item.keys[0].label) : item.id;
      return {
        id: item.id,
        label: name,
        after: item.after == null ? undefined : String(item.after),
        keys: (item.keys ?? []).map((entry) => String(entry.key)),
        node: (
          <div key={item.id}>
            {item.render({
              settings,
              onSettingsChange,
              locale,
              rowReset: () => ({}),
            })}
          </div>
        ),
      };
    }
  }

  const visibleSections = groups.flatMap((group) =>
    group.sections.map((section) => ({ group, section, rows: rowsOf(section) })),
  ).filter((entry) => entry.rows.length > 0);

  const sectionIds = visibleSections.map(
    (entry) => `${entry.group.id}:${labelOf(entry.section.title)}`,
  );
  const canCollapse = sectionIds.some((id) => !closed.has(id));

  const motionModes = [
    ...(easingTargets.length > 0 ? (["easing"] as const) : []),
    ...(springTargets.length > 0 ? (["physics"] as const) : []),
  ];
  const motionShown = motionModes.includes(motionType)
    ? motionType
    : (motionModes[0] ?? "easing");

  return (
    <PanelStyleProvider style="new">
    <KitLocale.Provider value={locale}>
      <KitTheme theme={theme}>
        <DockAnchorContext.Provider value={dockAnchor}>
          <ScreenDock
            toast={undefined}
            onAnchor={setDockAnchor}
          >
            <DockButton
              name="settings"
              label={tt("Настройки панели", "Panel settings")}
              active={settingsOpen}
              onClick={() => setSettingsOpen((value) => !value)}
            />
            <span className="h-4 w-0.5 rounded-full bg-black/50" />
            <span className="relative z-10">
              <span
                className={`flex h-7 overflow-hidden rounded inset-ring-black ${open ? "inset-ring" : "fine-hover:hover:inset-ring"} ${reduce ? "" : "transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"}`}
                style={{
                  width: open ? 28 + 56 + 28 + (searchOpen ? 164 : 28) : 28,
                }}
              >
                <button
                  type="button"
                  aria-label={tt("Панель", "Panel")}
                  aria-pressed={open}
                  onClick={() => setOpen((value) => !value)}
                  className={`flex size-7 shrink-0 items-center justify-center rounded ${open ? "bg-black text-white" : "text-black"}`}
                >
                  <PanelIcon name="sliders-horizontal" className="size-5" />
                </button>
                {open ? (
                  <>
                    <button
                      type="button"
                      aria-label={tt("Сброс", "Reset")}
                      disabled={changedKeys.length === 0}
                      onClick={() => onReset?.()}
                      className={`flex size-7 shrink-0 items-center justify-center rounded ${changedKeys.length ? "text-black" : "text-black/50"}`}
                    >
                      <PanelIcon name="trash-2" className="size-5" />
                    </button>
                    <button
                      type="button"
                      aria-label={tt("Копировать", "Copy")}
                      disabled={changedKeys.length === 0}
                      onClick={() => {
                        const lines = changedKeys.map(
                          (key) => `${String(key)}: ${JSON.stringify(settings[key])}`,
                        );
                        void navigator.clipboard.writeText(lines.join("\n"));
                        setCopied("file");
                        window.setTimeout(() => setCopied(null), 1400);
                      }}
                      className={`flex size-7 shrink-0 items-center justify-center rounded ${changedKeys.length ? "text-black" : "text-black/50"}`}
                    >
                      <PanelIcon name={copied === "file" ? "check" : "file"} className="size-5" />
                    </button>
                    <button
                      type="button"
                      aria-label={tt("Ссылка", "Link")}
                      onClick={() => {
                        const diff: Record<string, unknown> = {};
                        for (const key of changedKeys) diff[String(key)] = settings[key];
                        const token = encodeSettingsToken(panelId, diff);
                        void navigator.clipboard.writeText(
                          settingsLinkUrl(window.location.href, token),
                        );
                        setCopied("link");
                        window.setTimeout(() => setCopied(null), 1400);
                      }}
                      className="flex size-7 shrink-0 items-center justify-center rounded text-black"
                    >
                      <PanelIcon name={copied === "link" ? "check" : "link"} className="size-5" />
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  aria-label={searchOpen ? tt("Закрыть поиск", "Close search") : tt("Поиск", "Search")}
                  aria-expanded={searchOpen}
                  onClick={() => {
                    if (searchOpen) {
                      setSearchQuery("");
                      setSearchOpen(false);
                      return;
                    }
                    setOpen(true);
                    setSearchOpen(true);
                    window.setTimeout(() => searchRef.current?.focus(), 0);
                  }}
                  className={`flex size-7 shrink-0 items-center justify-center rounded ${searchOpen ? "bg-black text-white" : "text-black"}`}
                >
                  <PanelIcon name="search" className="size-5" />
                </button>
                {searchOpen ? (
                  <input
                    ref={searchRef}
                    type="search"
                    value={searchQuery}
                    placeholder={tt("Поиск", "Search")}
                    aria-label={tt("Поиск", "Search")}
                    autoComplete="off"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Escape") return;
                      event.preventDefault();
                      if (searchQuery) setSearchQuery("");
                      else setSearchOpen(false);
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    className="h-7 min-w-0 flex-1 bg-transparent pr-2 pl-1 text-[14px] leading-[18px] text-black outline-none placeholder:text-black/50 [&::-webkit-search-cancel-button]:hidden"
                  />
                ) : null}
              </span>
            </span>
            {motionModes.length > 0 ? (
              <DockButton
                name="spline"
                label={tt("Движение", "Motion")}
                active={motionOpen}
                onClick={() => setMotionOpen((value) => !value)}
              />
            ) : null}
            {curveSection ? (
              <DockButton
                name={resolvePanelIcon(curveSectionIcon) ?? "waypoints"}
                label={curveSectionTitle ? labelOf(curveSectionTitle) : tt("Ось", "Axis")}
                active={axisOpen}
                onClick={() => setAxisOpen((value) => !value)}
              />
            ) : null}
            {colors.length > 0 ? (
              <DockButton
                name="palette"
                label={tt("Палитра", "Palette")}
                active={paletteOpen}
                onClick={() => setPaletteOpen((value) => !value)}
              />
            ) : null}
            {groups.some((group) => group.visibilityKey != null) ? (
              <DockButton
                name="columns-3"
                label={tt("Сетка", "Grid")}
                active={groups.some(
                  (group) =>
                    group.visibilityKey != null &&
                    Boolean(settings[String(group.visibilityKey)]),
                )}
                onClick={() => {
                  const group = groups.find((item) => item.visibilityKey != null);
                  if (!group?.visibilityKey) return;
                  const key = String(group.visibilityKey);
                  onSettingsChange({
                    [key]: !settings[key],
                  } as Partial<TSettings>);
                }}
              />
            ) : (
              dockExtra
            )}
          </ScreenDock>
          <DockedWindows>
            <FloatWindow
              resetKey={placeEpoch}
              hidden={!open}
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
              <Pop open={open}>
                <ParametersPanel
                  title={tt("Параметры", "Parameters")}
                  canCollapse={canCollapse}
                  onToggleFold={() =>
                    setClosed(canCollapse ? new Set(sectionIds) : new Set())
                  }
                  collapseLabel={tt("Свернуть все", "Collapse all")}
                  expandLabel={tt("Развернуть все", "Expand all")}
                  bodyStyle={{
                    maxHeight: (panelH ?? panelHeightCap(dockAnchor)) - 36,
                  }}
                >
                  <SectionFoldContext.Provider
                    value={{
                      closed,
                      toggle: (id) =>
                        setClosed((current) => {
                          const next = new Set(current);
                          if (next.has(id)) next.delete(id);
                          else next.add(id);
                          return next;
                        }),
                    }}
                  >
                    <Sortable className="flex flex-col gap-2">
                      {visibleSections.map(({ group, section, rows }) => {
                        const id = `${group.id}:${labelOf(section.title)}`;
                        const title = section.untitled
                          ? labelOf(group.title)
                          : labelOf(section.title);
                        return (
                          <Section key={id} foldId={id} title={title} icon={resolvePanelIcon(section.icon ?? group.icon ?? "")}>
                            {rows.map((row) => row.node)}
                          </Section>
                        );
                      })}
                    </Sortable>
                  </SectionFoldContext.Provider>
                </ParametersPanel>
              </Pop>
            </FloatWindow>
            <FloatWindow resetKey={placeEpoch}>
              <Pop open={settingsOpen}>
                <section data-chrome="" className="flex w-64 flex-col gap-2 rounded-2xl bg-white p-2 text-black">
                  <Section title={tt("Внешний вид", "Appearance")} icon="contrast">
                    <Row>
                      <span className={rowLabel}>{tt("Язык", "Language")}</span>
                      <Segment<PanelLocale>
                        value={locale}
                        onChange={(next) => writePanelLocale(layoutPanelId, next)}
                        options={[
                          { id: "ru", label: "Ru" },
                          { id: "en", label: "Eng" },
                        ]}
                      />
                    </Row>
                    <Row>
                      <span className={rowLabel}>{tt("Тема", "Theme")}</span>
                      <IconPick
                        value={theme === "dark" ? "moon" : "sun"}
                        onChange={(next) =>
                          writePanelTheme(
                            layoutPanelId,
                            next === "moon" ? "dark" : "light",
                          )
                        }
                        options={[
                          { id: "sun", icon: "sun" },
                          { id: "moon", icon: "moon" },
                        ]}
                      />
                    </Row>
                    <Row>
                      <span className={rowLabel}>{tt("Положение", "Position")}</span>
                      <button
                        type="button"
                        onClick={() => setPlaceEpoch((value) => value + 1)}
                        className="h-6 rounded bg-white px-2 text-[14px] text-black"
                      >
                        {tt("Сбросить", "Reset")}
                      </button>
                    </Row>
                  </Section>
                  <Section title={tt("Хоткеи", "Hotkeys")} icon="keyboard">
                    <Row>
                      <span className={rowLabel}>{tt("Скрыть бар", "Hide bar")}</span>
                      <span className="flex items-center gap-1">
                        <KeyCap>
                          <CommandMark />
                        </KeyCap>
                        <KeyCap>\</KeyCap>
                      </span>
                    </Row>
                    <Row>
                      <span className={rowLabel}>{tt("Отменить", "Undo")}</span>
                      <span className="flex items-center gap-1">
                        <KeyCap>
                          <CommandMark />
                        </KeyCap>
                        <KeyCap>Z</KeyCap>
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
            {motionModes.length > 0 ? (
              <FloatWindow resetKey={placeEpoch}>
                <Pop open={motionOpen}>
                  <MotionWindow
                    type={motionShown}
                    onType={setMotionType}
                    modes={motionModes}
                    curve={[curve.x1, curve.y1, curve.x2, curve.y2]}
                    onCurve={(next) => {
                      const id = curveId || easingTargets[0]?.id;
                      if (!id) return;
                      onSettingsChange({
                        easings: {
                          ...easings,
                          [id]: { x1: next[0], y1: next[1], x2: next[2], y2: next[3] },
                        },
                      } as unknown as Partial<TSettings>);
                    }}
                    spring={spring}
                    onSpring={(next) => {
                      const id = springId || springTargets[0]?.id;
                      if (!id) return;
                      onSettingsChange({
                        springs: { ...springs, [id]: next },
                      } as unknown as Partial<TSettings>);
                    }}
                    target={
                      motionShown === "physics"
                        ? labelOf(
                            springTargets.find((item) => item.id === springId)?.label ??
                              springTargets[0]?.label ?? { ru: "", en: "" },
                          )
                        : labelOf(
                            easingTargets.find((item) => item.id === curveId)?.label ??
                              easingTargets[0]?.label ?? { ru: "", en: "" },
                          )
                    }
                    targets={
                      motionShown === "physics"
                        ? springTargets.map((item) => labelOf(item.label))
                        : easingTargets.map((item) => labelOf(item.label))
                    }
                    onTarget={(label) => {
                      const list = motionShown === "physics" ? springTargets : easingTargets;
                      const hit = list.find((item) => labelOf(item.label) === label);
                      if (!hit) return;
                      if (motionShown === "physics") setSpringId(hit.id);
                      else setCurveId(hit.id);
                    }}
                  />
                </Pop>
              </FloatWindow>
            ) : null}
            {curveSection ? (
              <FloatWindow resetKey={placeEpoch}>
                <Pop open={axisOpen}>{curveSection}</Pop>
              </FloatWindow>
            ) : null}
            {activeColor ? (
              <FloatWindow resetKey={placeEpoch}>
                <Pop open={paletteOpen}>
                  <section data-chrome="" className="flex w-64 flex-col gap-1.5 rounded-2xl bg-white p-2 text-black">
                    <header className="flex h-4 items-center gap-1 px-1">
                      <PanelIcon name="palette" className="size-5" />
                      <span className="text-[14px] leading-4">{tt("Палитра", "Palette")}</span>
                    </header>
                    <ColorPicker
                      color={activeHsva()}
                      onChange={paint}
                      format={format}
                      onFormat={setFormat}
                      target={activeColor.label}
                      targets={colors.map((color) => color.label)}
                      onTarget={(label) => {
                        const hit = colors.find((color) => color.label === label);
                        if (hit) setPaletteKey(hit.key);
                      }}
                    />
                  </section>
                </Pop>
              </FloatWindow>
            ) : null}
          </DockedWindows>
        </DockAnchorContext.Provider>
      </KitTheme>
    </KitLocale.Provider>
    </PanelStyleProvider>
  );
}

function ScrubButton({
  open,
  label,
  onClick,
}: {
  open: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={open}
      aria-label={label}
      onClick={onClick}
      className={`flex size-6 items-center justify-center rounded transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] ${open ? "bg-white text-black" : "text-white fine-hover:hover:inset-ring fine-hover:hover:inset-ring-white"}`}
    >
      <PanelIcon name="settings-2" className="size-5" />
    </button>
  );
}

function EnumMenu({
  name,
  valueLabel,
  options,
  changed,
  hint,
  onReset,
  onChange,
}: {
  name: string;
  valueLabel: string;
  options: { id: string; label: string }[];
  changed: boolean;
  hint?: string;
  onReset: () => void;
  onChange: (id: string) => void;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  return (
    <div ref={anchor} onClick={() => setMenu((value) => !value)} className="cursor-pointer">
      <Row>
        <Name label={name} changed={changed} hint={hint} onReset={onReset} />
        <span className="flex items-center gap-1">
          {valueLabel}
          <PanelIcon name="chevrons-up-down" className="size-5" />
        </span>
      </Row>
      <FloatingMenu open={menu} anchor={anchor} onClose={() => setMenu(false)}>
        <Menu
          options={options.map((option) => option.label)}
          value={valueLabel}
          onChange={(next) => {
            const hit = options.find((option) => option.label === next);
            if (hit) onChange(hit.id);
            setMenu(false);
          }}
        />
      </FloatingMenu>
    </div>
  );
}
