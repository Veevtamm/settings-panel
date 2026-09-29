"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { cn } from "../lib/utils";
import { SfSymbol, type SfSymbolName } from "../sf-symbol";
import { GLASS, ICON, MUTED, PANEL_MOVE_EDGE } from "./chrome";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";
import { panelPopClassName, panelPopStyle } from "./motion-ui";

export function ChromeViewSection({
  icon,
  title,
  locale,
  modified,
  onResetValue,
  children,
}: {
  icon?: SfSymbolName;
  title: string;
  locale: PanelLocale;
  modified?: boolean;
  onResetValue?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="flex w-full shrink-0 flex-col gap-4 p-2">
      <div className="flex h-5 items-center">
        <span className="inline-flex min-w-0 items-center gap-1">
          {icon ? (
            <SfSymbol
              name={icon}
              className="size-5 shrink-0"
              style={{ color: ICON }}
            />
          ) : null}
          {modified && onResetValue ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={`${title}: ${tx(PANEL_COPY.resetDefault, locale)}`}
              title={tx(PANEL_COPY.resetDefault, locale)}
              onClick={() => onResetValue()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
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
      </div>
      {children}
    </section>
  );
}

export function DockedChromeWindow({
  id,
  open,
  mounted,
  label,
  left,
  top,
  bottom,
  fromBottom,
  origin,
  skip,
  theme,
  width,
  maxHeight,
  float,
  moving,
  zIndex,
  locale,
  onPointerDown,
  children,
}: {
  id: string;
  open: boolean;
  mounted: boolean;
  label: string;
  left: number;
  top: number | "auto";
  bottom: number | "auto";
  fromBottom: boolean;
  origin: string;
  skip: boolean;
  theme: "dark" | "light";
  width: number;
  maxHeight: number;
  float?: { x: number; y: number };
  moving?: boolean;
  zIndex?: number;
  locale: PanelLocale;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  const floated = float != null;
  return (
    <div
      id={id}
      data-settings-panel=""
      data-settings-panel-window=""
      data-panel-theme={theme}
      role="region"
      aria-label={label}
      aria-roledescription={tx(PANEL_COPY.movePanel, locale)}
      aria-hidden={!open}
      inert={open ? undefined : true}
      onPointerDown={onPointerDown}
      className={cn(
        "flex min-h-0 flex-col gap-0 overflow-hidden rounded-lg border border-[color:var(--sp-line)] font-sans text-left backdrop-blur-[8px]",
        "fixed",
        floated ? "origin-center" : origin,
        panelPopClassName({ open, fromBottom, skip: skip || Boolean(moving) }),
        moving && "cursor-grabbing select-none",
      )}
      style={{
        background: GLASS,
        zIndex: zIndex ?? 100,
        width,
        maxHeight,
        height: "auto",
        left: floated ? float.x : left,
        top: floated ? float.y : top,
        right: "auto",
        bottom: floated ? "auto" : bottom,
        margin: 0,
        ...panelPopStyle({ open, skip: skip || Boolean(moving) }),
      }}
    >
      {mounted ? children : null}
      <div
        aria-hidden
        data-panel-move=""
        className={cn(
          "absolute z-[2] cursor-grab touch-none select-none active:cursor-grabbing",
          "left-2 right-2",
          fromBottom && !floated ? "top-1.5" : "top-0",
        )}
        style={{ height: PANEL_MOVE_EDGE }}
      />
    </div>
  );
}
