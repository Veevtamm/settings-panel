"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { normalizeHex, parseRgb } from "../lib/hex";
import { usePrefersReducedMotion } from "../lib/prefers-reduced-motion";
import { clampNumber, cn } from "../lib/utils";
import { SfSymbol } from "../sf-symbol";
import {
  EASE_OUT,
  FIELD,
  GLASS,
  MUTED,
  PANEL_ENTER_MS,
  PANEL_EXIT_MS,
  SCRUB_DRAG_H,
  SCRUB_DRAG_W,
  SCRUB_PAD_X,
  fieldValueMono,
  pickEase,
} from "./chrome";
import type { ResetDotProps } from "./types";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";
import { FieldButton, NumberInput, StepperZones } from "./fields";
import { SettingRow } from "./row";

export type Hsv = { h: number; s: number; v: number };

export function hexToHsv(hex: string): Hsv {
  const rgb = parseRgb(hex);
  const r = (rgb?.r ?? 0) / 255;
  const g = (rgb?.g ?? 0) / 255;
  const b = (rgb?.b ?? 0) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const channels = (
    [
      [v, t, p],
      [q, v, p],
      [p, v, t],
      [p, q, v],
      [t, p, v],
      [v, p, q],
    ] as const
  )[i % 6] ?? [v, t, p];
  const [r, g, b] = channels;
  const toByte = (c: number) =>
    Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`.toUpperCase();
}

export function hueHex(h: number): string {
  return hsvToHex({ h, s: 1, v: 1 });
}

export const PICKER_SV = 200;
export const PICKER_GAP = 6;
/** Flyout `p-2` + 1px border — so the SV square lines up with the swatch. */
export const PICKER_PAD = 8;
export const HUE_RAINBOW =
  "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)";

export function ColorPickerFlyout({
  hex,
  hsv,
  label,
  left,
  onDragEnd,
  onHexCommit,
  onHsvChange,
  onPickEnd,
  onPickStart,
  open,
  reduceMotion,
  originX,
  originY,
  side,
  top,
  popoverRef,
}: {
  hex: string;
  hsv: Hsv;
  label: string;
  left: number;
  onDragEnd: () => void;
  onHexCommit: (next: string) => void;
  onHsvChange: (next: Hsv) => void;
  onPickEnd: () => void;
  onPickStart: () => void;
  open: boolean;
  originX: number;
  originY: number;
  reduceMotion: boolean;
  side: "below" | "above";
  top: number;
  popoverRef: RefObject<HTMLDivElement | null>;
}) {
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingSv = useRef(false);
  const draggingHue = useRef(false);
  const [canDropper, setCanDropper] = useState(false);

  useEffect(() => {
    setCanDropper("EyeDropper" in window);
  }, []);

  function hsvFromSvClient(clientX: number, clientY: number): Hsv {
    const el = svRef.current;
    if (!el) return hsv;
    const rect = el.getBoundingClientRect();
    const s =
      rect.width <= 0
        ? hsv.s
        : Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const v =
      rect.height <= 0
        ? hsv.v
        : Math.min(1, Math.max(0, 1 - (clientY - rect.top) / rect.height));
    return { h: hsv.h, s, v };
  }

  function hsvFromHueClient(clientX: number): Hsv {
    const el = hueRef.current;
    if (!el) return hsv;
    const rect = el.getBoundingClientRect();
    const endInset = SCRUB_PAD_X + SCRUB_DRAG_W / 2;
    const travel = Math.max(rect.width - endInset * 2, 0);
    const t =
      travel <= 0
        ? 0
        : Math.min(1, Math.max(0, (clientX - rect.left - endInset) / travel));
    return { h: t, s: hsv.s, v: hsv.v };
  }

  function onSvPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    draggingSv.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    onHsvChange(hsvFromSvClient(event.clientX, event.clientY));
  }

  function onHuePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    draggingHue.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    onHsvChange(hsvFromHueClient(event.clientX));
  }

  const hueLeft = `calc(${SCRUB_PAD_X + SCRUB_DRAG_W / 2}px + ${hsv.h} * (100% - ${
    (SCRUB_PAD_X + SCRUB_DRAG_W / 2) * 2
  }px))`;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`${label} color`}
      className={cn(
        "fixed z-[110] flex flex-col gap-2 rounded-lg border border-[color:var(--sp-line)] p-2 backdrop-blur-[8px]",
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
        transformOrigin: `${originX}px ${originY}px`,
        background: GLASS,
        width: PICKER_SV + 16,
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
        className="group/sv relative isolate rounded"
        style={{ height: PICKER_SV, background: FIELD }}
      >
        <div
          ref={svRef}
          role="slider"
          aria-label={`${label} saturation and brightness`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(hsv.v * 100)}
          aria-valuetext={hex}
          tabIndex={0}
          onPointerDown={onSvPointerDown}
          onPointerMove={(event) => {
            if (!draggingSv.current) return;
            // Stale drag guard: if the button is no longer held (missed
            // pointerup), stop following the cursor.
            if (event.pointerType === "mouse" && event.buttons === 0) {
              draggingSv.current = false;
              onDragEnd();
              return;
            }
            onHsvChange(hsvFromSvClient(event.clientX, event.clientY));
          }}
          onLostPointerCapture={() => {
            if (!draggingSv.current) return;
            draggingSv.current = false;
            onDragEnd();
          }}
          onPointerUp={(event) => {
            draggingSv.current = false;
            onDragEnd();
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onPointerCancel={(event) => {
            draggingSv.current = false;
            onDragEnd();
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          className="absolute inset-px cursor-crosshair overflow-hidden rounded-[3px] outline-none"
          style={{
            backgroundColor: hueHex(hsv.h),
            backgroundImage: `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, ${hueHex(hsv.h)})`,
            touchAction: "none",
          }}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded",
            "shadow-[inset_0_0_0_1px_var(--sp-line-mid)]",
            "transition-[box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
            "fine-hover:group-hover/sv:shadow-[inset_0_0_0_1px_var(--sp-line-strong)]",
          )}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
          style={{
            left: `calc(1px + ${hsv.s} * (100% - 2px))`,
            top: `calc(1px + ${1 - hsv.v} * (100% - 2px))`,
            background: hex,
          }}
        />
      </div>

      <div className="flex items-center gap-1">
      <div
        ref={hueRef}
        role="slider"
        aria-label={`${label} hue`}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h * 360)}
        tabIndex={0}
        onKeyDown={(event) => {
          const step = 1 / 360;
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            onHsvChange({ ...hsv, h: Math.max(0, hsv.h - step) });
          } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            onHsvChange({ ...hsv, h: Math.min(1, hsv.h + step) });
          }
        }}
        onPointerDown={onHuePointerDown}
        onPointerMove={(event) => {
          if (!draggingHue.current) return;
          if (event.pointerType === "mouse" && event.buttons === 0) {
            draggingHue.current = false;
            onDragEnd();
            return;
          }
          onHsvChange(hsvFromHueClient(event.clientX));
        }}
        onLostPointerCapture={() => {
          if (!draggingHue.current) return;
          draggingHue.current = false;
          onDragEnd();
        }}
        onPointerUp={(event) => {
          draggingHue.current = false;
          onDragEnd();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={(event) => {
          draggingHue.current = false;
          onDragEnd();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        className="group/hue-track relative h-[28px] min-w-0 flex-1 cursor-ew-resize rounded outline-none"
        style={{ touchAction: "none" }}
      >
        <div
          aria-hidden
          className="absolute inset-0 overflow-hidden rounded"
          style={{ background: HUE_RAINBOW }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-[color:var(--sp-knob-off)] shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          style={{
            left: hueLeft,
            width: SCRUB_DRAG_W,
            height: SCRUB_DRAG_H,
          }}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded border border-[color:var(--sp-line-mid)]",
            "transition-[border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
            "fine-hover:group-hover/hue-track:border-[color:var(--sp-line-strong)]",
            "group-focus-visible/hue-track:border-[color:var(--sp-line-focus)]",
          )}
        />
      </div>
        {canDropper ? (
          <FieldButton
            label={`${label} eyedropper`}
            onClick={() => {
              const Ctor = (
                window as Window & {
                  EyeDropper?: new () => {
                    open: () => Promise<{ sRGBHex: string }>;
                  };
                }
              ).EyeDropper;
              if (!Ctor) return;
              onPickStart();
              void new Ctor()
                .open()
                .then((result) => {
                  onHexCommit(result.sRGBHex);
                })
                .catch(() => {
                  /* cancelled */
                })
                .finally(onPickEnd);
            }}
          >
            <SfSymbol name="pipette" className="size-5" />
          </FieldButton>
        ) : null}
      </div>
    </div>
  );
}

export function SettingColor({
  label,
  onChange,
  value,
  opacity,
  onOpacityChange,
  locale = "ru",
  modified,
  onResetValue,
  info,
  icon,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
  opacity?: number;
  onOpacityChange?: (value: number) => void;
  locale?: PanelLocale;
} & ResetDotProps) {
  const hex = normalizeHex(value, "#000000");
  const [draft, setDraft] = useState(hex);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hsv, setHsv] = useState(() => hexToHsv(hex));
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    side: "below" | "above";
    originX: number;
    originY: number;
  }>({ left: 0, top: 0, side: "above", originX: 14, originY: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const swatchRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const pickingRef = useRef(false);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    setDraft(hex);
    if (draggingRef.current) return;
    setHsv((prev) => (hsvToHex(prev) === hex ? prev : hexToHsv(hex)));
  }, [hex]);

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
      const swatch = swatchRef.current;
      if (!swatch) return;
      const rect = swatch.getBoundingClientRect();
      const width = PICKER_SV + PICKER_PAD * 2 + 2;
      const height = PICKER_SV + 8 + 28 + PICKER_PAD * 2 + 2;
      const spaceAbove = rect.top - 8;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const side: "below" | "above" =
        spaceAbove >= height || spaceAbove >= spaceBelow ? "above" : "below";
      const top =
        side === "below"
          ? rect.bottom + PICKER_GAP
          : rect.top - height - PICKER_GAP;
      let left = rect.left - PICKER_PAD - 1;
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
      if (pickingRef.current) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (pickingRef.current) return;
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function commitDraft(next: string) {
    const normalized = normalizeHex(next, hex);
    setDraft(normalized);
    if (normalized !== hex) onChange(normalized);
  }

  function commitHsv(next: Hsv) {
    draggingRef.current = true;
    setHsv(next);
    const nextHex = hsvToHex(next);
    setDraft(nextHex);
    if (nextHex !== hex) onChange(nextHex);
  }

  function endDrag() {
    draggingRef.current = false;
  }

  const host =
    typeof document !== "undefined"
      ? (swatchRef.current?.closest("[data-settings-panel]") ?? document.body)
      : null;

  return (
    <div ref={rootRef}>
      <SettingRow
      label={label}
      modified={modified}
      onResetValue={onResetValue}
      info={info}
      icon={icon}
    >
        <div
          className={cn(
            "group/swatch relative grid h-[28px] shrink-0",
            opacity !== undefined && onOpacityChange
              ? "w-[188px] grid-cols-[28px_1px_102px_1px_56px]"
              : "w-[131px] grid-cols-[28px_1px_minmax(0,1fr)]",
            "overflow-hidden rounded bg-[color:var(--sp-field)]",
          )}
        >
          {/* Border above children — the opaque swatch must not cover it (Figma: control stroke only, swatch has none) */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 rounded border border-[color:var(--sp-line-mid)]",
              "transition-[border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
              "fine-hover:group-hover/swatch:border-[color:var(--sp-line-strong)]",
              "group-focus-within/swatch:border-[color:var(--sp-line-focus)]",
            )}
          />
          <button
            ref={swatchRef}
            type="button"
            aria-label={`${label} swatch`}
            aria-expanded={open}
            aria-haspopup="dialog"
            className="size-[28px] shrink-0 rounded-l outline-none"
            style={{ background: hex }}
            onClick={() => setOpen((prev) => !prev)}
          />
          <div aria-hidden className="bg-[color:var(--sp-fill-strong)]" />
          <label
            className="flex h-[28px] min-w-0 items-center justify-between gap-1 px-1.5 text-[14px] leading-[18px]"
            style={{ color: MUTED }}
          >
            <input
              aria-label={`${label} hex`}
              value={draft}
              spellCheck={false}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => commitDraft(draft)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              className={cn(
                "min-w-0 flex-1 bg-transparent text-left outline-none",
                fieldValueMono,
              )}
            />
            <span className="shrink-0 font-sans opacity-50" aria-hidden>
              HEX
            </span>
          </label>
        {opacity !== undefined && onOpacityChange ? (
          <>
            <div aria-hidden className="bg-[color:var(--sp-fill-strong)]" />
            <label
              className="group/field relative flex h-[28px] w-[56px] min-w-0 items-center justify-between gap-0.5 px-1 text-[14px] leading-[18px]"
              style={{ color: MUTED }}
            >
              <NumberInput
                ariaLabel={`${label} ${tx(PANEL_COPY.opacity, locale)} (%)`}
                max={100}
                min={0}
                onCommit={(next) => onOpacityChange(clampNumber(next, 0, 100))}
                step={1}
                value={opacity}
              />
              <span className="pointer-events-none shrink-0 font-sans opacity-50" aria-hidden>
                %
              </span>
              <StepperZones
                label={`${label} ${tx(PANEL_COPY.opacity, locale)}`}
                min={0}
                max={100}
                step={1}
                value={opacity}
                onCommit={(next) => onOpacityChange(clampNumber(next, 0, 100))}
              />
            </label>
          </>
        ) : null}
        </div>
      </SettingRow>
      {host && mounted
        ? createPortal(
            <ColorPickerFlyout
              hex={hex}
              hsv={hsv}
              label={label}
              left={pos.left}
              onDragEnd={endDrag}
              onHexCommit={commitDraft}
              onHsvChange={commitHsv}
              onPickEnd={() => {
                pickingRef.current = false;
              }}
              onPickStart={() => {
                pickingRef.current = true;
              }}
              open={open}
              originX={pos.originX}
              originY={pos.originY}
              reduceMotion={reduceMotion}
              side={pos.side}
              top={pos.top}
              popoverRef={popoverRef}
            />,
            host,
          )
        : null}
    </div>
  );
}
