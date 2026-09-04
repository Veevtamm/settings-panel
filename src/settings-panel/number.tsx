"use client";

import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { clampNumber, cn } from "../lib/utils";
import { SfSymbol } from "../sf-symbol";
import {
  EASE_OUT,
  FIELD,
  MUTED,
  SECTION_MS,
  SCRUB_DRAG_H,
  SCRUB_DRAG_W,
  SCRUB_MAX_TICK_STOPS,
  SCRUB_NOTCH_H,
  SCRUB_PAD_X,
  SCRUB_SNAP_PX,
  SCRUB_TICK_H,
  SCRUB_TICK_PAD_X,
  SCRUB_TICK_W,
  pickEase,
  pickIdle,
  pickerChrome,
} from "./chrome";
import { copyKey } from "./locale";
import type { PairFieldIcon, PairSetting, ResetDotProps } from "./types";
import { FieldButton, NumberField, NumberInput } from "./fields";
import { RowLabel, SettingRow } from "./row";

export function scrubRatio(value: number, min: number, max: number) {
  const span = Math.max(max - min, 1e-9);
  return Math.min(1, Math.max(0, (value - min) / span));
}

export function scrubDragLeft(ratio: number) {
  const inset = SCRUB_PAD_X + SCRUB_DRAG_W / 2;
  return `calc(${inset}px + ${ratio} * (100% - ${inset * 2}px))`;
}

/** Figma Range Track: bar left edge travels padX … width − padX − barW. */
export function rangeBarLeft(ratio: number) {
  const travel = SCRUB_PAD_X * 2 + SCRUB_DRAG_W;
  return `calc(${SCRUB_PAD_X}px + ${ratio} * (100% - ${travel}px))`;
}

export function valueFromTrackX(
  clientX: number,
  track: HTMLDivElement,
  min: number,
  max: number,
  step: number,
) {
  const rect = track.getBoundingClientRect();
  if (rect.width <= 0) return min;
  const endInset = SCRUB_PAD_X + SCRUB_DRAG_W / 2;
  const travel = Math.max(rect.width - endInset * 2, 0);
  const t =
    travel <= 0
      ? 0
      : Math.min(1, Math.max(0, (clientX - rect.left - endInset) / travel));
  const raw = min + t * (max - min);
  const snapped = Math.round(raw / step) * step;
  return Math.min(max, Math.max(min, Number(snapped.toFixed(6))));
}

export function nearestTickStop(
  value: number,
  stops: readonly { value: number; label: string }[],
) {
  return stops.reduce((best, stop) =>
    Math.abs(stop.value - value) < Math.abs(best.value - value) ? stop : best,
  );
}

export function clampRangePair(
  from: number,
  to: number,
  min: number,
  max: number,
  step: number,
) {
  const gap = Math.max(step, 0);
  let a = Math.min(max, Math.max(min, from));
  let b = Math.min(max, Math.max(min, to));
  if (b < a) {
    const swap = a;
    a = b;
    b = swap;
  }
  if (b - a < gap) {
    if (a + gap <= max) b = a + gap;
    else a = Math.max(min, b - gap);
  }
  return { from: a, to: b };
}

/**
 * Scrubber under a number field (Figma kit `4829:27`).
 * Track 28 / r4; fill white 14% full-height flush; 1px overlay ring
 * (not inset box-shadow — overflow:hidden nicks rounded corners);
 * drag-bar 4×20 / r4 / #b8b8b8. Ticks only when ≤14 fixed stops and shown.
 */
