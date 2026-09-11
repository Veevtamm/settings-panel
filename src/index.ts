"use client";

export {
  FIELD,
  GLASS,
  ICON,
  MUTED,
  fieldChrome,
  pickerChrome,
} from "./settings-panel/chrome";
export { L, PANEL_COPY, tx } from "./settings-panel/locale";
export type { Copy, LocaleText, PanelLocale } from "./settings-panel/locale";
export type { ResetDotProps } from "./settings-panel/types";
export {
  SETTING_ANCHORS,
  SETTING_FRAME_ORIENTS,
  SETTING_TEXT_ALIGNS,
  SETTING_X_ANCHORS,
} from "./settings-panel/types";
export type {
  AnchorSetting,
  ColorSetting,
  CustomSetting,
  CustomSettingRender,
  DerivedSetting,
  EasingTarget,
  EnumMark,
  EnumOption,
  EnumSetting,
  FrameOrientSetting,
  NumberSetting,
  PairField,
  PairFieldIcon,
  PairSetting,
  ParamPlacement,
  PlayerController,
  PlayerPhase,
  PlayerSetting,
  PlayerSolo,
  PlayerState,
  RangeSetting,
  RefSetting,
  SettingAnchor,
  SettingFrameOrient,
  SettingTextAlign,
  SettingXAnchor,
  SettingsGroup,
  SettingsLayer,
  SettingsPlace,
  SettingsSection,
  TextAlignSetting,
  TextSetting,
  ToggleSetting,
  XAnchorSetting,
} from "./settings-panel/types";
export { resolvePlaces } from "./settings-panel/model";
export {
  lintSettingsSchema,
  reportSettingsSchemaLint,
  LAYER_GROUP_IDS,
  LAYER_GROUP_TITLES,
} from "./settings-panel/schema-lint";
export type {
  SchemaLintIssue,
  SchemaLintInput,
} from "./settings-panel/schema-lint";
export {
  defineParams,
  defaultsOf,
  placesOf,
  rowsOf,
  param,
} from "./settings-panel/params";
export type {
  Params,
  ParamsOf,
  PlaceDef,
  SettingsOf,
} from "./settings-panel/params";
export { RowLabel, SettingRow } from "./settings-panel/row";
export {
  formatMoment,
  momentCopyText,
  momentUrl,
  patchPlayerClips,
  readMoment,
  usePlayerState,
} from "./settings-panel/player";
export type {
  PlayerClipsChange,
  PlayerSegment,
} from "./settings-panel/player";
export {
  SettingsTimeline,
  SettingsTimelineDockButton,
  timelinePropsFromPlayer,
} from "./settings-panel/timeline";
export { SettingsPanel } from "./settings-panel/shell";
export { FieldButton, SettingToggle } from "./settings-panel/fields";
export { pointInSelector, pointInSettingsPlace } from "./settings-panel/places";
export { PickRadioGroup } from "./settings-panel/pick";
export { SettingChips } from "./settings-panel/chips";
export { SettingCells, SettingSkipReplay } from "./settings-panel/cells";
export {
  SettingStrokeJoin,
  STROKE_JOINS,
  STROKE_JOIN_LABELS,
  isStrokeJoin,
  DEFAULT_MITER_ANGLE,
  miterAngleToLimit,
} from "./settings-panel/stroke-join";
export type { StrokeJoin } from "./settings-panel/stroke-join";
export { useCopyFlash } from "./settings-panel/use-copy-flash";
export {
  SfSymbol,
  isSfSymbolName,
  resolvePanelIcon,
  type SfSymbolName,
} from "./sf-symbol";
export { EasingCurveEditor } from "./easing-curve-editor";

export {
  PANEL_FOCUS_EVENT,
  PANEL_THEME_EVENT,
  focusPanel,
  panelThemeStorageKey,
  parsePanelSettingsObject,
  readPanelLocale,
  readPanelSettings,
  readPanelTheme,
  subscribePanelTheme,
  usePanelLocale,
  usePanelTheme,
  writePanelLocale,
  writePanelSettings,
  writePanelTheme,
} from "./lib/panel-theme";
export type {
  PanelFocusDetail,
  PanelSettingsFile,
  PanelTheme,
} from "./lib/panel-theme";
export { isOverSettingsPanel } from "./lib/is-over-settings-panel";
export { usePrefersReducedMotion } from "./lib/prefers-reduced-motion";
export { TransitionPlayer, PIN_EPSILON } from "./lib/transition-player";
export type { TransitionTracks } from "./lib/transition-player";
export {
  captionsAtQ,
  clipsTotal,
  fitClipsToTotal,
  layoutClips,
  momentMs,
  waapiSpan,
} from "./lib/player-clips";
export type { ClipInput, LaidClip } from "./lib/player-clips";
export {
  clampNumber,
  cn,
  loadNum,
  round200,
} from "./lib/utils";
export {
  formatBezierInput,
  parseBezierInput,
  sampleCubicBezier,
  clamp01,
  type CubicBezier,
} from "./lib/cubic-bezier";
export { normalizeHex, parseRgb } from "./lib/hex";
export { FRAME_ORIENTS, type FrameOrient } from "./lib/frame-orient";
export {
  SKIP_PATTERN_ROWS,
  parseSkipCells,
  serializeSkipCells,
} from "./lib/skip-cells";
export { evalNumberExpression } from "./lib/eval-number-expression";
export { copyText } from "./lib/copy-text";
export { useLocalSettingsStore } from "./lib/use-local-settings-store";
export {
  EASING_PRESET_LABELS,
  EASING_PRESET_LIST,
  easingForPreset,
  matchEasingPreset,
  type EasingPresetId,
} from "./lib/easing-presets";
