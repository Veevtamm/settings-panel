"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { usePrefersReducedMotion } from "../lib/prefers-reduced-motion";
import { cn } from "../lib/utils";
import {
  SfSymbol,
  SF_SYMBOL_NAMES,
  resolvePanelIcon,
  type SfSymbolName,
} from "../sf-symbol";
import {
  EASE_OUT,
  GLASS,
  ICON,
  MUTED,
  PANEL_ENTER_MS,
  PANEL_EXIT_MS,
  pickActive,
  pickEase,
  pickIdle,
} from "./chrome";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";

const FLYOUT_GAP = 6;

const ICON_COLS = 7;
const ICON_CELL = 28;
const ICON_GRID_MAX_ROWS = 8;
const ICON_PAD = 8;

function pickerWidth() {
  return ICON_COLS * ICON_CELL + ICON_PAD * 2 + 2;
}

function pickerHeight() {
  const rows = Math.ceil(SF_SYMBOL_NAMES.length / ICON_COLS);
  const gridH = Math.min(rows, ICON_GRID_MAX_ROWS) * ICON_CELL;
  return gridH + ICON_PAD * 2 + 2;
}

function IconPickerFlyout({
  label,
  left,
  onPick,
  open,
  originX,
  originY,
  reduceMotion,
  side,
  top,
  value,
  popoverRef,
  theme,
}: {
  label: string;
  left: number;
  onPick: (name: SfSymbolName) => void;
  open: boolean;
  originX: number;
  originY: number;
  reduceMotion: boolean;
  side: "below" | "above";
  top: number;
  value?: SfSymbolName;
  popoverRef: RefObject<HTMLDivElement | null>;
  theme: "dark" | "light";
}) {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const selected = gridRef.current?.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );
    selected?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const root = popoverRef.current;
    if (!root) return;

    const onWheel = (event: WheelEvent) => {
      event.stopPropagation();
      const grid = gridRef.current;
      if (!grid) {
        event.preventDefault();
        return;
      }
      const overGrid =
        event.target instanceof Node && grid.contains(event.target);
      const dy = event.deltaY;
      const atTop = grid.scrollTop <= 0;
      const atBottom =
        grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 1;
      if (!overGrid || (dy < 0 && atTop) || (dy > 0 && atBottom)) {
        event.preventDefault();
      }
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [open, popoverRef]);

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={label}
      data-settings-panel=""
      data-panel-theme={theme}
      className={cn(
        "fixed z-[110] overflow-hidden overscroll-contain rounded-lg border border-[color:var(--sp-line)] p-2 backdrop-blur-[8px]",
        reduceMotion
          ? open
            ? "opacity-100"
            : "pointer-events-none opacity-0"
          : cn(
              "transition-[opacity,transform] will-change-[opacity,transform]",
              open
                ? "translate-y-0 scale-100 opacity-100"
                : cn(
                    "pointer-events-none scale-[0.98] opacity-0",
                    side === "below" ? "-translate-y-1.5" : "translate-y-1.5",
                  ),
            ),
      )}
      style={{
        left,
        top,
        width: pickerWidth(),
        transformOrigin: `${originX}px ${originY}px`,
        background: GLASS,
        ...(reduceMotion
          ? {}
          : {
              transitionDuration: open
                ? `${PANEL_ENTER_MS}ms`
                : `${PANEL_EXIT_MS}ms`,
              transitionTimingFunction: EASE_OUT,
            }),
      }}
      inert={open ? undefined : true}
    >
      <div
        ref={gridRef}
        role="listbox"
        aria-label={label}
        className="grid overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          gridTemplateColumns: `repeat(${ICON_COLS}, ${ICON_CELL}px)`,
          maxHeight: ICON_GRID_MAX_ROWS * ICON_CELL,
        }}
      >
        {SF_SYMBOL_NAMES.map((name) => {
          const selected =
            value != null &&
            resolvePanelIcon(name) === resolvePanelIcon(value);
          return (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={name}
              title={name}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onPick(name)}
              className={cn(
                "inline-flex size-[28px] cursor-pointer items-center justify-center outline-none",
                pickEase,
                selected ? pickActive : pickIdle,
              )}
            >
              <SfSymbol
                name={name}
                className="size-5"
                style={{ color: ICON }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SectionIconPicker({
  label,
  locale,
  onChange,
  value,
}: {
  label: string;
  locale: PanelLocale;
  onChange: (name: SfSymbolName) => void;
  value?: SfSymbolName;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    side: "below" | "above";
    originX: number;
    originY: number;
  }>({ left: 0, top: 0, side: "above", originX: 10, originY: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (reduceMotion) {
      setMounted(false);
      return;
    }
    const id = window.setTimeout(() => setMounted(false), PANEL_EXIT_MS);
    return () => window.clearTimeout(id);
  }, [open, reduceMotion]);

  useEffect(() => {
    if (!open) return;

    function place() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = pickerWidth();
      const height = pickerHeight();
      const spaceAbove = rect.top - 8;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const side: "below" | "above" =
        spaceAbove >= height || spaceAbove >= spaceBelow ? "above" : "below";
      const top =
        side === "below"
          ? rect.bottom + FLYOUT_GAP
          : rect.top - height - FLYOUT_GAP;
      let left = rect.left - ICON_PAD - 1;
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - width - 8);
      }
      if (left < 8) left = 8;
      setPos({
        left,
        top,
        side,
        originX: rect.left + rect.width / 2 - left,
        originY: rect.top + rect.height / 2 - top,
      });
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const host = typeof document !== "undefined" ? document.body : null;
  const themeAttr = triggerRef.current
    ?.closest("[data-panel-theme]")
    ?.getAttribute("data-panel-theme");
  const theme = themeAttr === "light" ? "light" : "dark";
  const dialogLabel = `${label}: ${tx(PANEL_COPY.sectionIcon, locale)}`;

  return (
    <div ref={rootRef} className="inline-flex size-5 shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={dialogLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center outline-none"
      >
        <SfSymbol
          name={value ?? "plus"}
          className="size-5"
          style={{ color: value ? ICON : MUTED }}
        />
      </button>
      {host && mounted
        ? createPortal(
            <IconPickerFlyout
              label={dialogLabel}
              left={pos.left}
              onPick={(name) => {
                onChange(name);
                setOpen(false);
              }}
              open={open}
              originX={pos.originX}
              originY={pos.originY}
              popoverRef={popoverRef}
              reduceMotion={reduceMotion}
              side={pos.side}
              theme={theme}
              top={pos.top}
              value={value}
            />,
            host,
          )
        : null}
    </div>
  );
}
