"use client";

import {
  useLayoutEffect,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";
import { SfSymbol, type SfSymbolName } from "../sf-symbol";
import { CHEVRON_MS, EASE_OUT, ICON, MUTED } from "./chrome";
import { SectionIconPicker } from "./icon-picker";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";
import { applyLiftTransform, type LiftSize, type LiftXy } from "./model";
import { SectionCollapse } from "./row";

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
  reorderable,
  onGripPointerDown,
  dragging,
  pinned,
  onPinClick,
  locale = "ru",
  onIconChange,
}: {
  icon?: SfSymbolName;
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
        <span className="inline-flex min-w-0 flex-1 items-center gap-1">
          {!onIconChange ? null : (
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
            {onIconChange || !icon ? null : (
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
      className="h-px shrink-0 bg-[color:var(--sp-section-line)]"
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
            icon || onIconChange ? "gap-1" : "gap-0",
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
                ? "w-5 mr-2 scale-100 opacity-100"
                : "w-5 mr-2 scale-100 opacity-100 fine-hover:mr-0 fine-hover:w-0 fine-hover:scale-95 fine-hover:opacity-0 fine-hover:group-hover/sub:mr-2 fine-hover:group-hover/sub:w-5 fine-hover:group-hover/sub:scale-100 fine-hover:group-hover/sub:opacity-100",
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
