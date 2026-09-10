import type { Copy } from "./locale";
import type {
  AnchorSetting,
  ColorSetting,
  EnumSetting,
  FrameOrientSetting,
  NumberSetting,
  SettingAnchor,
  SettingFrameOrient,
  SettingTextAlign,
  SettingXAnchor,
  SettingsLayer,
  SettingsPlace,
  TextAlignSetting,
  TextSetting,
  ToggleSetting,
  XAnchorSetting,
} from "./types";

export type { SettingsLayer };

type Bag = Record<string, unknown>;
type Tagged<K extends string, Row, V> = Omit<Row, "key"> & {
  kind: K;
  default: V;
};

export type NumberParam = Tagged<"number", NumberSetting<Bag>, number>;
export type ToggleParam = Tagged<"toggle", ToggleSetting<Bag>, boolean>;
export type ColorParam = Tagged<"color", ColorSetting<Bag>, string>;
export type EnumParam = Tagged<"enum", EnumSetting<Bag>, string>;
export type TextParam = Tagged<"text", TextSetting<Bag>, string>;
export type AnchorParam = Tagged<"anchor", AnchorSetting<Bag>, SettingAnchor>;
export type XAnchorParam = Tagged<"xAnchor", XAnchorSetting<Bag>, SettingXAnchor>;
export type TextAlignParam = Tagged<
  "textAlign",
  TextAlignSetting<Bag>,
  SettingTextAlign
>;
export type OrientParam = Tagged<
  "orient",
  FrameOrientSetting<Bag>,
  SettingFrameOrient
>;
export type ValueParam<V> = {
  kind: "value";
  default: V;
  label?: Copy;
  where?: readonly string[];
  layer?: SettingsLayer;
};

export type ParamEntry =
  | NumberParam
  | ToggleParam
  | ColorParam
  | EnumParam
  | TextParam
  | AnchorParam
  | XAnchorParam
  | TextAlignParam
  | OrientParam
  | ValueParam<unknown>;

export type SettingsOf<D extends Record<PropertyKey, { default: unknown }>> = {
  [K in keyof D]: D[K]["default"];
};

/** Constructor bag ∩ real row, so `P.x` is assignable to `NumberSetting<SettingsOf<D>>`. */
type AsRow<D extends Record<string, ParamEntry>, K extends keyof D> = D[K] & {
  key: K;
} & (D[K] extends { kind: "number" }
    ? NumberSetting<SettingsOf<D>>
    : D[K] extends { kind: "toggle" }
      ? ToggleSetting<SettingsOf<D>>
      : D[K] extends { kind: "color" }
        ? ColorSetting<SettingsOf<D>>
        : D[K] extends { kind: "enum" }
          ? EnumSetting<SettingsOf<D>>
          : D[K] extends { kind: "text" }
            ? TextSetting<SettingsOf<D>>
            : D[K] extends { kind: "anchor" }
              ? AnchorSetting<SettingsOf<D>>
              : D[K] extends { kind: "xAnchor" }
                ? XAnchorSetting<SettingsOf<D>>
                : D[K] extends { kind: "textAlign" }
                  ? TextAlignSetting<SettingsOf<D>>
                  : D[K] extends { kind: "orient" }
                    ? FrameOrientSetting<SettingsOf<D>>
                    : {});

export type Params<D extends Record<string, ParamEntry>> = {
  [K in keyof D]: AsRow<D, K>;
};
export type ParamsOf<D extends Record<string, ParamEntry>> = Params<D>;

function tagged<K extends string, T>(kind: K, def: T): T & { kind: K } {
  return { ...def, kind };
}

export const number = (def: Omit<NumberParam, "kind">) => tagged("number", def);
export const toggle = (def: Omit<ToggleParam, "kind">) => tagged("toggle", def);
export const color = (def: Omit<ColorParam, "kind">) => tagged("color", def);
export const choice = (def: Omit<EnumParam, "kind">) => tagged("enum", def);
export const text = (def: Omit<TextParam, "kind">) => tagged("text", def);
export const anchor = (def: Omit<AnchorParam, "kind">) => tagged("anchor", def);
export const xAnchor = (def: Omit<XAnchorParam, "kind">) => tagged("xAnchor", def);
export const textAlign = (def: Omit<TextAlignParam, "kind">) =>
  tagged("textAlign", def);