export function TickSlider({
  ariaLabel,
  defaultValue,
  max,
  min,
  onChange,
  onDragging,
  step = 1,
  tickStops,
  value,
}: {
  ariaLabel: string;
  /** Draws a notch at this value; the drag snaps to it within SCRUB_SNAP_PX. */
  defaultValue?: number;
  max: number;
  min: number;
  onChange: (value: number) => void;
  onDragging?: (dragging: boolean) => void;
  step?: number;
  tickStops?: readonly { value: number; label: string }[];
  value: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const range = Math.max(max - min, step);
  const namedStops = tickStops && tickStops.length >= 2 ? tickStops : null;
  const stopCount = namedStops
    ? namedStops.length
    : Math.round(range / step) + 1;
  const showTicks =
    Boolean(namedStops) ||
    (stopCount >= 2 && stopCount <= SCRUB_MAX_TICK_STOPS);
  const activeStop = namedStops
    ? namedStops.indexOf(nearestTickStop(value, namedStops))
    : Math.round((value - min) / step);
  const ratio =
    namedStops && activeStop >= 0
      ? activeStop / Math.max(namedStops.length - 1, 1)
      : scrubRatio(value, min, max);

  const homeValue =
    defaultValue !== undefined &&
    Number.isFinite(defaultValue) &&
    defaultValue >= min &&
    defaultValue <= max
      ? defaultValue
      : null;

  function valueFromClientX(clientX: number) {
    const el = trackRef.current;
    if (!el) return value;
    const raw = valueFromTrackX(clientX, el, min, max, step);
    if (namedStops) return nearestTickStop(raw, namedStops).value;
    // Magnet: within a few px of the default notch the drag lands exactly on it.
    if (homeValue !== null) {
      const rect = el.getBoundingClientRect();
      const endInset = SCRUB_PAD_X + SCRUB_DRAG_W / 2;
      const travel = Math.max(rect.width - endInset * 2, 0);
      const homeX =
        rect.left + endInset + scrubRatio(homeValue, min, max) * travel;
      if (Math.abs(clientX - homeX) <= SCRUB_SNAP_PX) return homeValue;
    }
    return raw;
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    draggingRef.current = true;
    onDragging?.(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    onChange(valueFromClientX(event.clientX));
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    onChange(valueFromClientX(event.clientX));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onDragging?.(false);
  }

  // Drag center sits on the padded travel; fill extends through drag + 4px (Figma).
  const dragLeft = `calc(${SCRUB_PAD_X + SCRUB_DRAG_W / 2}px + ${ratio} * (100% - ${
    (SCRUB_PAD_X + SCRUB_DRAG_W / 2) * 2
  }px))`;
  const fillWidth = `calc(${SCRUB_PAD_X + SCRUB_DRAG_W / 2}px + ${ratio} * (100% - ${
    (SCRUB_PAD_X + SCRUB_DRAG_W / 2) * 2
  }px) + ${SCRUB_DRAG_W / 2 + 4}px)`;

  return (
    <div className="flex w-full flex-col gap-2">
    <div
      ref={trackRef}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          if (namedStops) {
            onChange(namedStops[Math.max(0, activeStop - 1)]?.value ?? min);
          } else {
            onChange(Math.max(min, Number((value - step).toFixed(6))));
          }
        } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          if (namedStops) {
            onChange(
              namedStops[Math.min(namedStops.length - 1, activeStop + 1)]
                ?.value ?? max,
            );
          } else {
            onChange(Math.min(max, Number((value + step).toFixed(6))));
          }
        } else if (event.key === "Home") {
          event.preventDefault();
          onChange(namedStops?.[0]?.value ?? min);
        } else if (event.key === "End") {
          event.preventDefault();
          onChange(namedStops?.[namedStops.length - 1]?.value ?? max);
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={cn(
        "group/scrub-track relative h-[28px] w-full cursor-ew-resize overflow-hidden rounded",
        "focus-visible:outline-none",
      )}
      style={{ background: FIELD, color: MUTED, touchAction: "none" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 h-full rounded bg-[color:var(--sp-fill)]"
        style={{ width: `min(100%, ${fillWidth})` }}
      />
      {showTicks ? (
        <div
          className="pointer-events-none absolute inset-y-0 flex items-center justify-between"
          style={{ left: SCRUB_TICK_PAD_X, right: SCRUB_TICK_PAD_X }}
        >
          {Array.from({ length: stopCount }, (_, i) => (
            <span
              key={i}
              className="shrink-0 rounded-[1px] bg-[color:var(--sp-tick)]"
              style={{
                width: SCRUB_TICK_W,
                height: SCRUB_TICK_H,
                opacity: i === activeStop ? 0 : 1,
              }}
              aria-hidden
            />
          ))}
        </div>
      ) : null}
      {homeValue !== null && !namedStops ? (
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[1px] bg-[color:var(--sp-tick)]"
          style={{
            left: scrubDragLeft(scrubRatio(homeValue, min, max)),
            width: SCRUB_TICK_W,
            height: SCRUB_NOTCH_H,
            opacity: homeValue === value ? 0 : 1,
          }}
        />
      ) : null}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-[color:var(--sp-knob-off)]"
        style={{
          left: dragLeft,
          width: SCRUB_DRAG_W,
          height: SCRUB_DRAG_H,
        }}
      />
      {/* Overlay ring — inset box-shadow + overflow:hidden leaves square corner nicks. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded border border-[color:var(--sp-line-mid)]",
          "transition-[border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
          "fine-hover:group-hover/scrub-track:border-[color:var(--sp-line-strong)]",
          "group-focus-visible/scrub-track:border-[color:var(--sp-line-focus)]",
        )}
      />
    </div>
    {namedStops ? (
      <div className="relative h-[14px] w-full">
        {namedStops.map((stop, i) => {
          const t = namedStops.length === 1 ? 0 : i / (namedStops.length - 1);
          const edge = i === 0 || i === namedStops.length - 1;
          return (
            <span
              key={stop.label}
              className="absolute top-0 font-sans text-[11px] leading-[14px] text-[color:var(--sp-muted)]"
              style={{
                left:
                  i === namedStops.length - 1
                    ? undefined
                    : `calc(${SCRUB_TICK_PAD_X}px + ${t} * (100% - ${SCRUB_TICK_PAD_X * 2}px))`,
                right:
                  i === namedStops.length - 1
                    ? `${SCRUB_TICK_PAD_X}px`
                    : undefined,
                transform: edge ? undefined : "translateX(-50%)",
                opacity: i === activeStop ? 1 : 0.45,
              }}
            >
              {stop.label}
            </span>
          );
        })}
      </div>
    ) : null}
    </div>
  );
}

export function RangeSlider({
  ariaLabel,
  from,
  max,
  min,
  onChange,
  step = 1,
  to,
}: {
  ariaLabel: string;
  from: number;
  max: number;
  min: number;
  onChange: (next: { from: number; to: number }) => void;
  step?: number;
  to: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<"from" | "to" | null>(null);
  const pair = clampRangePair(from, to, min, max, step);
  const fromRatio = scrubRatio(pair.from, min, max);
  const toRatio = scrubRatio(pair.to, min, max);

  function applyClientX(clientX: number, handle: "from" | "to") {
    const el = trackRef.current;
    if (!el) return;
    const raw = valueFromTrackX(clientX, el, min, max, step);
    if (handle === "from") {
      onChange(clampRangePair(raw, pair.to, min, max, step));
    } else {
      onChange(clampRangePair(pair.from, raw, min, max, step));
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const el = trackRef.current;
    if (!el) return;
    const raw = valueFromTrackX(event.clientX, el, min, max, step);
    const handle =
      Math.abs(raw - pair.from) <= Math.abs(raw - pair.to) ? "from" : "to";
    handleRef.current = handle;
    event.currentTarget.setPointerCapture(event.pointerId);
    applyClientX(event.clientX, handle);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!handleRef.current) return;
    applyClientX(event.clientX, handleRef.current);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    handleRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const barTravel = SCRUB_PAD_X * 2 + SCRUB_DRAG_W;
  const spanBleed = 4;

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={pair.from}
      aria-valuetext={`${pair.from} – ${pair.to}`}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="group/scrub-track relative h-[28px] w-full cursor-ew-resize rounded focus-visible:outline-none"
      style={{ background: FIELD, color: MUTED, touchAction: "none" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 h-full rounded bg-[color:var(--sp-fill)]"
        style={{
          left: `calc(${SCRUB_PAD_X - spanBleed}px + ${fromRatio} * (100% - ${barTravel}px))`,
          width: `calc(${Math.max(0, toRatio - fromRatio)} * (100% - ${barTravel}px) + ${SCRUB_DRAG_W + spanBleed * 2}px)`,
        }}
      />
      {(["from", "to"] as const).map((handle) => (
        <div
          key={handle}
          aria-hidden
          className="pointer-events-none absolute top-1 rounded bg-[color:var(--sp-knob-off)]"
          style={{
            left: rangeBarLeft(handle === "from" ? fromRatio : toRatio),
            width: SCRUB_DRAG_W,
            height: SCRUB_DRAG_H,
          }}
        />
      ))}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded border border-[color:var(--sp-line-mid)]",
          "transition-[border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
          "fine-hover:group-hover/scrub-track:border-[color:var(--sp-line-strong)]",
          "group-focus-visible/scrub-track:border-[color:var(--sp-line-focus)]",
        )}
      />
    </div>
  );
}

export function StepperMark({ kind }: { kind: "minus" | "plus" }) {
  return (
    <SfSymbol
      name={kind}
      className="pointer-events-none block size-5"
    />
  );
}

/** Pair field glyphs. Gap = SF 􂠹 / 􂠷 from Panel / Pair Row (`5259:408`), 20×20. Pad = rounded rect + edge bars. */
export const PAIR_GLYPHS: Record<PairFieldIcon, ReactNode> = {
  gapX: (
    <path d="M15.7422 1.72852C15.7422 1.58691 15.7959 1.46729 15.9033 1.36963C16.0156 1.27197 16.1426 1.22314 16.2842 1.22314C16.4258 1.22314 16.5503 1.27197 16.6577 1.36963C16.7651 1.46729 16.8188 1.58691 16.8188 1.72852V17.6953C16.8188 17.8369 16.7651 17.9565 16.6577 18.0542C16.5503 18.1519 16.4258 18.2007 16.2842 18.2007C16.1426 18.2007 16.0156 18.1519 15.9033 18.0542C15.7959 17.9565 15.7422 17.8369 15.7422 17.6953V1.72852ZM7.33398 4.35791C7.33398 3.81104 7.47314 3.396 7.75146 3.11279C8.03467 2.82471 8.44482 2.68066 8.98193 2.68066H11.0254C11.5576 2.68066 11.9653 2.82471 12.2485 3.11279C12.5317 3.396 12.6733 3.81104 12.6733 4.35791V15.0659C12.6733 15.6128 12.5317 16.0303 12.2485 16.3184C11.9653 16.6064 11.5576 16.7505 11.0254 16.7505H8.98193C8.44482 16.7505 8.03467 16.6064 7.75146 16.3184C7.47314 16.0303 7.33398 15.6128 7.33398 15.0659V4.35791ZM8.43994 4.37256V15.0513C8.43994 15.2368 8.49121 15.3809 8.59375 15.4834C8.69629 15.5908 8.84521 15.6445 9.04053 15.6445H10.9595C11.1548 15.6445 11.3037 15.5908 11.4062 15.4834C11.5137 15.3809 11.5674 15.2368 11.5674 15.0513V4.37256C11.5674 4.18701 11.5137 4.04297 11.4062 3.94043C11.3037 3.83789 11.1548 3.78662 10.9595 3.78662H9.04053C8.84521 3.78662 8.69629 3.83789 8.59375 3.94043C8.49121 4.04297 8.43994 4.18701 8.43994 4.37256ZM4.25781 1.72852V17.6953C4.25781 17.8369 4.2041 17.9565 4.09668 18.0542C3.98926 18.1519 3.8623 18.2007 3.71582 18.2007C3.57422 18.2007 3.44971 18.1519 3.34229 18.0542C3.23486 17.9565 3.18115 17.8369 3.18115 17.6953V1.72852C3.18115 1.58691 3.23486 1.46729 3.34229 1.36963C3.44971 1.27197 3.57422 1.22314 3.71582 1.22314C3.8623 1.22314 3.98926 1.27197 4.09668 1.36963C4.2041 1.46729 4.25781 1.58691 4.25781 1.72852Z" />
  ),
  gapY: (
    <path d="M1.74561 3.96973C1.59912 3.96973 1.47705 3.91602 1.37939 3.80859C1.28174 3.69629 1.23291 3.56934 1.23291 3.42773C1.23291 3.28613 1.28174 3.16162 1.37939 3.0542C1.47705 2.94678 1.59912 2.89307 1.74561 2.89307H18.2544C18.4009 2.89307 18.5229 2.94678 18.6206 3.0542C18.7183 3.16162 18.7671 3.28613 18.7671 3.42773C18.7671 3.56934 18.7183 3.69629 18.6206 3.80859C18.5229 3.91602 18.4009 3.96973 18.2544 3.96973H1.74561ZM4.646 12.3779C4.09912 12.3779 3.68164 12.2388 3.39355 11.9604C3.11035 11.6772 2.96875 11.2671 2.96875 10.73V8.68652C2.96875 8.1543 3.11035 7.74658 3.39355 7.46338C3.68164 7.18018 4.09912 7.03857 4.646 7.03857H15.354C15.9009 7.03857 16.3159 7.18018 16.5991 7.46338C16.8872 7.74658 17.0312 8.1543 17.0312 8.68652V10.73C17.0312 11.2671 16.8872 11.6772 16.5991 11.9604C16.3159 12.2388 15.9009 12.3779 15.354 12.3779H4.646ZM4.66064 11.272H15.3394C15.5249 11.272 15.6689 11.2207 15.7715 11.1182C15.874 11.0156 15.9253 10.8667 15.9253 10.6714V8.75244C15.9253 8.55713 15.874 8.4082 15.7715 8.30566C15.6689 8.19824 15.5249 8.14453 15.3394 8.14453H4.66064C4.4751 8.14453 4.33105 8.19824 4.22852 8.30566C4.12598 8.4082 4.07471 8.55713 4.07471 8.75244V10.6714C4.07471 10.8667 4.12598 11.0156 4.22852 11.1182C4.33105 11.2207 4.4751 11.272 4.66064 11.272ZM1.74561 15.4541H18.2544C18.4009 15.4541 18.5229 15.5078 18.6206 15.6152C18.7183 15.7227 18.7671 15.8496 18.7671 15.9961C18.7671 16.1377 18.7183 16.2622 18.6206 16.3696C18.5229 16.4771 18.4009 16.5308 18.2544 16.5308H1.74561C1.59912 16.5308 1.47705 16.4771 1.37939 16.3696C1.28174 16.2622 1.23291 16.1377 1.23291 15.9961C1.23291 15.8496 1.28174 15.7227 1.37939 15.6152C1.47705 15.5078 1.59912 15.4541 1.74561 15.4541Z" />
  ),
  padX: (
    <path d="M4.185 14.282c-.23 0-.393-.051-.491-.154-.098-.102-.147-.271-.147-.505V5.815c0-.234.049-.402.147-.505.098-.102.261-.154.491-.154h2.351c.229 0 .393.052.49.154.103.103.154.271.154.505v7.808c0 .234-.051.403-.154.505-.097.103-.261.154-.49.154H4.185Zm9.272 0c-.229 0-.395-.051-.498-.154-.098-.102-.146-.271-.146-.505V5.815c0-.234.048-.402.146-.505.098-.102.269-.154.498-.154h2.351c.23 0 .393.052.491.154.102.103.154.271.154.505v7.808c0 .234-.052.403-.154.505-.098.103-.261.154-.491.154h-2.351ZM3.665 16.458c-.767 0-1.343-.191-1.729-.572-.381-.376-.571-.94-.571-1.692V5.244c0-.757.19-1.323.571-1.699.386-.381.962-.571 1.729-.571h12.67c.772 0 1.348.19 1.729.571.381.381.571.947.571 1.699v8.95c0 .752-.19 1.316-.571 1.692-.381.381-.957.572-1.729.572H3.665Zm.015-1.18h12.641c.362 0 .64-.095.836-.285.2-.196.3-.484.3-.865V5.31c0-.381-.1-.669-.3-.864-.195-.195-.474-.293-.836-.293H3.68c-.366 0-.647.098-.842.293-.195.195-.293.483-.293.864v8.818c0 .381.098.669.293.865.195.19.476.285.842.285Z" />
  ),
  padY: (
    <path d="M4.199 7.544c-.234 0-.403-.049-.505-.147-.098-.102-.147-.268-.147-.498V5.801c0-.235.049-.4.147-.498.102-.098.271-.147.505-.147h11.594c.234 0 .403.049.505.147.103.098.154.263.154.498v1.098c0 .23-.051.396-.154.498-.102.098-.271.147-.505.147H4.199Zm0 6.775c-.234 0-.403-.049-.505-.147-.098-.102-.147-.268-.147-.498v-1.099c0-.234.049-.4.147-.497.102-.098.271-.147.505-.147h11.594c.234 0 .403.049.505.147.103.097.154.263.154.497v1.099c0 .23-.051.396-.154.498-.102.098-.271.147-.505.147H4.199ZM3.665 16.458c-.767 0-1.343-.191-1.729-.572-.381-.376-.571-.94-.571-1.692V5.244c0-.757.19-1.323.571-1.699.386-.381.962-.571 1.729-.571h12.67c.772 0 1.348.19 1.729.571.381.381.571.947.571 1.699v8.95c0 .752-.19 1.316-.571 1.692-.381.381-.957.572-1.729.572H3.665Zm.015-1.18h12.641c.362 0 .64-.095.836-.285.2-.196.3-.484.3-.865V5.31c0-.381-.1-.669-.3-.864-.195-.195-.474-.293-.836-.293H3.68c-.366 0-.647.098-.842.293-.195.195-.293.483-.293.864v8.818c0 .381.098.669.293.865.195.19.476.285.842.285Z" />
  ),
};

export function PairGlyph({ icon }: { icon: PairFieldIcon }) {
  return (
    <svg
      aria-hidden
      className="pointer-events-none block size-5 shrink-0"
      fill="currentColor"
      fillRule="nonzero"
      viewBox="0 0 20 20"
    >
      {PAIR_GLYPHS[icon]}
    </svg>
  );
}

export function SettingPair<TSettings>({
  pair,
  values,
  onCommit,
  modified,
  onResetValue,
  info,
  icon,
}: {
  pair: PairSetting<TSettings>;
  values: readonly [number, number];
  onCommit: (key: keyof TSettings, value: number) => void;
} & ResetDotProps) {
  return (
    <div
      className="group flex h-[28px] items-center justify-between gap-4"
      data-setting-row=""
    >
      <RowLabel
        label={copyKey(pair.label)}
        className="h-[28px]"
        modified={modified}
        onResetValue={onResetValue}
        info={info}
        icon={icon}
      />
      <div className="flex shrink-0 items-center gap-2">
        {pair.fields.map((field, index) => {
          const value = values[index];
          const max =
            Number.isFinite(value) && value > field.max ? value : field.max;
          return (
            <div
              key={String(field.key)}
              title={copyKey(field.ariaLabel)}
              className="flex shrink-0 items-center gap-1.5"
              style={{ color: MUTED }}
            >
              <PairGlyph icon={field.icon} />
              <NumberField
                ariaLabel={
                  field.unit
                    ? `${copyKey(field.ariaLabel)} (${field.unit})`
                    : copyKey(field.ariaLabel)
                }
                max={max}
                min={field.min}
                onCommit={(next) => onCommit(field.key, next)}
                step={field.step ?? 1}
                unit={field.unit}
                value={value}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SettingNumber({
  defaultValue,
  label,
  max,
  min,
  onChange,
  reduceMotion,
  scrub = false,
  step = 1,
  stepper = false,
  tickStops,
  unit,
  value,
  modified,
  onResetValue,
  info,
  icon,
}: {
  /** Scrub-track notch: the drag magnets to this value. */
  defaultValue?: number;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  reduceMotion: boolean;
  scrub?: boolean;
  step?: number;
  stepper?: boolean;
  tickStops?: readonly { value: number; label: string }[];
  unit?: string;
  value: number;
} & ResetDotProps) {
  const [scrubOpen, setScrubOpen] = useState(false);
  const [dragMax, setDragMax] = useState<number | null>(null);
  const overflowMax =
    Number.isFinite(value) && value > max ? value : max;
  const sliderMax = scrub ? (dragMax ?? overflowMax) : max;
  const aria = unit ? `${label} (${unit})` : label;

  if (stepper) {
    const commit = (next: number) => onChange(clampNumber(next, min, max));
    const atMin = value <= min;
    const atMax = value >= max;
    const stepBy = (dir: -1 | 1) =>
      commit(Number((value + dir * step).toFixed(6)));

    return (
      <SettingRow
        label={label}
        modified={modified}
        onResetValue={onResetValue}
        info={info}
        icon={icon}
      >
        <div
          className={cn(
            "grid h-[28px] w-[86px] shrink-0 grid-cols-[28px_1px_28px_1px_28px]",
            pickerChrome,
          )}
        >
          <button
            type="button"
            aria-label={`Decrease ${label}`}
            disabled={atMin}
            onClick={() => stepBy(-1)}
            className={cn(
              "flex size-[28px] items-center justify-center outline-none disabled:opacity-30",
              pickEase,
              pickIdle,
            )}
          >
            <StepperMark kind="minus" />
          </button>
          <div aria-hidden className="bg-[color:var(--sp-fill-strong)]" />
          <div className="flex size-[28px] items-center justify-center text-[14px] leading-[18px] text-[color:var(--sp-fg)]">
            <NumberInput
              ariaLabel={aria}
              className="w-full flex-none px-0.5 text-center"
              max={max}
              min={min}
              onCommit={commit}
              step={step}
              value={value}
            />
          </div>
          <div aria-hidden className="bg-[color:var(--sp-fill-strong)]" />
          <button
            type="button"
            aria-label={`Increase ${label}`}
            disabled={atMax}
            onClick={() => stepBy(1)}
            className={cn(
              "flex size-[28px] items-center justify-center outline-none disabled:opacity-30",
              pickEase,
              pickIdle,
            )}
          >
            <StepperMark kind="plus" />
          </button>
        </div>
      </SettingRow>
    );
  }

  const field = (
    <NumberField
      ariaLabel={aria}
      max={sliderMax}
      min={min}
      onCommit={onChange}
      step={step}
      unit={unit}
      value={value}
    />
  );

  if (!scrub) {
    return (
      <SettingRow
      label={label}
      modified={modified}
      onResetValue={onResetValue}
      info={info}
      icon={icon}
    >
        {field}
      </SettingRow>
    );
  }

  return (
    <div className={cn("flex flex-col", scrubOpen && "gap-1")}>
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
        <div className="relative flex shrink-0 items-center">
          <FieldButton
            label={scrubOpen ? `Hide slider for ${label}` : `Show slider for ${label}`}
            expanded={scrubOpen}
            onClick={() => setScrubOpen((open) => !open)}
            className={cn(
              "absolute top-0 right-full mr-1",
              !reduceMotion && "transition-opacity",
              scrubOpen
                ? "opacity-100"
                : "opacity-100 fine-hover:pointer-events-none fine-hover:opacity-0 fine-hover:group-hover:pointer-events-auto fine-hover:group-hover:opacity-100",
            )}
            style={
              reduceMotion
                ? undefined
                : {
                    transitionDuration: `${SECTION_MS}ms`,
                    transitionTimingFunction: EASE_OUT,
                  }
            }
          >
            <SfSymbol name="slider.horizontal.below.rectangle" className="size-5" />
          </FieldButton>
          {field}
        </div>
      </div>
      <div
        className={cn(
          "grid",
          scrubOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          !reduceMotion && "transition-[grid-template-rows,opacity]",
        )}
        style={{
          opacity: scrubOpen ? 1 : 0,
          ...(reduceMotion
            ? {}
            : {
                transitionDuration: scrubOpen
                  ? `${SECTION_MS}ms`
                  : `${Math.round(SECTION_MS * 0.7)}ms`,
                transitionTimingFunction: EASE_OUT,
              }),
        }}
        inert={scrubOpen ? undefined : true}
      >
        <div className="min-h-0 overflow-hidden">
        <TickSlider
          ariaLabel={aria}
          defaultValue={defaultValue}
          max={sliderMax}
          min={min}
          onChange={onChange}
          onDragging={(dragging) => {
            setDragMax(dragging ? overflowMax : null);
          }}
          step={step}
          tickStops={tickStops}
          value={value}
        />
        </div>
      </div>
    </div>
  );
}

export function snapStep(value: number, step: number) {
  if (step <= 0) return value;
  return Number((Math.round(value / step) * step).toFixed(6));
}

export function SettingRange({
  from,
  label,
  max,
  min,
  onChange,
  step = 1,
  to,
  track = true,
  unit,
  modified,
  onResetValue,
  info,
  icon,
}: {
  from: number;
  label: string;
  max: number;
  min: number;
  onChange: (next: { from: number; to: number }) => void;
  step?: number;
  to: number;
  track?: boolean;
  unit?: string;
} & ResetDotProps) {
  const pair = clampRangePair(from, to, min, max, step);
  const aria = unit ? `${label} (${unit})` : label;

  function field(role: "from" | "to", value: number) {
    const commitRole = (next: number) => {
      onChange(
        role === "from"
          ? clampRangePair(next, pair.to, min, max, step)
          : clampRangePair(pair.from, next, min, max, step),
      );
    };
    return (
      <NumberField
        ariaLabel={`${aria} ${role === "from" ? "min" : "max"}`}
        max={max}
        min={min}
        onCommit={commitRole}
        step={step}
        unit={unit}
        value={value}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-1">
      <div
        className="group flex h-[28px] w-full items-center justify-between gap-4"
        data-setting-row=""
      >
        <RowLabel
          label={label}
          modified={modified}
          onResetValue={onResetValue}
          info={info}
          icon={icon}
        />
        <div className="flex shrink-0 items-center gap-1">
          {field("from", pair.from)}
          {field("to", pair.to)}
        </div>
      </div>
      {track ? (
        <RangeSlider
          ariaLabel={aria}
          from={pair.from}
          max={max}
          min={min}
          onChange={onChange}
          step={step}
          to={pair.to}
        />
      ) : null}
    </div>
  );
}
