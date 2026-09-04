"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SfSymbol, type SfSymbolName } from "../sf-symbol";
import { cn } from "../lib/utils";
import { usePrefersReducedMotion } from "../lib/prefers-reduced-motion";
import {
  EASE_OUT,
  HINT_DELAY_MS,
  HINT_POP_MS,
  HINT_SESSION_MS,
  ICON,
  MUTED,
  SECTION_MS,
  rowLabelClass,
} from "./chrome";
import type { ResetDotProps } from "./types";

let hintSessionUntil = 0;

export function useDeferredMount(
  open: boolean,
  reduceMotion: boolean,
  exitMs: number,
) {
  const [mounted, setMounted] = useState(open);

  useLayoutEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (open) return;
    if (reduceMotion) {
      setMounted(false);
      return;
    }
    const id = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(id);
  }, [exitMs, open, reduceMotion]);

  return mounted;
}

export function SectionCollapse({
  open,
  reduceMotion,
  children,
}: {
  open: boolean;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  const mounted = useDeferredMount(open, reduceMotion, SECTION_MS);

  return (
    <div
      className={cn(
        "grid",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        !reduceMotion && "transition-[grid-template-rows]",
      )}
      style={
        reduceMotion
          ? undefined
          : {
              transitionDuration: `${SECTION_MS}ms`,
              transitionTimingFunction: EASE_OUT,
            }
      }
      inert={open ? undefined : true}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={cn(
            !reduceMotion && "transition-opacity",
            open ? "opacity-100" : "opacity-0",
          )}
          style={
            reduceMotion
              ? undefined
              : {
                  transitionDuration: open
                    ? `${SECTION_MS}ms`
                    : `${Math.round(SECTION_MS * 0.7)}ms`,
                  transitionTimingFunction: EASE_OUT,
                }
          }
        >
          {mounted ? children : null}
        </div>
      </div>
    </div>
  );
}

/** Hint after the label — SF `info.square` (Panel / Icon 􁊇); tooltip Figma `5242:391`. */
function hintBox(icon: HTMLElement) {
  let box: Element | null = icon.closest("[data-setting-row]");
  if (!box) {
    let walk: HTMLElement | null = icon;
    while (walk) {
      if (walk.getBoundingClientRect().width >= 200) {
        box = walk;
        break;
      }
      walk = walk.parentElement;
    }
  }
  const rect = (box ?? icon).getBoundingClientRect();
  const theme =
    icon.closest("[data-panel-theme]")?.getAttribute("data-panel-theme") ??
    "dark";
  const below = rect.top < 120;
  return {
    left: rect.left,
    width: rect.width,
    top: below ? rect.bottom + 5 : rect.top - 5,
    below,
    theme,
  };
}

export function InfoHint({ label, text }: { label: string; text: string }) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const delayRef = useRef(0);
  const [pos, setPos] = useState<ReturnType<typeof hintBox> | null>(null);
  const [instant, setInstant] = useState(false);
  const [pop, setPop] = useState(false);
  const reduceMotion = usePrefersReducedMotion();

  const reveal = (skipWait: boolean) => {
    const icon = iconRef.current;
    if (!icon) return;
    setInstant(skipWait);
    setPop(skipWait || reduceMotion);
    setPos(hintBox(icon));
  };

  const show = () => {
    window.clearTimeout(delayRef.current);
    const skipWait = Date.now() < hintSessionUntil;
    if (skipWait) {
      reveal(true);
      return;
    }
    delayRef.current = window.setTimeout(() => reveal(false), HINT_DELAY_MS);
  };

  const hide = () => {
    window.clearTimeout(delayRef.current);
    if (pos) hintSessionUntil = Date.now() + HINT_SESSION_MS;
    setPos(null);
    setPop(false);
  };

  useLayoutEffect(() => {
    if (!pos || instant || reduceMotion) return;
    const id = requestAnimationFrame(() => setPop(true));
    return () => cancelAnimationFrame(id);
  }, [instant, pos, reduceMotion]);

  useEffect(() => () => window.clearTimeout(delayRef.current), []);

  return (
    <span
      ref={iconRef}
      tabIndex={0}
      role="note"
      aria-label={`${label}: ${text}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="flex size-5 shrink-0 cursor-default items-center justify-center text-[color:var(--sp-muted)] outline-none transition-colors duration-150 fine-hover:hover:text-[color:var(--sp-fg)] focus-visible:text-[color:var(--sp-fg)]"
    >
      <SfSymbol name="info.square" className="block size-5" />
      {pos
        ? createPortal(
            <div
              role="tooltip"
              data-panel-theme={pos.theme}
              className={cn(
                "pointer-events-none fixed z-[120]",
                pos.below ? "translate-y-0" : "-translate-y-full",
              )}
              style={{
                left: pos.left,
                top: pos.top,
                width: pos.width,
              }}
            >
              <div
                className={cn(
                  "rounded-[6px] border border-[color:var(--sp-line)] bg-[color:var(--sp-tooltip)] p-[6px] font-sans text-[12px] leading-normal text-[color:var(--sp-fg)]",
                  !instant &&
                    !reduceMotion &&
                    "transition-[opacity,transform]",
                  pop
                    ? "scale-100 opacity-100"
                    : "scale-[0.97] opacity-0",
                )}
                style={
                  instant || reduceMotion
                    ? undefined
                    : {
                        transitionDuration: `${HINT_POP_MS}ms`,
                        transitionTimingFunction: EASE_OUT,
                      }
                }
              >
                {text}
              </div>
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

export function RowLabel({
  label,
  className,
  modified,
  onResetValue,
  info,
  icon,
}: {
  label: string;
  className?: string;
} & ResetDotProps) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      {icon ? (
        <SfSymbol
          name={icon}
          className="size-5 shrink-0"
          style={{ color: ICON }}
        />
      ) : null}
      {modified && onResetValue ? (
        <button
          type="button"
          aria-label={`${label}: вернуть дефолт`}
          title="Вернуть дефолт"
          onClick={onResetValue}
          className="group/reset-dot -mx-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--sp-line-focus)]"
        >
          <span
            aria-hidden
            className="size-[5px] rounded-full bg-[color:var(--sp-muted)] transition-colors duration-150 fine-hover:group-hover/reset-dot:bg-[color:var(--sp-fg)]"
          />
        </button>
      ) : null}
      <span className={rowLabelClass}>{label}</span>
      {info ? <InfoHint label={label} text={info} /> : null}
    </span>
  );
}

export function SettingRow({
  label,
  children,
  modified,
  onResetValue,
  info,
  icon,
}: {
  label: string;
  children: ReactNode;
} & ResetDotProps) {
  return (
    <div
      className="group flex h-[28px] items-center justify-between gap-4"
      data-setting-row=""
    >
      <RowLabel
        label={label}
        modified={modified}
        onResetValue={onResetValue}
        info={info}
        icon={icon}
      />
      {children}
    </div>
  );
}