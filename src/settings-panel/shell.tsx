"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { EasingCurveEditor } from "../easing-curve-editor";
import { SfSymbol, type SfSymbolName } from "../sf-symbol";
import {
  formatBezierInput,
  parseBezierInput,
  type CubicBezier,
} from "../lib/cubic-bezier";
import {
  EASING_PRESET_LABELS,
  EASING_PRESET_LIST,
  easingForPreset,
  matchEasingPreset,
  type EasingPresetId,
} from "../lib/easing-presets";
import {
  parsePanelSettingsObject,
  writePanelLocale,
  writePanelSettings,
  writePanelTheme,
} from "../lib/panel-theme";
import { usePrefersReducedMotion } from "../lib/prefers-reduced-motion";
import { cn } from "../lib/utils";
import {
  CHEVRON_MS,
  CURVE_SIZE,
  DOCK_BTN,
  EASE_OUT,
  FIELD,
  GAP_IN,
  GLASS,
  ICON,
  MUTED,
  PANEL_ENTER_MS,
  PANEL_EXIT_MS,
  PANEL_HEIGHT_MIN,
  PANEL_MOVE_EDGE,
  PANEL_RESIZE_HIT,
  SECTION_CLOSED_PX,
  SECTION_MS,
  SNAPSHOT_SLOTS,
  SUBSECTION_DRAG_PX,
  SUBSECTION_HEADER_PX,
  fieldChrome,
  fieldValueMono,
  fieldValueSans,
  pickActive,
  pickEase,
  pickIdle,
  pickerChrome,
  rowLabelClass,
} from "./chrome";
import {
  applyLiftTransform,
  blockTopsByAttr,
  clampLiftY,
  collectGroupKeys,
  filterGroupsByPlace,
  insertIndexFromClientY,
  mergeChromeSectionOrder,
  mergeSectionOrder,
  moveTitleToIndex,
  PANEL_SECTION_ID,
  PLACE_SECTION_ID,
  DEFAULT_PINNED_SECTIONS,
  playListFlip,
  readEasings,
  readMigratedPanelUi,
  sectionHasStandardRows,
  splitPinnedSectionRails,
  valuesEqual,
  visitSectionKeys,
  withoutRetiredSectionIds,
  type LiftSize,
  type LiftXy,
} from "./model";
import { FieldButton, SettingToggle } from "./fields";
import { useCopyFlash } from "./use-copy-flash";
import { EasingPlayheadGate } from "./easing-playhead";
import { copyKey, PANEL_COPY, tx, type PanelLocale } from "./locale";
import { SettingPlayer } from "./player";
import {
  PlaceClearButton,
  PlaceHoverLayer,
  PlacePointerButton,
  placeParamCount,
  usePlacesPicker,
} from "./places";
import { usePanelWindow } from "./use-panel-window";
import { RowLabel, SectionCollapse, useDeferredMount } from "./row";
import { SectionIconPicker } from "./icon-picker";
import {
  nextPanelIcons,
  panelIconIsModified,
  resolvedPanelIcon,
  rowIconKey,
  subsectionIconKey,
} from "./panel-icons";
import { SectionRows } from "./section-rows";
import { PanelSelectList } from "./select";
import type {
  ResetDotProps,
  SettingsGroup,
  SettingsPanelProps,
  SettingsPlace,
  SettingsSection,
} from "./types";

const NO_PLACES: readonly SettingsPlace<never>[] = [];

export function SectionBlock({
  icon,
  title,
  open,
  onToggle,
  reduceMotion,
  children,
  modified,
  onResetValue,
  visibilityOn,
  onVisibilityChange,
  headerAction,
  leading,
  reorderable,
  onGripPointerDown,
  dragging,
  pinned,
  onPinClick,
  locale = "ru",
  onIconChange,
}: {
  icon: SfSymbolName;
  title: string;
  open: boolean;
  onToggle: () => void;
  reduceMotion: boolean;
  children: ReactNode;
  modified?: boolean;
  onResetValue?: () => void;
  visibilityOn?: boolean;
  onVisibilityChange?: (next: boolean) => void;
  headerAction?: ReactNode;
  /** Replaces the 20×20 section glyph (place filter: × instead of the group icon). */
  leading?: ReactNode;
  reorderable?: boolean;
  onGripPointerDown?: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  dragging?: boolean;
  pinned?: boolean;
  onPinClick?: () => void;
  locale?: PanelLocale;
  onIconChange?: (name: SfSymbolName) => void;
}) {
  return (
    <section
      className={cn(
        "flex w-full shrink-0 flex-col overflow-hidden p-2",
        open && "gap-4",
      )}
    >
      <div className="flex h-5 w-full items-center justify-between gap-2">
        {reorderable || onPinClick ? (
          <span className="inline-flex shrink-0 items-center gap-1">
            {reorderable && onGripPointerDown ? (
              <span
                aria-grabbed={dragging ?? false}
                aria-label={tx(PANEL_COPY.dragSection, locale)}
                className="inline-flex size-5 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
                onPointerDown={onGripPointerDown}
              >
                <SfSymbol
                  name="grip-vertical"
                  className="size-5"
                  style={{ color: ICON }}
                />
              </span>
            ) : null}
            {onPinClick ? (
              <button
                type="button"
                aria-pressed={pinned ?? false}
                aria-label={
                  pinned
                    ? tx(PANEL_COPY.unpinSection, locale)
                    : tx(PANEL_COPY.pinSection, locale)
                }
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onPinClick();
                }}
                className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center outline-none"
              >
                <SfSymbol
                  name={pinned ? "pin-off" : "pin"}
                  className="size-5"
                  style={{ color: ICON }}
                />
              </button>
            ) : null}
          </span>
        ) : null}
        {leading ? (
          <span className="inline-flex size-5 shrink-0 items-center justify-center">
            {leading}
          </span>
        ) : null}
        <span className="inline-flex min-w-0 flex-1 items-center gap-1">
          {leading || !onIconChange ? null : (
            <SectionIconPicker
              label={title}
              locale={locale}
              onChange={onIconChange}
              value={icon}
            />
          )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 cursor-pointer items-center text-left outline-none"
        >
          <span className="inline-flex min-w-0 items-center gap-1">
            {leading || onIconChange ? null : (
              <SfSymbol name={icon} className="size-5 shrink-0" style={{ color: ICON }} />
            )}
            {modified && onResetValue ? (
              <span
                role="button"
                tabIndex={0}
                aria-label={`${title}: ${tx(PANEL_COPY.resetDefault, locale)}`}
                title={tx(PANEL_COPY.resetDefault, locale)}
                onClick={(event) => {
                  event.stopPropagation();
                  onResetValue();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onResetValue();
                  }
                }}
                className="group/reset-dot -mx-0.5 flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--sp-line-focus)]"
              >
                <span
                  aria-hidden
                  className="size-[5px] rounded-full bg-[color:var(--sp-muted)] transition-colors duration-150 fine-hover:group-hover/reset-dot:bg-[color:var(--sp-fg)]"
                />
              </span>
            ) : null}
            <span
              className="truncate text-[15px] font-sans leading-[20px] select-none"
              style={{ color: MUTED }}
            >
              {title}
            </span>
          </span>
        </button>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          {headerAction}
          {onVisibilityChange != null && visibilityOn != null ? (
            <button
              type="button"
              aria-pressed={visibilityOn}
              aria-label={visibilityOn ? tx(PANEL_COPY.hide, locale) : tx(PANEL_COPY.show, locale)}
              onClick={() => onVisibilityChange(!visibilityOn)}
              className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center outline-none"
            >
              <SfSymbol
                name={visibilityOn ? "eye" : "eye-off"}
                className="size-5"
                style={{ color: ICON }}
              />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={
              open
                ? tx(PANEL_COPY.collapse(title), locale)
                : tx(PANEL_COPY.expand(title), locale)
            }
            className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center outline-none"
          >
            <SfSymbol
              name="chevron-up"
              className={cn(
                "size-5",
                !reduceMotion && "transition-transform",
                !open && "rotate-180",
              )}
              style={
                reduceMotion
                  ? { color: ICON }
                  : {
                      color: ICON,
                      transitionDuration: `${CHEVRON_MS}ms`,
                      transitionTimingFunction: EASE_OUT,
                    }
              }
            />
          </button>
        </span>
      </div>
      <SectionCollapse open={open} reduceMotion={reduceMotion}>
        {children}
      </SectionCollapse>
    </section>
  );
}

export function SectionDivider() {
  return (
    <div
      role="separator"
      className="h-px shrink-0 bg-[color:var(--sp-line)]"
    />
  );
}

export function ReorderShell({
  id,
  dragging,
  float,
  floatRef,
  theme,
  children,
  xyRef,
}: {
  id: string;
  dragging: boolean;
  float: LiftSize | null;
  floatRef?: RefObject<HTMLDivElement | null>;
  xyRef?: RefObject<LiftXy | null>;
  theme: "dark" | "light";
  children: ReactNode;
}) {
  const lifted = dragging && float !== null;
  useLayoutEffect(() => {
    if (!lifted) return;
    applyLiftTransform(floatRef?.current ?? null, xyRef?.current ?? null);
  });
  const card = (
    <div
      ref={(node) => {
        if (floatRef) floatRef.current = node;
        if (lifted) applyLiftTransform(node, xyRef?.current ?? null);
      }}
      className={cn("w-full font-sans", lifted && "select-none")}
      data-panel-theme={lifted ? theme : undefined}
      style={
        lifted && float
          ? {
              position: "fixed",
              left: 0,
              top: 0,
              width: float.width,
              zIndex: 200,
              pointerEvents: "none",
              margin: 0,
            }
          : undefined
      }
    >
      {children}
    </div>
  );
  return (
    <div
      className="flex w-full flex-col"
      data-section-id={id}
      style={lifted && float ? { height: float.height } : undefined}
    >
      <div data-section-shift="">{lifted ? null : card}</div>
      {lifted && typeof document !== "undefined"
        ? createPortal(card, document.body)
        : null}
    </div>
  );
}

