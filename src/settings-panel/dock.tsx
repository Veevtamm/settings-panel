"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "../lib/prefers-reduced-motion";
import { cn } from "../lib/utils";
import { SfSymbol } from "../sf-symbol";
import {
  EASE_OUT,
  FIELD,
  GLASS,
  ICON,
  PANEL_ENTER_MS,
  PANEL_EXIT_MS,
  DOCK_SEARCH_W,
  SECTION_MS,
  dockBarButtonClass,
  fieldChrome,
  fieldValueSans,
} from "./chrome";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";

const BADGE =
  "absolute -top-1 -right-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-[3px] font-mono text-[9px] leading-none tabular-nums";

/**
 * Changed-count circle. With `onToggle` it is its own button (G1: only changed
 * rows) — place it as a sibling of the dock button inside `DockBadgeAnchor`.
 */
export function DockCountBadge({
  count,
  onToggle,
  pressed = false,
  label,
}: {
  count: number;
  onToggle?: () => void;
  pressed?: boolean;
  label?: string;
}) {
  if (count <= 0) return null;
  if (onToggle == null) {
    return (
      <span
        aria-hidden
        className={cn(
          BADGE,
          "pointer-events-none bg-[color:var(--sp-knob)] text-[color:var(--sp-field)]",
        )}
      >
        {count}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={cn(
        BADGE,
        "z-[1] cursor-pointer outline-none before:absolute before:-inset-1.5 before:content-['']",
        "focus-visible:ring-1 focus-visible:ring-[color:var(--sp-line-focus)]",
        pressed
          ? "bg-[color:var(--sp-fg)] text-[color:var(--sp-field)] ring-2 ring-[color:var(--sp-glass)]"
          : "bg-[color:var(--sp-knob)] text-[color:var(--sp-field)] fine-hover:hover:bg-[color:var(--sp-fg)]",
      )}
    >
      {count}
    </button>
  );
}

export function DockBadgeAnchor({ children }: { children: ReactNode }) {
  return <span className="relative inline-flex shrink-0">{children}</span>;
}

export function DockBarDivider() {
  return (
    <span
      aria-hidden
      className="mx-0.5 h-5 w-px shrink-0 bg-[color:var(--sp-section-line)]"
    />
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
      className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center outline-none"
    >
      <SfSymbol
        name={
          collapse
            ? "list-chevrons-down-up"
            : "list-chevrons-up-down"
        }
        className="size-5"
        style={{ color: ICON }}
      />
    </button>
  );
}

export function DockSearchField({
  open,
  query,
  filterLabel,
  locale,
  onOpen,
  onQuery,
  onClose,
}: {
  open: boolean;
  query: string;
  /** G1: fixed filter shown instead of the placeholder («Изменено · 3»). */
  filterLabel?: string;
  locale: PanelLocale;
  onOpen: () => void;
  onQuery: (value: string) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  const motion = reduceMotion
    ? undefined
    : {
        transitionDuration: `${SECTION_MS}ms`,
        transitionTimingFunction: EASE_OUT,
      };
  return (
    <div
      data-dock-search=""
      className="flex h-[34px] shrink-0 items-center"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-label={tx(
          open ? PANEL_COPY.closeSearch : PANEL_COPY.openSearch,
          locale,
        )}
        className={dockBarButtonClass(open)}
        onClick={() => (open ? onClose() : onOpen())}
      >
        <SfSymbol name="search" className="size-5" />
      </button>
      <div
        className={cn(
          "relative flex h-[34px] items-center overflow-hidden rounded",
          open && fieldChrome,
          !reduceMotion &&
            "transition-[width,margin-left,border-color,background-color]",
        )}
        style={{
          width: open ? DOCK_SEARCH_W : 0,
          marginLeft: open ? 4 : 0,
          background: open ? FIELD : "transparent",
          ...motion,
        }}
      >
        {open && !query ? (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-2.5 truncate",
              fieldValueSans,
            )}
            style={{ color: "var(--sp-fg)", opacity: filterLabel ? 1 : 0.4 }}
          >
            {filterLabel ?? tx(PANEL_COPY.searchPlaceholder, locale)}
          </span>
        ) : null}
        <input
          ref={inputRef}
          type="search"
          value={query}
          aria-hidden={!open}
          tabIndex={open ? 0 : -1}
          aria-label={tx(PANEL_COPY.searchField, locale)}
          autoComplete="off"
          className={cn(
            "h-full min-w-0 w-full bg-transparent pr-8 pl-2.5 text-[color:var(--sp-fg)] outline-none",
            "[&::-webkit-search-cancel-button]:hidden",
            fieldValueSans,
            !open && "pointer-events-none",
          )}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            if (query) onQuery("");
            else onClose();
          }}
        />
        <button
          type="button"
          aria-label={tx(PANEL_COPY.closeSearch, locale)}
          aria-hidden={!open}
          tabIndex={open ? 0 : -1}
          className={cn(
            "absolute right-0.5 inline-flex size-7 items-center justify-center rounded text-[color:var(--sp-muted)] fine-hover:hover:text-[color:var(--sp-fg)]",
            !open && "pointer-events-none",
          )}
          onClick={onClose}
        >
          <SfSymbol name="x" className="size-5" />
        </button>
      </div>
    </div>
  );
}

/** How long a dock caption stays before it fades (G3 undo, G5 link). */
export const DOCK_TOAST_MS = 1400;

/**
 * Glass caption under the Dock Bar (above it when the bar sits at the bottom).
 * Remount with a new `key` to show it again.
 */
export function DockToast({
  text,
  detail,
  hint,
  below,
  onDone,
}: {
  text: string;
  /** Mono values: `24 → 20`, `7 параметров`. */
  detail?: string;
  /** Dim trailing hint: `⇧⌘Z вернуть`. */
  hint?: string;
  below: boolean;
  onDone: () => void;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const [shown, setShown] = useState(false);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const hide = window.setTimeout(() => setShown(false), DOCK_TOAST_MS);
    const done = window.setTimeout(
      () => doneRef.current(),
      DOCK_TOAST_MS + PANEL_EXIT_MS,
    );
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(hide);
      window.clearTimeout(done);
    };
  }, []);
  const offset = below ? -6 : 6;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute left-1/2 z-20 flex h-8 items-center gap-3 whitespace-nowrap rounded-lg border border-[color:var(--sp-line)] px-3 backdrop-blur-[8px]",
        below ? "top-full mt-2" : "bottom-full mb-2",
      )}
      style={{
        background: GLASS,
        opacity: shown ? 1 : 0,
        transform: `translate(-50%, ${shown || reduceMotion ? 0 : offset}px)`,
        transitionProperty: reduceMotion ? "opacity" : "opacity, transform",
        transitionDuration: `${shown ? PANEL_ENTER_MS : PANEL_EXIT_MS}ms`,
        transitionTimingFunction: EASE_OUT,
      }}
    >
      <span className={cn(fieldValueSans, "text-[color:var(--sp-fg)]")}>
        {text}
      </span>
      {detail ? (
        <span className="font-mono text-[14px] leading-[18px] tabular-nums text-[color:var(--sp-fg)]">
          {detail}
        </span>
      ) : null}
      {hint ? (
        <span className="font-mono text-[14px] leading-[18px] text-[color:var(--sp-muted)]">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
