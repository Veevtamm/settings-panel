"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SfSymbol } from "../sf-symbol";
import { cn } from "../lib/utils";
import {
  EASE_OUT,
  FIELD,
  CHEVRON_MS,
  fieldValueSans,
} from "./chrome";
import { SectionCollapse } from "./row";

/** Figma bordered select — selected row + open options */
export function PanelSelectList({
  value,
  options,
  ariaLabel,
  onChange,
  reduceMotion,
  className,
  optionIcon,
  width,
}: {
  value: string;
  options: readonly { id: string; label: string }[];
  ariaLabel: string;
  onChange: (id: string) => void;
  reduceMotion: boolean;
  className?: string;
  /** Icon before the label — in the trigger and in every option row. */
  optionIcon?: (id: string) => ReactNode;
  /** Fixed trigger width (px). Omit = size from className (Preset fills leftover). */
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [fadeTop, setFadeTop] = useState(false);
  const [fadeBottom, setFadeBottom] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const selectedLabel =
    options.find((option) => option.id === value)?.label ?? value;

  const updateFades = () => {
    const el = listRef.current;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    setFadeTop(scrollTop > 1);
    setFadeBottom(scrollTop + clientHeight < scrollHeight - 1);
  };

  useEffect(() => {
    if (!open) return;

    const onPointerMove = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const pad = 8;
      const away =
        event.clientX < rect.left - pad ||
        event.clientX > rect.right + pad ||
        event.clientY < rect.top - pad ||
        event.clientY > rect.bottom + pad;
      if (away) setOpen(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setFadeTop(false);
      setFadeBottom(false);
      return;
    }

    const el = listRef.current;
    if (!el) return;

    updateFades();
    el.addEventListener("scroll", updateFades, { passive: true });
    const ro = new ResizeObserver(updateFades);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateFades);
      ro.disconnect();
    };
  }, [open, options, value]);

  const fadeMask =
    fadeTop && fadeBottom
      ? "linear-gradient(to bottom, transparent, black 1.25rem, black calc(100% - 1.25rem), transparent)"
      : fadeTop
        ? "linear-gradient(to bottom, transparent, black 1.25rem, black 100%)"
        : fadeBottom
          ? "linear-gradient(to bottom, black 0%, black calc(100% - 1.25rem), transparent)"
          : undefined;

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative flex w-full flex-col rounded after:pointer-events-none after:absolute after:inset-0 after:z-10 after:rounded after:border after:border-[color:var(--sp-line-mid)] after:transition-[border-color] after:duration-150 after:ease-[cubic-bezier(0.23,1,0.32,1)] fine-hover:hover:after:border-[color:var(--sp-line-strong)] focus-within:after:border-[color:var(--sp-line-focus)]",
        className,
      )}
      style={{
        background: FIELD,
        ...(width != null ? { width } : {}),
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
        className="group/preset-trigger flex h-[28px] w-full items-center justify-between gap-2 px-1.5 text-left outline-none"
      >
        <span className="flex min-w-0 items-center gap-2 text-[color:var(--sp-muted)] transition-colors duration-150 fine-hover:group-hover/preset-trigger:text-[color:var(--sp-fg)]">
          {optionIcon?.(value)}
          <span className={cn("truncate", fieldValueSans)}>
            {selectedLabel}
          </span>
        </span>
        <SfSymbol
          name="chevron-up"
          className={cn(
            "size-5 shrink-0 text-[color:var(--sp-muted)] transition-[color,transform] duration-150 fine-hover:group-hover/preset-trigger:text-[color:var(--sp-fg)]",
            !reduceMotion && "ease-[cubic-bezier(0.23,1,0.32,1)]",
            !open && "rotate-180",
          )}
          style={
            reduceMotion
              ? undefined
              : {
                  transitionDuration: `${CHEVRON_MS}ms`,
                  transitionTimingFunction: EASE_OUT,
                }
          }
        />
      </button>

      <SectionCollapse open={open} reduceMotion={reduceMotion}>
        <ul
          ref={listRef}
          className="flex max-h-48 flex-col gap-2 overflow-y-auto px-1.5 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="listbox"
          aria-label={ariaLabel}
          style={
            fadeMask
              ? {
                  maskImage: fadeMask,
                  WebkitMaskImage: fadeMask,
                }
              : undefined
          }
        >
          {options
            .filter((option) => option.id !== value)
            .map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 text-left outline-none",
                    fieldValueSans,
                    "text-[color:var(--sp-muted)] transition-colors duration-150 fine-hover:hover:text-[color:var(--sp-fg)] focus-visible:text-[color:var(--sp-fg)]",
                  )}
                >
                  {optionIcon?.(option.id)}
                  <span className="truncate">{option.label}</span>
                </button>
              </li>
            ))}
        </ul>
      </SectionCollapse>
    </div>
  );
}