export function SubsectionBlock({
  title,
  open,
  onToggle,
  onGripPointerDown,
  dragging,
  float,
  floatRef,
  xyRef,
  theme,
  reduceMotion,
  reorderable,
  plain,
  visibilityOn,
  onVisibilityChange,
  children,
  locale = "ru",
  orderKey,
  icon,
  onIconChange,
  modified,
  onResetValue,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  onGripPointerDown: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  dragging: boolean;
  float: LiftSize | null;
  floatRef?: RefObject<HTMLDivElement | null>;
  xyRef?: RefObject<LiftXy | null>;
  theme: "dark" | "light";
  reduceMotion: boolean;
  reorderable: boolean;
  plain?: boolean;
  visibilityOn?: boolean;
  onVisibilityChange?: (next: boolean) => void;
  children: ReactNode;
  locale?: PanelLocale;
  /** Stable subsection-order id (Russian copy). Defaults to `title`. */
  orderKey?: string;
  icon?: SfSymbolName;
  onIconChange?: (name: SfSymbolName) => void;
  modified?: boolean;
  onResetValue?: () => void;
}) {
  const subsectionKey = orderKey ?? title;
  const lifted = !plain && float !== null;
  useLayoutEffect(() => {
    if (!lifted) return;
    applyLiftTransform(floatRef?.current ?? null, xyRef?.current ?? null);
  });
  if (plain) {
    return (
      <div className="flex flex-col" data-subsection-title={subsectionKey}>
        {children}
      </div>
    );
  }
  const card = (
    <div
      ref={(node) => {
        if (floatRef) floatRef.current = node;
        if (lifted) applyLiftTransform(node, xyRef?.current ?? null);
      }}
      className={cn(
        "flex flex-col font-sans",
        open && "gap-2",
        lifted && "select-none",
      )}
      data-panel-theme={lifted ? theme : undefined}
      style={
        lifted
          ? {
              position: "fixed",
              left: 0,
              top: 0,
              width: float.width,
              zIndex: 200,
              pointerEvents: "none",
              margin: 0,
            }
          : undefined
      }
    >
      <div className="group/sub flex h-5 w-full items-center gap-1.5">
        <span
          className={cn(
            "inline-flex min-w-0 flex-1 items-center",
            reorderable || icon || onIconChange ? "gap-1" : "gap-0",
          )}
        >
          {reorderable ? (
          <span
            aria-grabbed={dragging}
            aria-label={tx(PANEL_COPY.drag, locale)}
            className={cn(
              "inline-flex h-5 shrink-0 cursor-grab items-center justify-center overflow-hidden active:cursor-grabbing",
              !reduceMotion && "transition-[width,margin,opacity,transform]",
              dragging
                ? "w-5 mr-1 scale-100 opacity-100"
                : "w-5 mr-1 scale-100 opacity-100 fine-hover:mr-0 fine-hover:w-0 fine-hover:scale-95 fine-hover:opacity-0 fine-hover:group-hover/sub:mr-1 fine-hover:group-hover/sub:w-5 fine-hover:group-hover/sub:scale-100 fine-hover:group-hover/sub:opacity-100",
            )}
            style={
              reduceMotion
                ? undefined
                : {
                    transitionDuration: `${CHEVRON_MS}ms`,
                    transitionTimingFunction: EASE_OUT,
                  }
            }
            onPointerDown={onGripPointerDown}
          >
            <SfSymbol name="grip-vertical" className="size-5" style={{ color: ICON }} />
          </span>
          ) : null}
          {onIconChange ? (
            <SectionIconPicker
              label={title}
              locale={locale}
              onChange={onIconChange}
              value={icon}
            />
          ) : icon ? (
            <SfSymbol
              name={icon}
              className="size-5 shrink-0"
              style={{ color: ICON }}
            />
          ) : null}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex min-w-0 flex-1 cursor-pointer items-center text-left outline-none"
          >
          <span className="inline-flex min-w-0 items-center gap-1">
          {modified && onResetValue ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={`${title}: ${tx(PANEL_COPY.resetDefault, locale)}`}
              title={tx(PANEL_COPY.resetDefault, locale)}
              onClick={(event) => {
                event.stopPropagation();
                onResetValue();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onResetValue();
                }
              }}
              className="group/reset-dot -mx-0.5 flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--sp-line-focus)]"
            >
              <span
                aria-hidden
                className="size-[5px] rounded-full bg-[color:var(--sp-muted)] transition-colors duration-150 fine-hover:group-hover/reset-dot:bg-[color:var(--sp-fg)]"
              />
            </span>
          ) : null}
          <span
            className="truncate text-[15px] font-sans leading-[20px] select-none"
            style={{ color: MUTED }}
          >
            {title}
          </span>
          </span>
          </button>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
        {onVisibilityChange != null && visibilityOn != null ? (
          <button
            type="button"
            aria-pressed={visibilityOn}
            aria-label={visibilityOn ? tx(PANEL_COPY.hide, locale) : tx(PANEL_COPY.show, locale)}
            onClick={() => onVisibilityChange(!visibilityOn)}
            className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center outline-none"
          >
            <SfSymbol
              name={visibilityOn ? "eye" : "eye-off"}
              className="size-5"
              style={{ color: ICON }}
            />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={
            open
              ? tx(PANEL_COPY.collapse(title), locale)
              : tx(PANEL_COPY.expand(title), locale)
          }
          className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center outline-none"
        >
        <SfSymbol
          name="chevron-up"
          className={cn(
            "size-5",
            !reduceMotion && "transition-transform",
            !open && "rotate-180",
          )}
          style={
            reduceMotion
              ? { color: ICON }
              : {
                  color: ICON,
                  transitionDuration: `${CHEVRON_MS}ms`,
                  transitionTimingFunction: EASE_OUT,
                }
          }
        />
        </button>
        </span>
      </div>
      <SectionCollapse open={open} reduceMotion={reduceMotion}>
        {children}
      </SectionCollapse>
    </div>
  );
  return (
    <div
      className="flex flex-col"
      data-subsection-title={subsectionKey}
      style={lifted ? { height: float.height } : undefined}
    >
      <div data-subsection-shift="">{lifted ? null : card}</div>
      {lifted && typeof document !== "undefined"
        ? createPortal(card, document.body)
        : null}
    </div>
  );
}

export function DockCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -top-1 -right-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[color:var(--sp-knob)] px-[3px] font-mono text-[9px] leading-none tabular-nums text-[color:var(--sp-field)]"
    >
      {count}
    </span>
  );
}

export function ToolbarButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-[28px] items-center justify-center gap-1 rounded-md border border-[color:var(--sp-line)] px-2 text-[12px] font-sans backdrop-blur-[8px] outline-none transition-[border-color,background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] fine-hover:hover:border-[color:var(--sp-line-hover)] fine-hover:hover:bg-[color:var(--sp-fill-hover)] focus-visible:border-[color:var(--sp-line-focus)] focus-visible:ring-1 focus-visible:ring-[color:var(--sp-line-mid)] active:scale-[0.97]",
        className,
      )}
      style={{ background: GLASS, color: MUTED }}
      {...props}
    >
      {children}
    </button>
  );
}

export function DockFoldButton({
  collapse,
  locale,
  onToggle,
}: {
  collapse: boolean;
  locale: PanelLocale;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={tx(
        collapse ? PANEL_COPY.collapseAll : PANEL_COPY.expandAll,
        locale,
      )}
      onClick={onToggle}
      className={cn(
        "inline-flex size-[34px] shrink-0 items-center justify-center rounded-md border px-0",
        "font-sans backdrop-blur-[8px] outline-none",
        "transition-[border-color,background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "border-[color:var(--sp-line)] hover:border-[color:var(--sp-line-hover)] hover:bg-[color:var(--sp-fill-hover)]",
        "focus-visible:border-[color:var(--sp-line-focus)] focus-visible:ring-1 focus-visible:ring-[color:var(--sp-line-mid)]",
        "active:scale-[0.97]",
      )}
      style={{ background: GLASS, color: MUTED }}
    >
      <SfSymbol
        name={
          collapse
            ? "list-chevrons-down-up"
            : "list-chevrons-up-down"
        }
      />
    </button>
  );
}

/** Panel / Icon 14×14 easing glyphs (`Symbol=Linear|Ease|…`). Custom bezier = 􃈟. */
export const PRESET_CURVE_D: Record<string, string> = {
  linear: "M0.75 14.75L14.75 0.75",
  ease: "M0.75 14.75C4.25 13.35 4.25 0.75 14.75 0.75",
  "ease-in": "M0.75 14.75C6.63 14.75 14.75 0.75 14.75 0.75",
  "ease-out": "M0.75 14.75C0.75 14.75 8.87 0.75 14.75 0.75",
  "ease-in-out": "M0.75 14.75C6.63 14.75 8.87 0.75 14.75 0.75",
  easeOutQuad: "M0.75 14.75C7.75 0.75 13.21 0.75 14.75 0.75",
  easeOutCubic: "M0.75 14.75C5.37 0.75 10.27 0.75 14.75 0.75",
  easeOutQuart: "M0.75 14.75C4.25 0.75 7.75 0.75 14.75 0.75",
  easeOutExpo: "M0.75 14.75C2.99 0.75 4.95 0.75 14.75 0.75",
  easeInOutQuart: "M0.75 14.75C11.39 14.75 4.11 0.75 14.75 0.75",
  easeInOutExpo: "M0.75 14.75C12.93 14.75 2.57 0.75 14.75 0.75",
  easeInOutBack: "M0.75 13.538C10.27 20.483 5.23 -4.983 14.75 1.962",
};