export const orient = (def: Omit<OrientParam, "kind">) => tagged("orient", def);
export function value<V>(def: Omit<ValueParam<V>, "kind">): ValueParam<V> {
  return tagged("value", def);
}

export const param = {
  number,
  toggle,
  color,
  choice,
  text,
  anchor,
  xAnchor,
  textAlign,
  orient,
  value,
};

export function defineParams<const D extends Record<string, ParamEntry>>(
  defs: D,
): Params<D> {
  const out = {} as Params<D>;
  for (const name of Object.keys(defs) as (keyof D)[]) {
    (out as Record<PropertyKey, unknown>)[name] = { ...defs[name], key: name };
  }
  return out;
}

export function defaultsOf<D extends Record<string, ParamEntry>>(
  params: Params<D>,
): SettingsOf<D> {
  const out = {} as SettingsOf<D>;
  for (const name of Object.keys(params) as (keyof D)[]) {
    (out as Record<PropertyKey, unknown>)[name] = params[name].default;
  }
  return out;
}

export type PlaceDef = Omit<SettingsPlace<Bag>, "keys"> & {
  keys?: readonly string[];
};

function warn(message: string) {
  if (typeof console !== "undefined") console.warn(message);
}

/**
 * Schema-time convenience: fills `keys` from `param.*.where` plus explicit extras.
 * The panel resolves `where` itself via `resolvePlaces` — `placesOf` is optional.
 */
export function placesOf<D extends Record<string, ParamEntry>>(
  params: Params<D>,
  places: readonly PlaceDef[],
): SettingsPlace<SettingsOf<D>>[] {
  const placeIds = new Set(places.map((place) => place.id));
  const unknown = new Set<string>();
  for (const name of Object.keys(params)) {
    for (const id of params[name as keyof D].where ?? []) {
      if (!placeIds.has(id)) unknown.add(id);
    }
  }
  for (const id of unknown) {
    warn(`settings-panel: param where names unknown place "${id}"`);
  }

  type Key = keyof SettingsOf<D>;
  return places.map((place) => {
    const keys: Key[] = [];
    const seen = new Set<string>();
    const add = (key: string) => {
      if (seen.has(key)) return;
      seen.add(key);
      keys.push(key as Key);
    };
    for (const name of Object.keys(params)) {
      if (params[name as keyof D].where?.includes(place.id)) add(name);
    }
    for (const key of place.keys ?? []) add(key);
    if (keys.length === 0 && !place.easingIds?.length) {
      warn(`settings-panel: place "${place.id}" has no keys and no easingIds`);
    }
    return { ...place, keys };
  });
}

export function rowsOf<D extends Record<string, ParamEntry>>(
  params: Params<D>,
  keys: readonly (keyof D)[],
) {
  type S = SettingsOf<D>;
  const settings: NumberSetting<S>[] = [];
  const toggles: ToggleSetting<S>[] = [];
  const colors: ColorSetting<S>[] = [];
  const enums: EnumSetting<S>[] = [];
  const texts: TextSetting<S>[] = [];
  const anchors: AnchorSetting<S>[] = [];
  const xAnchors: XAnchorSetting<S>[] = [];
  const textAligns: TextAlignSetting<S>[] = [];
  const orients: FrameOrientSetting<S>[] = [];
  for (const key of keys) {
    const entry = params[key];
    switch (entry.kind) {
      case "number":
        settings.push(entry);
        break;
      case "toggle":
        toggles.push(entry);
        break;
      case "color":
        colors.push(entry);
        break;
      case "enum":
        enums.push(entry);
        break;
      case "text":
        texts.push(entry);
        break;
      case "anchor":
        anchors.push(entry);
        break;
      case "xAnchor":
        xAnchors.push(entry);
        break;
      case "textAlign":
        textAligns.push(entry);
        break;
      case "orient":
        orients.push(entry);
        break;
      default:
        break;
    }
  }
  return {
    ...(settings.length ? { settings } : {}),
    ...(toggles.length ? { toggles } : {}),
    ...(colors.length ? { colors } : {}),
    ...(enums.length ? { enums } : {}),
    ...(texts.length ? { texts } : {}),
    ...(anchors.length ? { anchors } : {}),
    ...(xAnchors.length ? { xAnchors } : {}),
    ...(textAligns.length ? { textAligns } : {}),
    ...(orients.length ? { orients } : {}),
  };
}
