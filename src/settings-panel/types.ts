import type { ReactNode } from "react";
import { FRAME_ORIENTS, type FrameOrient } from "../lib/frame-orient";
import type { SfSymbolName } from "../sf-symbol";
import type { Copy, PanelLocale } from "./locale";
export type { Copy, PanelLocale };

/**
 * Reset dot: value differs from default; click restores the default.
 * Info: optional ⓘ after the label with a hover tooltip.
 */
export type ResetDotProps = {
  modified?: boolean;
  onResetValue?: () => void;
  info?: string;
  icon?: SfSymbolName;
};

export type NumberSetting<TSettings> = {
  key: keyof TSettings;
  label: Copy;
  /** ⓘ next to the label: hover tooltip explaining the parameter. */
  info?: Copy;
  /** Optional SF glyph before the label (Figma row Icon + Glyph). */
  icon?: SfSymbolName;
  /** Default scrub track end. Track grows if the typed value is higher. */
  max: number;
  min: number;
  /** Expandable scrubber under the field (opt-in; not every row). */
  scrub?: boolean;
  /** 86 1×3 − / value / + (like Orient). Ignores `scrub`. */
  stepper?: boolean;
  /** Named ticks on the scrub track (snap while dragging). */
  tickStops?: readonly { value: number; label: Copy }[];
  step?: number;
  unit?: string;
  /** Render this field right under the matching toggle, not after all toggles. */
  after?: keyof TSettings;
};

export type ColorSetting<TSettings> = {
  key: keyof TSettings;
  label: Copy;
  info?: Copy;
  icon?: SfSymbolName;
  /** Field 86 + `%` to the right of hex. Swatch stays solid RGB. */
  opacityKey?: keyof TSettings;
  after?: keyof TSettings;
};

export type ToggleSetting<TSettings> = {
  key: keyof TSettings;
  label: Copy;
  info?: Copy;
  icon?: SfSymbolName;
  /** Label on the control when value is true */
  onLabel?: Copy;
  /** Label on the control when value is false */
  offLabel?: Copy;
  /**
   * Omit = switch 52×28. Named pair of modes: `segment` (or `dropdown`).
   * `action` = Panel / Action 86 — one button, label flips (Изменить / Сохранить).
   * Not an enum cycle. Three or more values: `EnumSetting` dropdown.
   */
  control?: "dropdown" | "segment" | "action";
  /** Segment track width. Default 86; /7 Тип **176**. */
  controlWidth?: number;
  /** Render this toggle under the matching number / pair field / other toggle. */
  after?: keyof TSettings;
  /** Switch on = stored false (label describes the default-off key). */
  invert?: boolean;
};

export const SETTING_ANCHORS = [
  "top left",
  "top",
  "top right",
  "left",
  "center",
  "right",
  "bottom left",
  "bottom",
  "bottom right",
] as const;

export type SettingAnchor = (typeof SETTING_ANCHORS)[number];

export const SETTING_X_ANCHORS = ["left", "center", "right"] as const;

export type SettingXAnchor = (typeof SETTING_X_ANCHORS)[number];

export const SETTING_TEXT_ALIGNS = [
  "left",
  "center",
  "right",
  "justify",
] as const;

export type SettingTextAlign = (typeof SETTING_TEXT_ALIGNS)[number];

export const SETTING_FRAME_ORIENTS = FRAME_ORIENTS;
export type SettingFrameOrient = FrameOrient;

export type AnchorSetting<TSettings> = {
  key: keyof TSettings;
  label: Copy;
  info?: Copy;
  icon?: SfSymbolName;
  /** Render this picker right under the matching toggle. */
  after?: keyof TSettings;
};

export type XAnchorSetting<TSettings> = {
  key: keyof TSettings;
  label: Copy;
  info?: Copy;
  icon?: SfSymbolName;
  /** Render this picker right under the matching toggle or number field. */
  after?: keyof TSettings;
};

export type TextAlignSetting<TSettings> = {
  key: keyof TSettings;
  label: Copy;
  info?: Copy;
  icon?: SfSymbolName;
  after?: keyof TSettings;
};

