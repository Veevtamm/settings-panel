import type { Copy } from "./locale";
import type {
  AnchorSetting,
  ColorSetting,
  EnumSetting,
  FrameOrientSetting,
  NumberSetting,
  PairField,
  PairSetting,
  PhaseStagger,
  PlayerPhase,
  PlayerSetting,
  RangeSetting,
  SettingAnchor,
  SettingFrameOrient,
  SettingTextAlign,
  SettingXAnchor,
  SettingsLayer,
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
  layer?: SettingsLayer;
};

/** One settings key inside a multi-key param (range ends, pair fields, clips). */
export type KeyDefault<K extends string = string> = { key: K; default: number };

/** Entries that own several settings keys; `defaults` is the source of their values. */
type Multi<Kind extends string, K extends string> = {
  kind: Kind;
  layer?: SettingsLayer;
  defaults: Record<K, number>;
};

export type RangeParam<K extends string = string> = Omit<
  RangeSetting<Bag>,
  "fromKey" | "toKey"
> &
  Multi<"range", K> & { fromKey: K; toKey: K };

export type PairParamField<K extends string = string> = Omit<
  PairField<Bag>,
  "key"
> &
  KeyDefault<K>;

export type PairParam<K extends string = string> = Omit<
  PairSetting<Bag>,
  "fields"
> &
  Multi<"pair", K> & {
    fields: readonly [PairField<Bag> & { key: K }, PairField<Bag> & { key: K }];
  };

export type PlayerParamPhase<K extends string = string> = Omit<
  PlayerPhase<Bag>,
  "key" | "startKey" | "stagger"
> &
  KeyDefault<K> & {
    start?: KeyDefault<K>;
    stagger?: Omit<PhaseStagger<Bag>, "stepKey"> & { step: KeyDefault<K> };
  };

/** `PlayerSetting` without `controller` — the scene adds it: `{ ...P.reel, controller }`. */
export type PlayerParam<K extends string = string> = Omit<
  PlayerSetting<Bag>,
  "totalKey" | "phases" | "controller"
> &
  Multi<"player", K> & {
    totalKey: K;
    phases: readonly (PlayerPhase<Bag> & { key: K })[];
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
  | ValueParam<unknown>
  | RangeParam
  | PairParam
  | PlayerParam;

type UnionToIntersection<U> = (
  U extends unknown ? (arg: U) => void : never
) extends (arg: infer I) => void
  ? I
  : never;

type SingleSettings<D> = {
  [K in keyof D as D[K] extends { defaults: object } ? never : K]: D[K] extends {
    default: infer V;
  }
    ? V
    : never;
};
type MultiSettings<D> = UnionToIntersection<
  {
    [K in keyof D]: D[K] extends { defaults: infer R } ? R : never;
  }[keyof D]
>;

export type SettingsOf<D extends Record<PropertyKey, unknown>> = {
  [K in keyof (SingleSettings<D> & MultiSettings<D>)]: (SingleSettings<D> &
    MultiSettings<D>)[K];
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
                    : D[K] extends { kind: "range" }
                      ? RangeSetting<SettingsOf<D>>
                      : D[K] extends { kind: "pair" }
                        ? PairSetting<SettingsOf<D>>
                        : D[K] extends { kind: "player" }
                          ? Omit<PlayerSetting<SettingsOf<D>>, "controller">
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

/** Dual range: two keys, one row. `from` / `to` carry their defaults. */
export function range<K extends string>({
  from,
  to,
  ...rest
}: Omit<RangeParam, "kind" | "defaults" | "fromKey" | "toKey"> & {
  from: KeyDefault<K>;
  to: KeyDefault<K>;
}): RangeParam<NoInfer<K>> {
  return {
    ...rest,
    kind: "range",
    fromKey: from.key,
    toKey: to.key,
    defaults: { [from.key]: from.default, [to.key]: to.default } as Record<
      K,
      number
    >,
  };
}

/** Two linked numbers in one row (gap X/Y, pad X/Y). */
export function pair<K extends string>({
  fields,
  ...rest
}: Omit<PairParam, "kind" | "defaults" | "fields"> & {
  fields: readonly [PairParamField<K>, PairParamField<K>];
}): PairParam<NoInfer<K>> {
  const [a, b] = fields.map(({ default: _default, ...field }) => field) as [
    PairField<Bag> & { key: K },
    PairField<Bag> & { key: K },
  ];
  return {
    ...rest,
    kind: "pair",
    fields: [a, b],
    defaults: {
      [fields[0].key]: fields[0].default,
      [fields[1].key]: fields[1].default,
    } as Record<K, number>,
  };
}

/** Timeline player: total, clips, starts and stagger steps as one entry. */
export function player<K extends string>({
  total,
  phases,
  ...rest
}: Omit<PlayerParam, "kind" | "defaults" | "totalKey" | "phases"> & {
  total: KeyDefault<K>;
  phases: readonly PlayerParamPhase<K>[];
}): PlayerParam<NoInfer<K>> {
  const defaults = { [total.key]: total.default } as Record<K, number>;
  const rows = phases.map(({ key, default: value, start, stagger, ...phase }) => {
    defaults[key] = value;
    if (start) defaults[start.key] = start.default;
    if (stagger) defaults[stagger.step.key] = stagger.step.default;
    const { step, ...staggerRest } = stagger ?? {};
    return {
      ...phase,
      key,
      ...(start ? { startKey: start.key } : {}),
      ...(stagger && step ? { stagger: { ...staggerRest, stepKey: step.key } } : {}),
    } as PlayerPhase<Bag> & { key: K };
  });
  return { ...rest, kind: "player", totalKey: total.key, phases: rows, defaults };
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
  range,
  pair,
  player,
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
  const out = {} as Record<PropertyKey, unknown>;
  for (const name of Object.keys(params) as (keyof D)[]) {
    const entry = params[name] as ParamEntry;
    if ("defaults" in entry) Object.assign(out, entry.defaults);
    else out[name] = entry.default;
  }
  return out as SettingsOf<D>;
}

type RowEntry<S> =
  | ({ kind: "number" } & NumberSetting<S>)
  | ({ kind: "toggle" } & ToggleSetting<S>)
  | ({ kind: "color" } & ColorSetting<S>)
  | ({ kind: "enum" } & EnumSetting<S>)
  | ({ kind: "text" } & TextSetting<S>)
  | ({ kind: "anchor" } & AnchorSetting<S>)
  | ({ kind: "xAnchor" } & XAnchorSetting<S>)
  | ({ kind: "textAlign" } & TextAlignSetting<S>)
  | ({ kind: "orient" } & FrameOrientSetting<S>)
  | ({ kind: "range" } & RangeSetting<S>)
  | ({ kind: "pair" } & PairSetting<S>)
  | { kind: "value" | "player" };

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
  const ranges: RangeSetting<S>[] = [];
  const pairs: PairSetting<S>[] = [];
  for (const key of keys) {
    const entry = params[key] as unknown as RowEntry<S>;
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
      case "range":
        ranges.push(entry);
        break;
      case "pair":
        pairs.push(entry);
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
    ...(ranges.length ? { ranges } : {}),
    ...(pairs.length ? { pairs } : {}),
  };
}