export function PresetCurveIcon({ id }: { id: string }) {
  const stroke = {
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (id === "custom") {
    return (
      <span
        aria-hidden
        className="relative size-[14px] shrink-0 overflow-hidden"
      >
        <SfSymbol
          name="function-square"
          className="pointer-events-none absolute size-5"
          style={{ left: -2, top: -3 }}
        />
      </span>
    );
  }

  const d = PRESET_CURVE_D[id];
  if (!d) return <span aria-hidden className="size-[14px] shrink-0" />;
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-[14px] shrink-0 overflow-hidden"
    >
      <path d={d} {...stroke} />
    </svg>
  );
}

export const PRESET_OPTIONS = EASING_PRESET_LIST.map((id) => ({
  id,
  label: EASING_PRESET_LABELS[id],
}));

export function SettingsPanel<TSettings>(props: SettingsPanelProps<TSettings>) {
  return <SettingsPanelImpl key={props.panelId} {...props} />;
}

export function SettingsPanelImpl<TSettings>({
  defaultOpenSections = ["bezier", "timings", "elements"],
  easingTargets = [],
  curveSection,
  curveSectionTitle,
  curveSectionIcon = "spline",
  easingSectionTitle,
  onReplay,
  getReplayDurationMs,
  onReset,
  defaultSettings,
  dockExtra,
  places = NO_PLACES as readonly SettingsPlace<TSettings>[],
  onSettingsChange,
  panelId,
  legacyPanelIds = [],
  settings,
  groups,
  storageLabel,
}: SettingsPanelProps<TSettings>) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelInstant, setPanelInstant] = useState(false);
  const [sectionIcons, setSectionIcons] = useState<
    Record<string, SfSymbolName>
  >({});
  const legacyPanelKey = legacyPanelIds.join("\0");

  const sameValue = valuesEqual;

  const dotFor = (
    key: keyof TSettings,
    info?: string,
    icon?: SfSymbolName,
  ): ResetDotProps => {
    const defaults = defaultSettings;
    if (defaults == null) return { info, icon };
    return {
      info,
      icon,
      modified: !sameValue(settings[key], defaults[key]),
      onResetValue: () =>
        onSettingsChange({ [key]: defaults[key] } as Partial<TSettings>),
    };
  };

  /** Default of a number key — feeds the scrub-track notch magnet. */
  const numberDefault = (key: keyof TSettings): number | undefined => {
    const d = defaultSettings?.[key];
    return typeof d === "number" ? d : undefined;
  };

  const dotForKeys = (
    keys: readonly (keyof TSettings)[],
    info?: string,
    icon?: SfSymbolName,
  ): ResetDotProps => {
    const defaults = defaultSettings;
    if (defaults == null) return { info, icon };
    return {
      info,
      icon,
      modified: keys.some((key) => !sameValue(settings[key], defaults[key])),
      onResetValue: () => {
        const patch = {} as Partial<TSettings>;
        for (const key of keys) {
          patch[key] = defaults[key];
        }
        onSettingsChange(patch);
      },
    };
  };

  const groupedKeys = collectGroupKeys(groups);
  const pageKeys: readonly (keyof TSettings)[] =
    defaultSettings != null
      ? (Object.keys(defaultSettings) as (keyof TSettings)[])
      : (Object.keys(settings as object) as (keyof TSettings)[]);
  const curveKeys = pageKeys.filter(
    (key) => String(key) !== "easings" && !groupedKeys.has(key),
  );
  const settingDiffers = (key: keyof TSettings) =>
    defaultSettings != null &&
    !sameValue(settings[key], (defaultSettings as TSettings)[key]);
  /** Keys that have a panel control. Hidden derived fields (frame W/H) stay out. */
  const listedChangedKeys =
    defaultSettings == null
      ? []
      : pageKeys.filter((key) => {
          if (String(key) === "easings") {
            return easingTargets.length > 0 && settingDiffers(key);
          }
          return groupedKeys.has(key) && settingDiffers(key);
        });
  const curvePlotChanged =
    Boolean(curveSection) && curveKeys.some(settingDiffers);
  const changedCount =
    listedChangedKeys.length +
    (curvePlotChanged ? 1 : 0) +
    Object.keys(sectionIcons).length;

  const { copied: copiedChanges, copy: copyToClipboard } = useCopyFlash();

  // With defaults known, Reset/Copy only make sense when something changed.
  const dockActionsVisible =
    panelOpen && (defaultSettings == null || changedCount > 0);
  const extraDockCount =
    (panelOpen ? 1 + (places.length > 0 ? 1 : 0) : 0) + (dockExtra ? 1 : 0);
  const extraShift =
    dockActionsVisible && onReset
      ? (DOCK_BTN + GAP_IN) * (defaultSettings != null ? 2 : 1)
      : 0;
  const {
    panelFloat,
    dockDragging,
    dockMovedRef,
    panelResizing,
    panelMoving,
    layoutCorner,
    dockRight,
    dockBottom,
    shownPos,
    maxPanelH,
    frameW,
    frameH,
    startPanelResize,
    startPanelMove,
    onDockPointerDown,
  } = usePanelWindow({
    panelId,
    legacyPanelIds,
    dockStackH: DOCK_BTN + extraShift + extraDockCount * (DOCK_BTN + GAP_IN),
  });

  const copyChangedSettings = async () => {
    const defaults = defaultSettings;
    if (defaults == null || changedCount === 0) return;
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
    if (curveSection) {
      for (const key of curveKeys) {
        put(key, `${curveTitle}: ${String(key)}`);
      }
    }
    put("easings" as keyof TSettings, easingTitle);
    const fmt = (value: unknown) =>
      typeof value === "string" ||
      (typeof value === "object" && value !== null)
        ? JSON.stringify(value)
        : String(value);
    const copyKeys: (keyof TSettings)[] = [
      ...listedChangedKeys,
      ...(curvePlotChanged
        ? curveKeys.filter(settingDiffers)
        : []),
    ];
    const labelForIconId = (id: string): string => {
      if (id === PANEL_SECTION_ID) return tx(PANEL_COPY.panelSettings, locale);
      if (id === "bezier") return curveTitle;
      if (id === easingSectionId) return easingTitle;
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
        const sectionLabel = section
          ? tx(section.title, locale)
          : titleKey;
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
    const lines = copyKeys
      .map((key) => {
        const label = labels.get(key);
        const name = label ? `${label} (${String(key)})` : String(key);
        return `${name}: ${fmt(settings[key])}`;
      });
    for (const [id, name] of Object.entries(sectionIcons)) {
      lines.push(tx(PANEL_COPY.copyIcon(labelForIconId(id), name), locale));
    }
    const text = `${tx(PANEL_COPY.copyDefaultsHeader, locale)}\n${lines.join("\n")}`;
    await copyToClipboard(text);
  };

  const curveDot =
    curveSection && curveKeys.length > 0
      ? dotForKeys(curveKeys)
      : undefined;
  const easingDot =
    easingTargets.length > 0 &&
    defaultSettings != null &&
    "easings" in (defaultSettings as object)
      ? dotFor("easings" as keyof TSettings)
      : undefined;

  const [snapshots, setSnapshots] = useState<(TSettings | null)[]>(() =>
    Array.from({ length: SNAPSHOT_SLOTS }, () => null),
  );
  const [activeSnapshot, setActiveSnapshot] = useState<number | null>(null);

  useEffect(() => {
    const empty = Array.from({ length: SNAPSHOT_SLOTS }, () => null);
    try {
      const raw = readMigratedPanelUi(
        panelId,
        ":snapshots",
        legacyPanelKey ? legacyPanelKey.split("\0") : [],
      );
      if (!raw) {
        setSnapshots(empty);
        setActiveSnapshot(null);
        return;
      }
      const parsed = JSON.parse(raw) as {
        slots?: (TSettings | null)[];
        active?: number | null;
        panelId?: string;
      };
      if (parsed.panelId != null && parsed.panelId !== panelId) {
        setSnapshots(empty);
        setActiveSnapshot(null);
        return;
      }
      setSnapshots(
        Array.isArray(parsed.slots)
          ? Array.from(
              { length: SNAPSHOT_SLOTS },
              (_, index) => parsed.slots?.[index] ?? null,
            )
          : empty,
      );
      setActiveSnapshot(
        typeof parsed.active === "number" ? parsed.active : null,
      );
    } catch {
      setSnapshots(empty);
      setActiveSnapshot(null);
    }
  }, [legacyPanelKey, panelId]);

  const persistSnapshots = (
    slots: (TSettings | null)[],
    active: number | null,
  ) => {
    setSnapshots(slots);
    setActiveSnapshot(active);
    try {
      localStorage.setItem(
        `${panelId}:snapshots`,
        JSON.stringify({ slots, active, panelId }),
      );
    } catch {
      /* quota / private mode */
    }
  };

  const saveSnapshot = (index: number) => {
    persistSnapshots(
      snapshots.map((slot, i) => (i === index ? settings : slot)),
      index,
    );
  };

  const applySnapshot = (index: number) => {
    const snap = snapshots[index];
    if (snap == null) return;
    const patch = {} as Partial<TSettings>;
    for (const key of pageKeys) {
      if (Object.prototype.hasOwnProperty.call(snap, key)) {
        patch[key] = snap[key];
      }
    }
    onSettingsChange(patch);
    persistSnapshots(snapshots, index);
  };

  const clearSnapshot = (index: number) => {
    persistSnapshots(
      snapshots.map((slot, i) => (i === index ? null : slot)),
      activeSnapshot === index ? null : activeSnapshot,
    );
  };

  const snapshotDrifted = (index: number) => {
    const snap = snapshots[index];
    if (snap == null) return false;
    return pageKeys.some((key) => !sameValue(settings[key], snap[key]));
  };
  const [openSections, setOpenSections] = useState(
    () => new Set(defaultOpenSections),
  );
  const { pickPlace, setPickPlace, placeId, selectedPlace, applyPlace } =
    usePlacesPicker({
      places,
      groups,
      onSelectPlace: () => {
        setPanelInstant(true);
        setPanelOpen(true);
        setOpenSections((prev) => new Set(prev).add(PLACE_SECTION_ID));
      },
    });
  const [closedSubsections, setClosedSubsections] = useState(
    () => new Set<string>(),
  );
  // Pointer mode belongs to the open panel — closing the panel cancels it.
  useEffect(() => {
    if (!panelOpen) setPickPlace(false);
  }, [panelOpen, setPickPlace]);
  const [panelTheme, setPanelTheme] = useState<"dark" | "light">("dark");
  const [locale, setLocale] = useState<PanelLocale>("ru");
  const [reorderSections, setReorderSections] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const sectionOrderRef = useRef(sectionOrder);
  const [pinnedSections, setPinnedSections] = useState<string[]>([
    ...DEFAULT_PINNED_SECTIONS,
  ]);
  const [draggingSection, setDraggingSection] = useState<string | null>(null);
  const [sectionFloat, setSectionFloat] = useState<LiftSize | null>(null);
  const sectionXyRef = useRef<LiftXy | null>(null);
  const sectionLiftedRef = useRef(false);
  const sectionDragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    offsetY: number;
    width: number;
    height: number;
    moved: boolean;
  } | null>(null);
  const sectionFloatElRef = useRef<HTMLDivElement | null>(null);
  const sectionFlipRef = useRef<Map<string, number> | null>(null);
  const skipSectionToggleRef = useRef(false);
  const sectionDragOpenRestoreRef = useRef<Set<string> | null>(null);
  const [subsectionOrder, setSubsectionOrder] = useState<
    Record<string, string[]>
  >({});
  const subsectionOrderRef = useRef(subsectionOrder);
  useEffect(() => {
    sectionOrderRef.current = sectionOrder;
  }, [sectionOrder]);
  useEffect(() => {
    subsectionOrderRef.current = subsectionOrder;
  }, [subsectionOrder]);
  const [draggingSubsection, setDraggingSubsection] = useState<string | null>(
    null,
  );
  const [subsectionFloat, setSubsectionFloat] = useState<LiftSize | null>(null);
  const subsectionXyRef = useRef<LiftXy | null>(null);
  const subsectionLiftedRef = useRef(false);
  const subsectionDragRef = useRef<{
    groupId: string;
    title: string;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    offsetY: number;
    width: number;
    height: number;
    moved: boolean;
  } | null>(null);
  const subsectionFloatElRef = useRef<HTMLDivElement | null>(null);
  const subsectionFlipRef = useRef<{
    groupId: string;
    fromTops: Map<string, number>;
  } | null>(null);
  const skipSubsectionToggleRef = useRef(false);
  const subsectionDragClosedRestoreRef = useRef<Set<string> | null>(null);
  const [activeEasingId, setActiveEasingId] = useState(
    () => easingTargets[0]?.id ?? "",
  );
  const reduceMotion = usePrefersReducedMotion();
  const skipPanelMotion = reduceMotion || panelInstant;
  const panelMounted = useDeferredMount(
    panelOpen,
    skipPanelMotion,
    skipPanelMotion ? 0 : PANEL_EXIT_MS,
  );

  const settingsEasings = readEasings(settings);
  const filteredGroups =
    selectedPlace != null
      ? filterGroupsByPlace(groups, new Set(selectedPlace.keys))
      : groups;
  const placeEasingIds = selectedPlace?.easingIds ?? [];
  const visibleEasingTargets =
    selectedPlace == null
      ? easingTargets
      : easingTargets.filter((target) => placeEasingIds.includes(target.id));
  useEffect(() => {
    const allowed =
      selectedPlace == null
        ? easingTargets.map((target) => target.id)
        : easingTargets
            .filter((target) =>
              (selectedPlace.easingIds ?? []).includes(target.id),
            )
            .map((target) => target.id);
    if (allowed.length === 0) return;
    setActiveEasingId((id) => (allowed.includes(id) ? id : allowed[0]!));
  }, [easingTargets, selectedPlace]);
  const activeEasing =
    settingsEasings?.[activeEasingId] ??
    settingsEasings?.[visibleEasingTargets[0]?.id ?? ""] ??
    ({ x1: 0.22, y1: 1, x2: 0.36, y2: 1 } satisfies CubicBezier);
  const easingPreset = matchEasingPreset(activeEasing);
  const showEasingEditor = easingTargets.length > 0;
  const showPlotSection = Boolean(curveSection);
  const renderPlotSection =
    showPlotSection && (selectedPlace == null || Boolean(selectedPlace.includeCurve));
  const renderEasingEditor = visibleEasingTargets.length > 0;

  const easingSectionId = showPlotSection ? "curves" : "bezier";
  const allSectionIds = [
    ...(showPlotSection ? ["bezier"] : []),
    ...(showEasingEditor ? [easingSectionId] : []),
    ...groups.map((group) => group.id),
    PANEL_SECTION_ID,
  ];
  const orderedSectionIds = mergeChromeSectionOrder(
    allSectionIds,
    sectionOrder,
  );
  const pinnedSet = new Set(pinnedSections);
  const sectionRails = splitPinnedSectionRails(orderedSectionIds, pinnedSet);
  const canReorderSections =
    reorderSections && orderedSectionIds.length > 1;

  const startSectionDrag = (
    event: ReactPointerEvent<HTMLSpanElement>,
    id: string,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const block = event.currentTarget.closest("[data-section-id]");
    if (!(block instanceof HTMLElement)) return;
    const rect = block.getBoundingClientRect();
    sectionDragRef.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingSection(id);
  };

  const persistPinnedSection = (id: string) => {
    const nextSet = new Set(pinnedSections);
    if (nextSet.has(id)) nextSet.delete(id);
    else nextSet.add(id);
    const next = [...nextSet];
    setPinnedSections(next);
    writePanelSettings(panelId, { pinnedSections: next });
  };

  const sectionReorderProps = (id: string) =>
    reorderSections
      ? {
          reorderable: canReorderSections,
          dragging: draggingSection === id,
          pinned: pinnedSet.has(id),
          onPinClick: () => persistPinnedSection(id),
          ...(canReorderSections
            ? {
                onGripPointerDown: (
                  event: ReactPointerEvent<HTMLSpanElement>,
                ) => startSectionDrag(event, id),
              }
            : {}),
        }
      : {};

  const patchEasing = (easing: CubicBezier) => {
    if (!activeEasingId) return;
    onSettingsChange({
      easings: {
        ...settingsEasings,
        [activeEasingId]: easing,
      },
    } as unknown as Partial<TSettings>);
  };

  const toggleSection = (id: string) => {
    if (skipSectionToggleRef.current) {
      skipSectionToggleRef.current = false;
      return;
    }
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSubsection = (id: string) => {
    setClosedSubsections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const foldableSectionIds = selectedPlace
    ? [PANEL_SECTION_ID, PLACE_SECTION_ID]
    : allSectionIds;
  const canCollapseAll = foldableSectionIds.some((id) =>
    openSections.has(id),
  );
  const toggleFoldAll = () => {
    if (canCollapseAll) {
      setOpenSections(new Set());
      setClosedSubsections(() => {
        const next = new Set<string>();
        for (const group of groups) {
          for (const section of group.sections) {
            if (section.untitled) continue;
            next.add(`${group.id}:${copyKey(section.title)}`);
          }
        }
        next.add(`${PLACE_SECTION_ID}:plot`);
        next.add(`${PLACE_SECTION_ID}:easing`);
        return next;
      });
      return;
    }
    setOpenSections(new Set(foldableSectionIds));
    setClosedSubsections(new Set());
  };

  useEffect(() => {
    try {
      const raw = readMigratedPanelUi(
        panelId,
        ":subsection-order",
        legacyPanelKey ? legacyPanelKey.split("\0") : [],
      );
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return;
      }
      const next: Record<string, string[]> = {};
      for (const [groupId, titles] of Object.entries(parsed)) {
        if (
          Array.isArray(titles) &&
          titles.every((title) => typeof title === "string")
        ) {
          next[groupId] = titles;
        }
      }
      setSubsectionOrder(next);
    } catch {
      /* ignore broken UI cache */
    }
  }, [legacyPanelKey, panelId]);

  useLayoutEffect(() => {
    const raw = readMigratedPanelUi(
      panelId,
      ":panel-settings",
      legacyPanelKey ? legacyPanelKey.split("\0") : [],
    );
    const parsed = parsePanelSettingsObject(raw);
    if (parsed.theme) setPanelTheme(parsed.theme);
    if (parsed.locale) setLocale(parsed.locale);
    if (parsed.reorderSections != null) {
      setReorderSections(parsed.reorderSections);
    }
    if (parsed.sectionOrder) {
      setSectionOrder(withoutRetiredSectionIds(parsed.sectionOrder));
    }
    if (parsed.pinnedSections !== undefined) {
      setPinnedSections(withoutRetiredSectionIds(parsed.pinnedSections));
    }
    setSectionIcons(parsed.sectionIcons ?? {});
  }, [legacyPanelKey, panelId]);

  const persistPanelTheme = (value: "dark" | "light") => {
    setPanelTheme(value);
    writePanelTheme(panelId, value);
  };

  const persistLocale = (value: PanelLocale) => {
    setLocale(value);
    writePanelLocale(panelId, value);
  };

  const persistSectionIcon = (
    id: string,
    fallback: SfSymbolName | undefined,
    next: SfSymbolName | undefined,
  ) => {
    setSectionIcons((prev) => {
      const map = nextPanelIcons(prev, id, fallback, next);
      writePanelSettings(panelId, { sectionIcons: map });
      return map;
    });
  };

  const withPanelIcon = (
    id: string,
    fallback: SfSymbolName | undefined,
    dots: ResetDotProps = {},
  ): ResetDotProps => {
    const iconMod = panelIconIsModified(sectionIcons, id);
    const resetValue = dots.onResetValue;
    return {
      ...dots,
      locale,
      icon: resolvedPanelIcon(sectionIcons, id, fallback),
      modified: Boolean(dots.modified) || iconMod,
      onResetValue:
        resetValue || iconMod
          ? () => {
              resetValue?.();
              if (iconMod) persistSectionIcon(id, fallback, fallback);
            }
          : undefined,
      onIconChange: reorderSections
        ? (name: SfSymbolName) => persistSectionIcon(id, fallback, name)
        : undefined,
    };
  };

  const rowDotFor = (
    key: keyof TSettings,
    info?: string,
    icon?: SfSymbolName,
  ) => withPanelIcon(rowIconKey(String(key)), icon, dotFor(key, info, icon));

  const rowDotForKeys = (
    keys: readonly (keyof TSettings)[],
    info?: string,
    icon?: SfSymbolName,
  ) =>
    withPanelIcon(
      rowIconKey(keys.map(String).join("+")),
      icon,
      dotForKeys(keys, info, icon),
    );

  const sectionIconProps = (
    id: string,
    fallback: SfSymbolName,
    extra?: ResetDotProps,
  ) => {
    const dots = withPanelIcon(id, fallback, extra ?? {});
    return {
      ...dots,
      icon: dots.icon ?? fallback,
    };
  };

  const curveTitle = tx(curveSectionTitle ?? PANEL_COPY.bezierCurve, locale);
  const easingTitle = tx(easingSectionTitle ?? PANEL_COPY.easingCurves, locale);

  const persistReorderSections = (value: boolean) => {
    setReorderSections(value);
    if (value) {
      setOpenSections((prev) => {
        const next = new Set(prev);
        for (const id of allSectionIds) {
          if (id !== PANEL_SECTION_ID) next.delete(id);
        }
        next.add(PANEL_SECTION_ID);
        if (placeId) next.add(PLACE_SECTION_ID);
        return next;
      });
    }
    writePanelSettings(panelId, { reorderSections: value });
  };

  useEffect(() => {
    if (!draggingSection && !draggingSubsection) return;
    const root = document.documentElement;
    root.dataset.panelReorder = "";
    return () => {
      delete root.dataset.panelReorder;
    };
  }, [draggingSection, draggingSubsection]);

  useEffect(() => {
    const drag = subsectionDragRef.current;
    if (!draggingSubsection || !drag) return;

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (
        !drag.moved &&
        Math.hypot(dx, dy) < SUBSECTION_DRAG_PX
      ) {
        return;
      }
      const dragJustStarted = !drag.moved;
      drag.moved = true;
      const root = document.getElementById(panelId);
      if (!root) return;
      const panelRect = root.getBoundingClientRect();
      if (dragJustStarted) {
        drag.height = SUBSECTION_HEADER_PX;
        const group = groups.find((item) => item.id === drag.groupId);
        const ids = (group?.sections ?? [])
          .filter((section) => !section.untitled)
          .map((section) => `${drag.groupId}:${copyKey(section.title)}`);
        const needsCollapse = ids.some((id) => !closedSubsections.has(id));
        if (needsCollapse) {
          const groupRoot = root.querySelector(
            `[data-subsection-group="${drag.groupId}"]`,
          );
          const blocks = groupRoot
            ? [
                ...groupRoot.querySelectorAll<HTMLElement>(
                  "[data-subsection-title]",
                ),
              ]
            : [];
          if (blocks.length > 0) {
            subsectionFlipRef.current = {
              groupId: drag.groupId,
              fromTops: blockTopsByAttr(blocks, "subsectionTitle"),
            };
          }
          subsectionDragClosedRestoreRef.current = new Set(closedSubsections);
          setClosedSubsections((prev) => {
            const next = new Set(prev);
            for (const id of ids) next.add(id);
            return next;
          });
        }
      }
      const x = drag.originX;
      const y = clampLiftY(
        event.clientY,
        drag.offsetY,
        panelRect,
        drag.height,
      );
      subsectionXyRef.current = { x, y };
      applyLiftTransform(subsectionFloatElRef.current, { x, y });
      if (!subsectionLiftedRef.current) {
        subsectionLiftedRef.current = true;
        setSubsectionFloat({ width: drag.width, height: drag.height });
      }
      const groupRoot = root.querySelector(
        `[data-subsection-group="${drag.groupId}"]`,
      );
      if (!groupRoot) return;
      const blocks = [
        ...groupRoot.querySelectorAll<HTMLElement>("[data-subsection-title]"),
      ];
      if (blocks.length < 2) return;
      const insertAt = insertIndexFromClientY(blocks, event.clientY);
      const prev = subsectionOrderRef.current;
      const current = mergeSectionOrder(
        groups
          .find((group) => group.id === drag.groupId)
          ?.sections.map((section) => copyKey(section.title)) ?? [],
        prev[drag.groupId],
      );
      const nextTitles = moveTitleToIndex(current, drag.title, insertAt);
      if (nextTitles === current) return;
      subsectionFlipRef.current = {
        groupId: drag.groupId,
        fromTops: blockTopsByAttr(blocks, "subsectionTitle"),
      };
      const next = { ...prev, [drag.groupId]: nextTitles };
      subsectionOrderRef.current = next;
      setSubsectionOrder(next);
    };

    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      const moved = drag.moved;
      const restoreClosed = subsectionDragClosedRestoreRef.current;
      subsectionDragClosedRestoreRef.current = null;
      subsectionDragRef.current = null;
      subsectionLiftedRef.current = false;
      subsectionXyRef.current = null;
      setDraggingSubsection(null);
      setSubsectionFloat(null);
      if (moved && restoreClosed) {
        setClosedSubsections(restoreClosed);
      }
      if (!moved) return;
      skipSubsectionToggleRef.current = true;
      try {
        localStorage.setItem(
          `${panelId}:subsection-order`,
          JSON.stringify(subsectionOrderRef.current),
        );
      } catch {
        /* quota / private mode */
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [closedSubsections, draggingSubsection, groups, panelId]);

  useLayoutEffect(() => {
    const pending = subsectionFlipRef.current;
    if (!pending) return;
    subsectionFlipRef.current = null;
    if (reduceMotion) return;
    const root = document.getElementById(panelId);
    const groupRoot = root?.querySelector(
      `[data-subsection-group="${pending.groupId}"]`,
    );
    if (!groupRoot) return;
    playListFlip(
      groupRoot,
      "data-subsection-title",
      pending.fromTops,
      draggingSubsection,
    );
  }, [
    closedSubsections,
    draggingSubsection,
    panelId,
    reduceMotion,
    subsectionOrder,
  ]);

  useEffect(() => {
    const drag = sectionDragRef.current;
    if (!draggingSection || !drag) return;

    const canonicalIds = () => [
      ...(showPlotSection ? ["bezier"] : []),
      ...(showEasingEditor ? [easingSectionId] : []),
      ...groups.map((group) => group.id),
      PANEL_SECTION_ID,
    ];

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < SUBSECTION_DRAG_PX) return;
      const dragJustStarted = !drag.moved;
      drag.moved = true;
      const root = document.getElementById(panelId);
      if (!root) return;
      const panelRect = root.getBoundingClientRect();
      if (dragJustStarted) {
        drag.height = SECTION_CLOSED_PX;
        const ids = canonicalIds();
        const needsCollapse = ids.some((id) => openSections.has(id));
        if (needsCollapse) {
          const list = root.querySelector("[data-section-list]");
          const blocks = list
            ? [...list.querySelectorAll<HTMLElement>("[data-section-id]")]
            : [];
          if (blocks.length > 0) {
            sectionFlipRef.current = blockTopsByAttr(blocks, "sectionId");
          }
          sectionDragOpenRestoreRef.current = new Set(openSections);
          setOpenSections((prev) => {
            const next = new Set(prev);
            for (const id of ids) next.delete(id);
            return next;
          });
        }
      }
      const x = drag.originX;
      const y = clampLiftY(
        event.clientY,
        drag.offsetY,
        panelRect,
        drag.height,
      );
      sectionXyRef.current = { x, y };
      applyLiftTransform(sectionFloatElRef.current, { x, y });
      if (!sectionLiftedRef.current) {
        sectionLiftedRef.current = true;
        setSectionFloat({ width: drag.width, height: drag.height });
      }
      const list = root.querySelector("[data-section-list]");
      if (!list) return;
      const blocks = [
        ...list.querySelectorAll<HTMLElement>("[data-section-id]"),
      ];
      if (blocks.length < 2) return;
      const insertAt = insertIndexFromClientY(blocks, event.clientY);
      const current = mergeChromeSectionOrder(
        canonicalIds(),
        sectionOrderRef.current,
      );
      const nextIds = moveTitleToIndex(current, drag.id, insertAt);
      if (nextIds === current) return;
      sectionFlipRef.current = blockTopsByAttr(blocks, "sectionId");
      sectionOrderRef.current = nextIds;
      setSectionOrder(nextIds);
    };

    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      const moved = drag.moved;
      const restoreOpen = sectionDragOpenRestoreRef.current;
      sectionDragOpenRestoreRef.current = null;
      sectionDragRef.current = null;
      sectionLiftedRef.current = false;
      sectionXyRef.current = null;
      setDraggingSection(null);
      setSectionFloat(null);
      if (moved && restoreOpen) setOpenSections(restoreOpen);
      if (!moved) return;
      skipSectionToggleRef.current = true;
      writePanelSettings(panelId, {
        sectionOrder: sectionOrderRef.current,
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [
    draggingSection,
    easingSectionId,
    groups,
    openSections,
    panelId,
    showEasingEditor,
    showPlotSection,
  ]);

  useLayoutEffect(() => {
    const pending = sectionFlipRef.current;
    if (!pending) return;
    sectionFlipRef.current = null;
    if (reduceMotion) return;
    const root = document.getElementById(panelId);
    const list = root?.querySelector("[data-section-list]");
    if (!list) return;
    playListFlip(list, "data-section-id", pending, draggingSection);
  }, [draggingSection, openSections, panelId, reduceMotion, sectionOrder]);

  useEffect(() => {
    if (visibleEasingTargets.some((target) => target.id === activeEasingId)) {
      return;
    }
    const first = visibleEasingTargets[0]?.id;
    if (first) setActiveEasingId(first);
  }, [activeEasingId, placeId, easingTargets]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Physical M + Command (meta). Ignore when typing in fields.
      if (!(event.metaKey && event.code === "KeyM")) return;
      if (event.altKey || event.ctrlKey || event.shiftKey) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(
          "input, textarea, select, [contenteditable=true]",
        )
      ) {
        return;
      }

      event.preventDefault();
      setPanelInstant(true);
      setPanelOpen((open) => !open);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sectionVisible = (sectionId: string) => {
    if (sectionId === PANEL_SECTION_ID) return true;
    if (selectedPlace != null) return false;
    if (sectionId === "bezier") return renderPlotSection;
    if (sectionId === easingSectionId) return renderEasingEditor;
    return filteredGroups.some((group) => group.id === sectionId);
  };
  const panelScroll =
    "overflow-y-auto overscroll-y-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

  return (
    <div
      data-settings-panel=""
      data-panel-theme={panelTheme}
      data-dock-dragging={dockDragging ? "" : undefined}
      data-dock-corner={layoutCorner}
      className={cn(
        "pointer-events-auto fixed z-[100] font-sans text-left",
        dockDragging && "select-none",
      )}
      style={{
        top: shownPos.y,
        left: shownPos.x,
        ...(dockDragging || skipPanelMotion
          ? {}
          : {
              transitionProperty: "top, left",
              transitionDuration: `${PANEL_ENTER_MS}ms`,
              transitionTimingFunction: EASE_OUT,
            }),
      }}
    >
      <div className="relative flex flex-col items-start">
        <div className="relative z-10">
          <div className="relative">
            <ToolbarButton
              id={`${panelId}-trigger`}
              aria-expanded={panelOpen}
              aria-controls={panelId}
              aria-keyshortcuts="Meta+M"
              aria-label={
                panelOpen
                  ? tx(PANEL_COPY.closePanel, locale)
                  : changedCount > 0
                    ? tx(PANEL_COPY.openPanelChanged(changedCount), locale)
                    : tx(PANEL_COPY.openPanel, locale)
              }
              className={cn(
                "size-[34px] shrink-0 touch-none px-0",
                dockDragging && "cursor-grabbing active:scale-100",
              )}
              onPointerDown={onDockPointerDown}
              onClick={() => {
                if (dockMovedRef.current) return;
                setPanelInstant(false);
                setPanelOpen((open) => !open);
              }}
            >
              <SfSymbol
                name={panelOpen ? "x" : "settings"}
                className="size-5"
              />
            </ToolbarButton>
            <DockCountBadge count={panelOpen ? 0 : changedCount} />
          </div>

          {extraDockCount > 0 ? (
            <div
              className={cn(
                "absolute left-0 flex",
                dockBottom ? "flex-col-reverse" : "flex-col",
                !skipPanelMotion && "transition-transform will-change-transform",
              )}
              style={{
                gap: GAP_IN,
                ...(dockBottom
                  ? {
                      bottom: `calc(100% + ${GAP_IN}px)`,
                      top: "auto",
                      transform: `translateY(${-extraShift}px)`,
                    }
                  : {
                      top: `calc(100% + ${GAP_IN}px)`,
                      transform: `translateY(${extraShift}px)`,
                    }),
                ...(skipPanelMotion
                  ? {}
                  : {
                      transitionDuration: panelOpen
                        ? `${PANEL_ENTER_MS}ms`
                        : `${PANEL_EXIT_MS}ms`,
                      transitionTimingFunction: EASE_OUT,
                    }),
              }}
            >
              {panelOpen ? (
                <DockFoldButton
                  collapse={canCollapseAll}
                  locale={locale}
                  onToggle={toggleFoldAll}
                />
              ) : null}
              {panelOpen && places.length > 0 ? (
                <PlacePointerButton
                  active={pickPlace}
                  locale={locale}
                  onToggle={() => setPickPlace((on) => !on)}
                />
              ) : null}
              {dockExtra}
            </div>
          ) : null}

          {onReset ? (
            <div
              className={cn(
                "absolute left-0 z-[1]",
                dockBottom ? "bottom-full mb-2" : "top-full mt-2",
                skipPanelMotion
                  ? dockActionsVisible
                    ? "opacity-100"
                    : "pointer-events-none opacity-0"
                  : cn(
                      "transition-[opacity,transform] will-change-[opacity,transform]",
                      dockActionsVisible
                        ? "translate-y-0 scale-100 opacity-100"
                        : dockBottom
                          ? "pointer-events-none translate-y-1 scale-[0.98] opacity-0"
                          : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0",
                    ),
              )}
              style={
                skipPanelMotion
                  ? undefined
                  : {
                      transitionDuration: dockActionsVisible
                        ? `${PANEL_ENTER_MS}ms`
                        : `${PANEL_EXIT_MS}ms`,
                      transitionTimingFunction: EASE_OUT,
                    }
              }
              inert={dockActionsVisible ? undefined : true}
            >
              <div
                className={cn(
                  "flex gap-2",
                  dockBottom ? "flex-col-reverse" : "flex-col",
                )}
              >
                <ToolbarButton
                  aria-label={
                    changedCount > 0
                      ? tx(PANEL_COPY.resetSettings(changedCount), locale)
                      : tx(PANEL_COPY.resetSettings(0), locale)
                  }
                  className="size-[34px] shrink-0 px-0"
                  onClick={() => {
                    if (Object.keys(sectionIcons).length > 0) {
                      setSectionIcons({});
                      writePanelSettings(panelId, { sectionIcons: {} });
                    }
                    onReset();
                  }}
                >
                  <SfSymbol name="eraser" className="size-5" />
                </ToolbarButton>
                {defaultSettings != null ? (
                  <div className="relative">
                    <ToolbarButton
                      aria-label={
                        copiedChanges
                          ? tx(PANEL_COPY.copyDefaultsDone, locale)
                          : tx(PANEL_COPY.copyDefaults(changedCount), locale)
                      }
                      className="size-[34px] shrink-0 px-0"
                      onClick={copyChangedSettings}
                    >
                      <SfSymbol
                        name={copiedChanges ? "check" : "file"}
                        className="size-5"
                      />
                    </ToolbarButton>
                    <DockCountBadge count={changedCount} />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div
          id={panelId}
          data-settings-panel-window=""
          role="region"
          aria-label={`${storageLabel} animation settings`}
          aria-roledescription={tx(PANEL_COPY.movePanel, locale)}
          aria-hidden={!panelOpen}
          inert={panelOpen ? undefined : true}
          onPointerDown={startPanelMove}
          className={cn(
            "relative flex min-h-0 flex-col gap-0 overflow-hidden rounded-lg border border-[color:var(--sp-line)] backdrop-blur-[8px]",
            panelFloat == null
              ? cn(
                  "absolute",
                  dockBottom ? "bottom-0 top-auto" : "top-0",
                  dockRight
                    ? "right-full left-auto mr-1.5"
                    : "left-full ml-1.5",
                  dockBottom
                    ? dockRight
                      ? "origin-bottom-right"
                      : "origin-bottom-left"
                    : dockRight
                      ? "origin-top-right"
                      : "origin-top-left",
                )
              : "fixed origin-center",
            skipPanelMotion
              ? panelOpen
                ? "opacity-100"
                : "pointer-events-none opacity-0"
              : cn(
                  "transition-[opacity,transform] will-change-[opacity,transform]",
                  panelOpen
                    ? "translate-x-0 scale-100 opacity-100"
                    : dockRight
                      ? "pointer-events-none translate-x-1.5 scale-[0.98] opacity-0"
                      : "pointer-events-none -translate-x-1.5 scale-[0.98] opacity-0",
                ),
            (panelResizing || panelMoving) && "select-none",
            panelMoving && "cursor-grabbing",
          )}
          style={{
            background: GLASS,
            width: frameW,
            maxHeight: frameH ?? maxPanelH,
            height: "fit-content",
            ...(panelFloat != null
              ? {
                  left: panelFloat.x,
                  top: panelFloat.y,
                  right: "auto",
                  bottom: "auto",
                  margin: 0,
                }
              : {}),
            ...(skipPanelMotion || panelMoving || panelResizing
              ? {}
              : {
                  transitionDuration: panelOpen
                    ? `${PANEL_ENTER_MS}ms`
                    : `${PANEL_EXIT_MS}ms`,
                  transitionTimingFunction: EASE_OUT,
                }),
          }}
        >
          {panelMounted ? (() => {
          const renderGroupSectionItem = (
            group: SettingsGroup<TSettings>,
            section: SettingsSection<TSettings>,
            orderKey: string,
            mode: "auto" | "plain" | "subsection",
          ): ReactNode => {
            const subsectionId = `${group.id}:${orderKey}`;
            const sectionTitle = tx(section.title, locale);
            const player = section.player;
            const timelineBlock = player ? (
              <SettingPlayer
                label={tx(player.label, locale)}
                locale={locale}
                segments={player.phases.map((phase) => ({
                  caption: tx(phase.caption, locale),
                  kind: phase.kind,
                  max: phase.max,
                  value: Number(settings[phase.key]),
                }))}
                min={player.min}
                step={player.step}
                unit={player.unit}
                controller={player.controller}
                reduceMotion={reduceMotion}
                onChange={(values) =>
                  onSettingsChange(
                    Object.fromEntries(
                      player.phases.map((phase, i) => [phase.key, values[i]]),
                    ) as Partial<TSettings>,
                  )
                }
                {...rowDotForKeys(
                  player.phases.map((phase) => phase.key),
                  player.info == null ? undefined : tx(player.info, locale),
                  player.icon,
                )}
              />
            ) : null;
            const hasStandardRows = sectionHasStandardRows(section);
            const rows = (
              <div className="flex flex-col gap-2">
                {timelineBlock}
                {hasStandardRows ? (
                  <SectionRows
                    section={section}
                    settings={settings}
                    onSettingsChange={onSettingsChange}
                    reduceMotion={reduceMotion}
                    locale={locale}
                    numberDefault={numberDefault}
                    dotFor={rowDotFor}
                    dotForKeys={rowDotForKeys}
                  />
                ) : null}
              </div>
            );
            const flatten =
              mode === "plain" ||
              (mode === "auto" &&
                (section.untitled ||
                  Boolean(timelineBlock && !hasStandardRows)));
            if (flatten) {
              return (
                <div key={orderKey} data-subsection-title={orderKey}>
                  {rows}
                </div>
              );
            }
            return (
              <SubsectionBlock
                key={orderKey}
                title={sectionTitle}
                orderKey={orderKey}
                locale={locale}
                plain={false}
                open={!closedSubsections.has(subsectionId)}
                onToggle={() => {
                  if (skipSubsectionToggleRef.current) {
                    skipSubsectionToggleRef.current = false;
                    return;
                  }
                  toggleSubsection(subsectionId);
                }}
                dragging={draggingSubsection === orderKey}
                float={
                  draggingSubsection === orderKey ? subsectionFloat : null
                }
                floatRef={
                  draggingSubsection === orderKey
                    ? subsectionFloatElRef
                    : undefined
                }
                xyRef={
                  draggingSubsection === orderKey ? subsectionXyRef : undefined
                }
                theme={panelTheme}
                {...withPanelIcon(
                  subsectionIconKey(group.id, orderKey),
                  section.icon,
                )}
                reorderable={mode === "auto" && group.sections.length > 1}
                onGripPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.stopPropagation();
                  const block = event.currentTarget.closest(
                    "[data-subsection-title]",
                  );
                  if (!(block instanceof HTMLElement)) return;
                  const rect = block.getBoundingClientRect();
                  subsectionDragRef.current = {
                    groupId: group.id,
                    title: orderKey,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    originX: rect.left,
                    offsetY: event.clientY - rect.top,
                    width: rect.width,
                    height: rect.height,
                    moved: false,
                  };
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDraggingSubsection(orderKey);
                }}
                reduceMotion={reduceMotion}
                visibilityOn={
                  section.visibilityKey != null
                    ? Boolean(settings[section.visibilityKey])
                    : undefined
                }
                onVisibilityChange={
                  section.visibilityKey != null
                    ? (next) =>
                        onSettingsChange({
                          [section.visibilityKey!]: next,
                        } as Partial<TSettings>)
                    : undefined
                }
              >
                {rows}
              </SubsectionBlock>
            );
          };
          const noopGrip = (event: ReactPointerEvent<HTMLSpanElement>) => {
            event.preventDefault();
          };
          const renderPlaceSub = (
            title: string,
            orderKey: string,
            children: ReactNode,
          ) => (
            <SubsectionBlock
              key={orderKey}
              title={title}
              orderKey={orderKey}
              locale={locale}
              open={!closedSubsections.has(`${PLACE_SECTION_ID}:${orderKey}`)}
              onToggle={() => {
                if (skipSubsectionToggleRef.current) {
                  skipSubsectionToggleRef.current = false;
                  return;
                }
                toggleSubsection(`${PLACE_SECTION_ID}:${orderKey}`);
              }}
              dragging={false}
              float={null}
              theme={panelTheme}
              {...withPanelIcon(
                subsectionIconKey(PLACE_SECTION_ID, orderKey),
                undefined,
              )}
              reorderable={false}
              onGripPointerDown={noopGrip}
              reduceMotion={reduceMotion}
            >
              {children}
            </SubsectionBlock>
          );
          const easingEditorBody = (
            <div className="flex w-full flex-col gap-2">
              {visibleEasingTargets.length > 1 ? (
                <PanelSelectList
                  value={activeEasingId}
                  options={visibleEasingTargets.map((target) => ({
                    id: target.id,
                    label: tx(target.label, locale),
                  }))}
                  ariaLabel="Animation for easing"
                  reduceMotion={reduceMotion}
                  onChange={setActiveEasingId}
                />
              ) : null}

              <EasingPlayheadGate
                durationMs={getReplayDurationMs?.(activeEasingId) ?? 700}
                onReplay={
                  onReplay && activeEasingId
                    ? () => onReplay(activeEasingId)
                    : undefined
                }
                reduceMotion={reduceMotion}
              >
                {(playhead, replay) => (
              <div className="flex w-full flex-col gap-1">
                <div
                  className={cn("w-full overflow-hidden rounded", fieldChrome)}
                  style={{ background: FIELD }}
                >
                  <EasingCurveEditor
                    accent={panelTheme === "light" ? "#1a1a1a" : "#ffffff"}
                    onChange={patchEasing}
                    playhead={playhead}
                    size={CURVE_SIZE}
                    value={activeEasing}
                  />
                </div>

                <div className="flex h-[28px] w-full items-center gap-1">
                  {onReplay ? (
                    <FieldButton
                      label="Replay selected easing"
                      onClick={replay}
                      className="overflow-hidden active:scale-[0.97] fine-hover:hover:bg-[color:var(--sp-fill-hover)]"
                    >
                      <SfSymbol name="rotate-ccw" className="size-5" />
                    </FieldButton>
                  ) : null}

                  <PanelSelectList
                    value={easingPreset}
                    options={PRESET_OPTIONS}
                    ariaLabel={tx(PANEL_COPY.bezierPreset, locale)}
                    reduceMotion={reduceMotion}
                    className="min-w-0 flex-1"
                    optionIcon={(id) => <PresetCurveIcon id={id} />}
                    onChange={(presetId) => {
                      const preset = presetId as EasingPresetId;
                      if (preset === "custom") return;
                      const easing = easingForPreset(preset);
                      const parsed = easing ? parseBezierInput(easing) : null;
                      if (parsed) patchEasing(parsed);
                    }}
                  />
                </div>

                <div className="group flex h-[28px] min-w-0 items-center justify-between gap-4">
                  <span className={cn(rowLabelClass, "min-w-0")}>
                    {tx(PANEL_COPY.curveParams, locale)}
                  </span>
                  <input
                    type="text"
                    spellCheck={false}
                    autoComplete="off"
                    aria-label={`${storageLabel} cubic-bezier`}
                    value={formatBezierInput(activeEasing)}
                    onChange={(event) => {
                      const parsed = parseBezierInput(event.target.value);
                      if (parsed) patchEasing(parsed);
                    }}
                    className={cn(
                      "h-[28px] min-w-0 w-[180px] max-w-[180px] shrink-0 rounded px-1.5 text-left",
                      fieldValueMono,
                      fieldChrome,
                    )}
                    style={{
                      background: FIELD,
                      color: MUTED,
                    }}
                  />
                </div>
              </div>
                )}
              </EasingPlayheadGate>
            </div>
          );
          const renderOrderedSection = (
            sectionId: string,
            dividerBefore: boolean,
          ) => {
            const shell = (node: ReactNode) => (
              <Fragment key={sectionId}>
                {dividerBefore ? <SectionDivider /> : null}
                <ReorderShell
                  dragging={draggingSection === sectionId}
                  float={
                    draggingSection === sectionId ? sectionFloat : null
                  }
                  floatRef={
                    draggingSection === sectionId
                      ? sectionFloatElRef
                      : undefined
                  }
                  xyRef={
                    draggingSection === sectionId ? sectionXyRef : undefined
                  }
                  id={sectionId}
                  theme={panelTheme}
                >
                  {node}
                </ReorderShell>
              </Fragment>
            );
            if (sectionId === PANEL_SECTION_ID) {
              return shell(
          <SectionBlock
            {...sectionIconProps(PANEL_SECTION_ID, "sliders-horizontal")}
            title={tx(PANEL_COPY.panelSettings, locale)}
            open={openSections.has("panel")}
            onToggle={() => toggleSection("panel")}
            reduceMotion={reduceMotion}
            locale={locale}
            {...sectionReorderProps(PANEL_SECTION_ID)}
          >
            <div className="flex flex-col gap-2">
              <div
                className="flex h-[28px] min-w-0 items-center justify-between gap-4"
                data-setting-row=""
              >
                <RowLabel
                  label={tx(PANEL_COPY.presets, locale)}
                  info={tx(PANEL_COPY.presetsInfo, locale)}
                  {...withPanelIcon("row:presets", "save")}
                />
              <div
                role="group"
                aria-label={tx(PANEL_COPY.presetsAria, locale)}
                className={cn(
                  "grid h-[28px] w-[144px] shrink-0 grid-cols-[28px_1px_28px_1px_28px_1px_28px_1px_28px]",
                  pickerChrome,
                )}
              >
                {Array.from({ length: SNAPSHOT_SLOTS }, (_, index) => {
                  const filled = snapshots[index] != null;
                  const active = filled && activeSnapshot === index;
                  const drifted = active && snapshotDrifted(index);
                  const cell = (
                    <div key={index} className="group/slot relative">
                      <button
                        type="button"
                        aria-label={tx(
                          PANEL_COPY.presetSlot(
                            index + 1,
                            filled
                              ? active
                                ? "active"
                                : "apply"
                              : "empty",
                          ),
                          locale,
                        )}
                        onClick={(event) => {
                          if (!filled || event.altKey) saveSnapshot(index);
                          else applySnapshot(index);
                        }}
                        className={cn(
                          "flex size-[28px] items-center justify-center font-mono text-[12px] leading-none tabular-nums outline-none",
                          pickEase,
                          active ? pickActive : pickIdle,
                        )}
                      >
                        {index + 1}
                      </button>
                      {drifted ? (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute top-[3px] right-[3px] size-[5px] rounded-full bg-[color:var(--sp-fg)] group-hover/slot:opacity-0"
                        />
                      ) : null}
                      {filled ? (
                        <button
                          type="button"
                          aria-label={tx(
                            PANEL_COPY.clearPreset(index + 1),
                            locale,
                          )}
                          onClick={() => clearSnapshot(index)}
                          className="absolute top-0 right-0 z-[1] hidden size-[11px] items-center justify-center rounded-bl bg-[color:var(--sp-knob)] text-[10px] leading-none text-[color:var(--sp-field)] outline-none fine-hover:group-hover/slot:flex"
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  );
                  if (index === SNAPSHOT_SLOTS - 1) return [cell];
                  return [
                    cell,
                    <div
                      key={`rule-${index}`}
                      aria-hidden
                      className="bg-[color:var(--sp-fill-strong)]"
                    />,
                  ];
                })}
              </div>
              </div>
              <SettingToggle
                label={tx(PANEL_COPY.language, locale)}
                control="segment"
                offLabel="Ru"
                onLabel="Eng"
                onChange={(en) => persistLocale(en ? "en" : "ru")}
                value={locale === "en"}
              />
              <SettingToggle
                label={tx(PANEL_COPY.theme, locale)}
                control="segment"
                offLabel="Light"
                onLabel="Dark"
                offIcon="sun"
                onIcon="moon"
                onChange={(dark) =>
                  persistPanelTheme(dark ? "dark" : "light")
                }
                value={panelTheme === "dark"}
              />
              <SettingToggle
                info={tx(PANEL_COPY.sectionOrderInfo, locale)}
                label={tx(PANEL_COPY.sectionOrder, locale)}
                onChange={persistReorderSections}
                value={reorderSections}
              />
            </div>
          </SectionBlock>
              );
            }
            if (sectionId === PLACE_SECTION_ID && selectedPlace) {
              const groupById = new Map(
                filteredGroups.map((group) => [group.id, group]),
              );
              const chunks: {
                group: SettingsGroup<TSettings>;
                section: SettingsSection<TSettings>;
                orderKey: string;
              }[] = [];
              for (const id of orderedSectionIds) {
                const group = groupById.get(id);
                if (!group) continue;
                const sectionByKey = new Map(
                  group.sections.map((item) => [copyKey(item.title), item]),
                );
                for (const orderKey of mergeSectionOrder(
                  group.sections.map((item) => copyKey(item.title)),
                  subsectionOrder[group.id],
                )) {
                  const section = sectionByKey.get(orderKey);
                  if (section) chunks.push({ group, section, orderKey });
                }
              }
              const untitled = chunks.filter((item) => item.section.untitled);
              const titled = chunks.filter((item) => !item.section.untitled);
              const extras: ("plot" | "easing")[] = [
                ...(renderPlotSection ? (["plot"] as const) : []),
                ...(renderEasingEditor ? (["easing"] as const) : []),
              ];
              const titledMode = titled.length > 1 ? "subsection" : "plain";
              const extrasAsSub =
                extras.length > 0 &&
                titled.length + untitled.length + extras.length > 1;
              const hasSubs = titledMode === "subsection" || extrasAsSub;
              const placeTitle = `${tx(selectedPlace.label, locale)} · ${tx(
                PANEL_COPY.parameters(
                  placeParamCount(selectedPlace, groups),
                ),
                locale,
              )}`;
              const body = (
                <div
                  className={cn(
                    "flex flex-col",
                    hasSubs ? "gap-4" : "gap-2",
                  )}
                >
                  {untitled.map((item) =>
                    renderGroupSectionItem(
                      item.group,
                      item.section,
                      item.orderKey,
                      "plain",
                    ),
                  )}
                  {titled.map((item) =>
                    renderGroupSectionItem(
                      item.group,
                      item.section,
                      item.orderKey,
                      titledMode,
                    ),
                  )}
                  {untitled.length + titled.length + extras.length === 0 ? (
                    <p
                      className="px-2 text-[13px] leading-[18px]"
                      style={{ color: MUTED }}
                    >
                      {tx(PANEL_COPY.placeEmpty, locale)}
                    </p>
                  ) : null}
                  {extras.map((kind) => {
                    const title =
                      kind === "plot"
                        ? curveTitle
                        : showPlotSection
                          ? easingTitle
                          : curveTitle;
                    const node =
                      kind === "plot" ? curveSection : easingEditorBody;
                    if (extrasAsSub) {
                      return renderPlaceSub(title, kind, node);
                    }
                    return <Fragment key={kind}>{node}</Fragment>;
                  })}
                </div>
              );
              return shell(
                <SectionBlock
                  icon="mouse-pointer-click"
                  title={placeTitle}
                  open={openSections.has(PLACE_SECTION_ID)}
                  onToggle={() => toggleSection(PLACE_SECTION_ID)}
                  reduceMotion={reduceMotion}
                  locale={locale}
                  leading={
                    <PlaceClearButton
                      locale={locale}
                      onClear={() => applyPlace(null)}
                    />
                  }
                >
                  {body}
                </SectionBlock>
              );
            }
            if (sectionId === "bezier" && renderPlotSection) {

              return shell(
          <SectionBlock
            {...sectionIconProps("bezier", curveSectionIcon, curveDot)}
            title={curveTitle}
            open={openSections.has("bezier")}
            onToggle={() => toggleSection("bezier")}
            reduceMotion={reduceMotion}
            locale={locale}
            {...sectionReorderProps("bezier")}
          >
            {curveSection}
          </SectionBlock>
              );
            }
            if (sectionId === easingSectionId && renderEasingEditor) {
              return shell(
          <SectionBlock
            {...sectionIconProps(easingSectionId, "spline", easingDot)}
            title={showPlotSection ? easingTitle : curveTitle}
            open={openSections.has(easingSectionId)}
            onToggle={() => toggleSection(easingSectionId)}
            reduceMotion={reduceMotion}
            locale={locale}
            {...sectionReorderProps(easingSectionId)}
          >
            {easingEditorBody}
          </SectionBlock>
              );
            }
            const group = filteredGroups.find((item) => item.id === sectionId);
            if (!group) return null;
            return shell(
            <SectionBlock
              {...sectionIconProps(group.id, group.icon)}
              title={tx(group.title, locale)}
              open={openSections.has(group.id)}
              onToggle={() => toggleSection(group.id)}
              reduceMotion={reduceMotion}
              locale={locale}
              {...sectionReorderProps(group.id)}
              visibilityOn={
                group.visibilityKey != null
                  ? Boolean(settings[group.visibilityKey])
                  : undefined
              }
              onVisibilityChange={
                group.visibilityKey != null
                  ? (next) =>
                      onSettingsChange({
                        [group.visibilityKey!]: next,
                      } as Partial<TSettings>)
                  : undefined
              }
              headerAction={group.headerAction}
            >
              <div
                className="flex flex-col gap-4"
                data-subsection-group={group.id}
              >
                {mergeSectionOrder(
                  group.sections.map((section) => copyKey(section.title)),
                  subsectionOrder[group.id],
                ).map((orderKey) => {
                  const section = group.sections.find(
                    (item) => copyKey(item.title) === orderKey,
                  );
                  if (!section) return null;
                  return renderGroupSectionItem(
                    group,
                    section,
                    orderKey,
                    "auto",
                  );
                })}
              </div>
            </SectionBlock>
            );
          };
          const visibleTop = (() => {
            const top = sectionRails.top.filter(sectionVisible);
            if (!selectedPlace) return top;
            const next: string[] = top.filter((id) => id === PANEL_SECTION_ID);
            const at = next.indexOf(PANEL_SECTION_ID);
            if (at >= 0) next.splice(at + 1, 0, PLACE_SECTION_ID);
            else next.unshift(PLACE_SECTION_ID);
            return next;
          })();
          const visibleMid = selectedPlace
            ? []
            : sectionRails.mid.filter(sectionVisible);
          return (
          <div
            className="flex min-h-0 w-full flex-1 flex-col overflow-hidden"
            data-section-list=""
          >
            <div className="shrink-0">
              {visibleTop.map((id, i) =>
                renderOrderedSection(id, i > 0),
              )}
            </div>
            <div className={cn("min-h-0 flex-1", panelScroll)}>
              {visibleMid.map((id, i) =>
                renderOrderedSection(
                  id,
                  i > 0 || visibleTop.length > 0,
                ),
              )}
            </div>
          </div>
          );
          })() : null}
          {panelOpen ? (
            <>
              <div
                data-panel-move=""
                className={cn(
                  "absolute z-[2] cursor-grab touch-none active:cursor-grabbing",
                  "left-2 right-2",
                  dockBottom ? "top-1.5" : "top-0",
                )}
                style={{ height: PANEL_MOVE_EDGE }}
              />
              <button
                type="button"
                data-panel-resize="x"
                aria-label={tx(PANEL_COPY.resizePanelWidth, locale)}
                className={cn(
                  "absolute z-[3] touch-none",
                  dockRight ? "left-0" : "right-0",
                  "top-2 bottom-2",
                )}
                style={{ width: PANEL_RESIZE_HIT }}
                onPointerDown={startPanelResize("x")}
              />
              <button
                type="button"
                data-panel-resize="y"
                aria-label={tx(PANEL_COPY.resizePanelHeight, locale)}
                className={cn(
                  "absolute z-[3] touch-none",
                  dockBottom ? "top-0" : "bottom-0",
                  "left-2 right-2",
                )}
                style={{ height: PANEL_RESIZE_HIT }}
                onPointerDown={startPanelResize("y")}
              />
              <button
                type="button"
                data-panel-resize={
                  dockRight === dockBottom ? "xy-nwse" : "xy-nesw"
                }
                aria-label={tx(PANEL_COPY.resizePanelCorner, locale)}
                className={cn(
                  "absolute z-[4] touch-none",
                  dockRight ? "left-0" : "right-0",
                  dockBottom ? "top-0" : "bottom-0",
                )}
                style={{
                  width: PANEL_RESIZE_HIT + 4,
                  height: PANEL_RESIZE_HIT + 4,
                }}
                onPointerDown={startPanelResize("xy")}
              />
            </>
          ) : null}

        </div>
      </div>
      <PlaceHoverLayer
        active={pickPlace}
        places={places}
        groups={groups}
        locale={locale}
        panelTheme={panelTheme}
        onPick={applyPlace}
        onCancel={() => setPickPlace(false)}
      />
    </div>
  );
}