export type FrameOrientSetting<TSettings> = {
  key: keyof TSettings;
  label: Copy;
  info?: Copy;
  icon?: SfSymbolName;
};

export type EnumOption = {
  value: string;
  label: Copy;
};

export type EnumSetting<TSettings> = {
  key: keyof TSettings;
  label: Copy;
  info?: Copy;
  icon?: SfSymbolName;
  options: readonly EnumOption[];
  /**
   * Trigger width in px. Default **176** (Figma), not leftover fill.
   * Preset / bezier selects are separate and still fill the row.
   */
  controlWidth?: number;
  /** Render this control right under the matching toggle. */
  after?: keyof TSettings;
};

export type TextSetting<TSettings> = {
  key: keyof TSettings;
  label: Copy;
  info?: Copy;
  icon?: SfSymbolName;
  /** Render this field right under the matching toggle. */
  after?: keyof TSettings;
};

export type RangeSetting<TSettings> = {
  fromKey: keyof TSettings;
  toKey: keyof TSettings;
  label: Copy;
  info?: Copy;
  icon?: SfSymbolName;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /** Dual-thumb track under the row (default). `false` = pair of fields only, like Figma Wght. */
  track?: boolean;
  after?: keyof TSettings;
};

export type PairFieldIcon = "gapX" | "gapY" | "padX" | "padY";

export type PairField<TSettings> = {
  key: keyof TSettings;
  /** Full parameter name — goes to aria-label and the field tooltip. */
  ariaLabel: Copy;
  icon: PairFieldIcon;
  min: number;
  max: number;
  step?: number;
  unit?: string;
};

/** Two related number fields in one row: shared label, icon prefix inside each field. */
export type PairSetting<TSettings> = {
  label: Copy;
  info?: Copy;
  icon?: SfSymbolName;
  fields: readonly [PairField<TSettings>, PairField<TSettings>];
};

/** One segment of a phased transition: a phase (filled) or a pause (empty). */
export type PlayerPhase<TSettings> = {
  key: keyof TSettings;
  caption: Copy;
  kind: "phase" | "pause";
  max: number;
};

/** Playhead snapshot the scene publishes to the panel. */
export type PlayerState = {
  /** Position along the whole transition, 0…1. */
  q: number;
  playing: boolean;
  direction: 1 | -1;
  /** Slow-down multiplier ×1 / ×3 / ×10 — not a setting. */
  speed: number;
  /** Wheel drives the phase instead of the scene. */
  scrollView: boolean;
  /** Player toggle in the panel — scene shows the Moment HUD while open. */
  open: boolean;
  /** Pinned moments, 0…1. */
  pins: readonly number[];
};

/** Scene side of the player — the stand owns the transition, the panel only asks. */
export type PlayerController = {
  /** Stable per-page id — keys the `?moment=<id>:<q>` URL entry (several players may live on one page). */
  readonly id: string;
  getState(): PlayerState;
  subscribe(listener: (state: PlayerState) => void): () => void;
  /** Stop-frame at q. */
  seek(q: number): void;
  /** Run from the current position in this direction. */
  play(direction: 1 | -1): void;
  pause(): void;
  setSpeed(speed: number): void;
  setScrollView(on: boolean): void;
  /** Open from q = 0. Close resets viewing (q = 0, pause, scroll-view off). Pins stay. */
  setOpen(on: boolean): void;
  /** Pin the current moment; pinning the same moment again clears it. */
  togglePin(): void;
};

/** Phased transition row: total field + Player Toggle, then Плеер | Фазы. */
export type PlayerSetting<TSettings> = {
  label: Copy;
  info?: Copy;
  icon?: SfSymbolName;
  phases: readonly PlayerPhase<TSettings>[];
  unit?: string;
  min?: number;
  step?: number;
  controller: PlayerController;
};

/** Scene widget inside a subsection — not a new core row type. */
export type CustomSettingRender<TSettings> = (ctx: {
  settings: TSettings;
  onSettingsChange: (next: Partial<TSettings>) => void;
  rowReset: (key: keyof TSettings, info?: Copy) => ResetDotProps;
  locale: PanelLocale;
}) => ReactNode;

export type CustomSetting<TSettings> = {
  id: string;
  render: CustomSettingRender<TSettings>;
  /** Park under this setting’s row; omit = after texts, before numbers. */
  after?: keyof TSettings;
  /** Keys this widget writes — Reset / Copy count them. */
  keys?: readonly { key: keyof TSettings; label: Copy }[];
};

export type SettingsSection<TSettings> = {
  title: Copy;
  /** Rows in the group body, no subsection header / collapse. */
  untitled?: boolean;
  settings?: NumberSetting<TSettings>[];
  pairs?: PairSetting<TSettings>[];
  ranges?: RangeSetting<TSettings>[];
  colors?: ColorSetting<TSettings>[];
  toggles?: ToggleSetting<TSettings>[];
  anchors?: AnchorSetting<TSettings>[];
  xAnchors?: XAnchorSetting<TSettings>[];
  textAligns?: TextAlignSetting<TSettings>[];
  orients?: FrameOrientSetting<TSettings>[];
  enums?: EnumSetting<TSettings>[];
  texts?: TextSetting<TSettings>[];
  custom?: CustomSetting<TSettings>[];
  player?: PlayerSetting<TSettings>;
  /** Eye next to the subsection chevron — boolean visibility, not a row. */
  visibilityKey?: keyof TSettings;
};

export type SettingsGroup<TSettings> = {
  id: string;
  title: Copy;
  icon: SfSymbolName;
  sections: SettingsSection<TSettings>[];
  /** Eye next to the group chevron — boolean visibility, not a row. */
  visibilityKey?: keyof TSettings;
  /** Control left of the group chevron (folio Decrypt Replay). */
  headerAction?: ReactNode;
};

export type EasingTarget = {
  id: string;
  label: Copy;
};

/**
 * A pickable *place* on the scene (kreator-panel указка): not one DOM node’s
 * private settings, but the laws that apply to every instance of that place.
 * Hover outlines all matches; click filters the panel to `keys` / `easingIds`.
 */
export type SettingsPlace<TSettings> = {
  id: string;
  label: Copy;
  keys: readonly (keyof TSettings)[];
  /** Bezier target ids (`easings.*`) that belong to this place. */
  easingIds?: readonly string[];
  /** Keep `curveSection` visible while this place is selected. */
  includeCurve?: boolean;
  /** CSS selectors; first matching place in the list wins. */
  where?: readonly string[];
  /**
   * Hit-test when the place has no pointer target (overlay with
   * `pointer-events: none`, canvas). If set, `where` is only for outlines.
   */
  hit?: (x: number, y: number) => boolean;
};

export type SettingsPanelProps<TSettings> = {
  defaultOpenSections?: string[];
  easingTargets?: readonly EasingTarget[];
  /** Replace / prepend a plot section (e.g. zone or axis editor). */
  curveSection?: ReactNode;
  curveSectionTitle?: Copy;
  /** Section header glyph for `curveSection` (/2 Axis = `function` 􃈟; /5 zone = `slider.horizontal` 􀌆). */
  curveSectionIcon?: SfSymbolName;
  /** Title for the easing editor tab when it sits beside `curveSection`. */
  easingSectionTitle?: Copy;
  /** Replay the animation tied to the active easing target id */
  onReplay?: (easingId: string) => void;
  /** Duration for curve playhead preview when Replay is pressed */
  getReplayDurationMs?: (easingId: string) => number;
  /** Reset all settings to defaults */
  onReset?: () => void;
  /** Per-row reset dots: rows whose value differs from these defaults get a dot. */
  defaultSettings?: TSettings;
  /**
   * Scene places the pointer can pick. Dock 34 (`pointer.arrow.rays`) appears
   * when this list is non-empty. Click a place → panel keeps only its keys.
   */
  places?: readonly SettingsPlace<TSettings>[];
  /** Extra 28×28 control stacked under the trigger (shifts below Reset when open). */
  dockExtra?: ReactNode;
  onSettingsChange: (next: Partial<TSettings>) => void;
  panelId: string;
  /** Previous panelId values; used to migrate `${id}:subsection-order` and `${id}:panel-settings`. */
  legacyPanelIds?: readonly string[];
  settings: TSettings;
  groups: SettingsGroup<TSettings>[];
  storageLabel: string;
};
