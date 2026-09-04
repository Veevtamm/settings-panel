"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { PIN_EPSILON } from "../lib/transition-player";
import { clampNumber, cn } from "../lib/utils";
import { SfSymbol, type SfSymbolName } from "../sf-symbol";
import {
  EASE_OUT,
  MUTED,
  SCRUB_DRAG_H,
  SCRUB_DRAG_W,
  SECTION_MS,
  pickerChrome,
} from "./chrome";
import { FieldButton, NumberField, SettingToggle } from "./fields";
import { useCopyFlash } from "./use-copy-flash";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";
import { scrubDragLeft, snapStep } from "./number";
import { RowLabel } from "./row";
import type { PlayerController, PlayerState, ResetDotProps } from "./types";

/** ×1 → ×3 → ×10 → ×1: slow-down steps, click cycles. */
const PLAYER_SPEEDS = [1, 3, 10] as const;
/** Captions under Фазы hide when their segment is narrower than this (px). */
const PHASE_CAPTION_MIN_PX = 24;
/** Drag-bar inset from the hovered phase edges (Figma Panel / Phases). */
const PHASE_BAR_INSET = 4;

export type PlayerSegment = {
  caption: string;
  kind: "phase" | "pause";
  max: number;
  value: number;
};

/** Which segment the playhead is in — the caption goes to the HUD and copy text. */
function segmentAtQ(
  segments: readonly { caption: string; value: number }[],
  q: number,
) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return segments[0]?.caption ?? "";
  const t = clampNumber(q, 0, 1) * total;
  let acc = 0;
  for (const s of segments) {
    acc += s.value;
    if (t <= acc) return s.caption;
  }
  return segments[segments.length - 1]?.caption ?? "";
}

/** Playhead in ms of the whole transition (segments sum). */
function momentMs(
  segments: readonly { value: number }[],
  q: number,
) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return Math.round(clampNumber(q, 0, 1) * total);
}

/** `?moment=<player id>:<q>` — one entry per player, so a page may park several transitions at once. */
export const MOMENT_QUERY = "moment";

export function momentUrl(playerId: string, q: number, href = window.location.href) {
  const url = new URL(href);
  const others = url.searchParams
    .getAll(MOMENT_QUERY)
    .filter((entry) => !entry.startsWith(`${playerId}:`));
  url.searchParams.delete(MOMENT_QUERY);
  for (const entry of others) url.searchParams.append(MOMENT_QUERY, entry);
  url.searchParams.append(MOMENT_QUERY, `${playerId}:${q.toFixed(3)}`);
  return url.toString();
}

/** q parked in the URL for this player, or null. */
export function readMoment(playerId: string, search = window.location.search) {
  for (const entry of new URLSearchParams(search).getAll(MOMENT_QUERY)) {
    const [id, raw] = entry.split(":");
    if (id !== playerId) continue;
    const q = Number(raw);
    return Number.isFinite(q) ? clampNumber(q, 0, 1) : null;
  }
  return null;
}

/** `Reel · 651 ms — фаза 1` — HUD and copy share this line; URL is appended on copy. */
export function formatMoment(
  label: string,
  q: number,
  segments: readonly { caption: string; value: number }[],
) {
  return `${label} · ${momentMs(segments, q)} ms — ${segmentAtQ(segments, q)}`;
}

export function momentCopyText(
  label: string,
  playerId: string,
  q: number,
  segments: readonly { caption: string; value: number }[],
) {
  return `${formatMoment(label, q, segments)}\n${momentUrl(playerId, q)}`;
}

export function usePlayerState(controller: PlayerController): PlayerState {
  return useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );
}

/** Boolean snapshot — q ticks while closed do not re-render the folded row. */
function usePlayerOpen(controller: PlayerController) {
  return useSyncExternalStore(
    controller.subscribe,
    () => controller.getState().open,
    () => controller.getState().open,
  );
}

function PlayerTrack({
  ariaLabel,
  state,
  controller,
  segments,
}: {
  ariaLabel: string;
  state: PlayerState;
  controller: PlayerController;
  segments: readonly PlayerSegment[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  function qFromClientX(clientX: number) {
    const el = trackRef.current;
    if (!el) return state.q;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return state.q;
    return clampNumber((clientX - rect.left) / rect.width, 0, 1);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-pin]")) return;
    event.preventDefault();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    controller.seek(qFromClientX(event.clientX));
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    controller.seek(qFromClientX(event.clientX));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={Number(state.q.toFixed(3))}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 0.1 : 0.01;
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          controller.seek(clampNumber(state.q - step, 0, 1));
        } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          controller.seek(clampNumber(state.q + step, 0, 1));
        } else if (event.key === " ") {
          event.preventDefault();
          if (state.playing) controller.pause();
          else controller.play(1);
        }
      }}
      className={cn(
        "h-[28px] w-full cursor-ew-resize touch-none select-none outline-none focus-visible:after:border-[color:var(--sp-line-focus)]",
        pickerChrome,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 rounded bg-[color:var(--sp-fill)]"
        style={{ width: `calc(${scrubDragLeft(state.q)} + ${SCRUB_DRAG_W / 2 + 4}px)` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-[color:var(--sp-knob-off)]"
        style={{
          width: SCRUB_DRAG_W,
          height: SCRUB_DRAG_H,
          left: scrubDragLeft(state.q),
        }}
      />
      {state.pins.map((pin) => (
        <button
          key={pin}
          type="button"
          data-pin=""
          aria-label={`Момент ${momentMs(segments, pin)} ms`}
          title={`${momentMs(segments, pin)} ms`}
          onClick={() => controller.seek(pin)}
          className="absolute top-0 z-20 flex h-full w-[10px] -translate-x-1/2 items-center justify-center outline-none"
          style={{ left: scrubDragLeft(pin) }}
        >
          <span
            aria-hidden
            className="block h-[12px] w-[2px] rounded-[1px] bg-[color:var(--sp-tick)]"
          />
        </button>
      ))}
    </div>
  );
}

function TransportRow({
  label,
  state,
  controller,
  segments,
  locale,
}: {
  label: string;
  state: PlayerState;
  controller: PlayerController;
  segments: readonly PlayerSegment[];
  locale: PanelLocale;
}) {
  const { copied, copy } = useCopyFlash();
  const pinned = state.pins.some((pin) => Math.abs(pin - state.q) < PIN_EPSILON);

  function cycleSpeed() {
    const at = PLAYER_SPEEDS.findIndex((speed) => speed === state.speed);
    controller.setSpeed(PLAYER_SPEEDS[(at < 0 ? 0 : at + 1) % PLAYER_SPEEDS.length]);
  }

  function copyMoment() {
    void copy(momentCopyText(label, controller.id, state.q, segments));
  }

  const transport: { icon: SfSymbolName; label: string; active: boolean; run: () => void }[] = [
    {
      icon: "backward.end",
      label: tx(PANEL_COPY.back, locale),
      active: state.playing && state.direction === -1,
      run: () => controller.play(-1),
    },
    // Play/pause like any player: paused → run forward (from the end = from the start), running → freeze
    state.playing
      ? {
          icon: "pause",
          label: tx(PANEL_COPY.freeze, locale),
          active: false,
          run: () => controller.pause(),
        }
      : {
          icon: "play",
          label: tx(PANEL_COPY.play, locale),
          active: false,
          run: () => controller.play(1),
        },
    {
      icon: "forward.end",
      label: tx(PANEL_COPY.forward, locale),
      active: state.playing && state.direction === 1,
      run: () => controller.play(1),
    },
  ];

  return (
    <div className="grid h-[28px] grid-cols-[1fr_auto_1fr] items-center">
      <div className="flex items-center gap-1 justify-self-start">
        <SfSymbol name="timer" className="size-5" style={{ color: MUTED }} />
        <FieldButton
          label={tx(PANEL_COPY.speed(state.speed), locale)}
          active={state.speed !== 1}
          onClick={cycleSpeed}
          className="font-mono text-[12px] leading-none tabular-nums"
        >
          ×{state.speed}
        </FieldButton>
      </div>
      <div className="flex items-center gap-1">
        {transport.map((item) => (
          <FieldButton
            key={item.icon}
            label={item.label}
            active={item.active}
            onClick={item.run}
          >
            <SfSymbol name={item.icon} className="size-5" />
          </FieldButton>
        ))}
      </div>
      <div className="flex items-center gap-1 justify-self-end">
        <FieldButton
          label={pinned ? tx(PANEL_COPY.unpin, locale) : tx(PANEL_COPY.pin, locale)}
          active={pinned}
          onClick={() => controller.togglePin()}
        >
          <SfSymbol name={pinned ? "pin.slash" : "pin"} className="size-5" />
        </FieldButton>
        <FieldButton label={tx(PANEL_COPY.copyMoment, locale)} onClick={copyMoment}>
          <SfSymbol name={copied ? "checkmark" : "doc"} className="size-5" />
        </FieldButton>
      </div>
    </div>
  );
}

function PhasesTrack({
  ariaLabel,
  segments,
  min,
  step,
  onChange,
}: {
  ariaLabel: string;
  segments: readonly PlayerSegment[];
  min: number;
  step: number;
  onChange: (values: number[]) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const values = segments.map((s) => s.value);
  const total = values.reduce((sum, v) => sum + v, 0);
  const safeTotal = total > 0 ? total : 1;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setTrackWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Boundary b sits between segments b-1 and b; total stays put. */
  function moveBoundary(b: number, t: number) {
    const left = values[b - 1];
    const right = values[b];
    const pair = left + right;
    const before = values.slice(0, b - 1).reduce((s, v) => s + v, 0);
    const lo = Math.max(min, pair - segments[b].max);
    const hi = Math.min(segments[b - 1].max, pair - min);
    if (hi < lo) return;
    const nextLeft = clampNumber(snapStep(t - before, step), lo, hi);
    const next = [...values];
    next[b - 1] = nextLeft;
    next[b] = pair - nextLeft;
    onChange(next);
  }

  function boundaryFromClientX(b: number, clientX: number) {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    moveBoundary(b, clampNumber((clientX - rect.left) / rect.width, 0, 1) * total);
  }

  function onBarDown(b: number, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    dragRef.current = b;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onBarMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragRef.current === null) return;
    boundaryFromClientX(dragRef.current, event.clientX);
  }

  function onBarUp(event: ReactPointerEvent<HTMLButtonElement>) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function nudge(b: number, dir: -1 | 1) {
    const before = values.slice(0, b).reduce((s, v) => s + v, 0);
    moveBoundary(b, before + dir * step);
  }

  const bar = (b: number, side: "left" | "right") => (
    <button
      key={side}
      type="button"
      role="slider"
      aria-label={`${segments[b - 1].caption} / ${segments[b].caption}`}
      aria-valuemin={min}
      aria-valuemax={values[b - 1] + values[b]}
      aria-valuenow={values[b - 1]}
      onPointerDown={(event) => onBarDown(b, event)}
      onPointerMove={onBarMove}
      onPointerUp={onBarUp}
      onPointerCancel={onBarUp}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          nudge(b, -1);
        } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          nudge(b, 1);
        }
      }}
      className="absolute top-1/2 z-20 -translate-y-1/2 cursor-ew-resize touch-none rounded bg-[color:var(--sp-knob)] outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--sp-line-focus)]"
      style={{
        width: SCRUB_DRAG_W,
        height: SCRUB_DRAG_H,
        [side]: PHASE_BAR_INSET,
      }}
    />
  );

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div
        ref={trackRef}
        aria-label={ariaLabel}
        onPointerLeave={() => {
          if (dragRef.current === null) setHover(null);
        }}
        className={cn("h-[28px] w-full select-none", pickerChrome)}
      >
        <div className="flex h-full w-full">
          {segments.map((segment, i) => {
            const isPhase = segment.kind === "phase";
            const hovered = hover === i;
            return (
              <div
                key={`${segment.caption}-${i}`}
                onPointerEnter={() => {
                  if (isPhase && dragRef.current === null) setHover(i);
                }}
                className={cn(
                  "relative h-full min-w-0 rounded transition-colors duration-150",
                  isPhase &&
                    (hovered
                      ? "bg-[color:var(--sp-fill-hover)]"
                      : "bg-[color:var(--sp-fill)]"),
                )}
                style={{ flexGrow: Math.max(segment.value, 0), flexBasis: 0 }}
              >
                {hovered && i > 0 ? bar(i, "left") : null}
                {hovered && i < segments.length - 1 ? bar(i + 1, "right") : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex w-full font-mono text-[11px] leading-[14px] tabular-nums">
        {segments.map((segment, i) => {
          const px = (segment.value / safeTotal) * trackWidth;
          const hidden = trackWidth > 0 && px < PHASE_CAPTION_MIN_PX;
          return (
            <span
              key={`${segment.caption}-${i}`}
              className={cn(
                "min-w-0 truncate text-center transition-colors duration-150",
                hover === i
                  ? "text-[color:var(--sp-fg)]"
                  : segment.kind === "phase"
                    ? "text-[color:var(--sp-fg-dim)]"
                    : "text-[color:var(--sp-label)]",
                hidden && "invisible",
              )}
              style={{ flexGrow: Math.max(segment.value, 0), flexBasis: 0 }}
              title={`${segment.caption} · ${segment.value}`}
            >
              {segment.value}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function SettingPlayer({
  label,
  segments,
  min = 0,
  step = 10,
  unit = "ms",
  controller,
  onChange,
  reduceMotion,
  locale = "ru",
  modified,
  onResetValue,
  info,
  icon,
}: {
  label: string;
  segments: readonly PlayerSegment[];
  min?: number;
  step?: number;
  unit?: string;
  controller: PlayerController;
  onChange: (values: number[]) => void;
  reduceMotion: boolean;
  locale?: PanelLocale;
} & ResetDotProps) {
  const open = usePlayerOpen(controller);
  const [mode, setMode] = useState<"player" | "phases">("player");
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const maxTotal = segments.reduce((sum, s) => sum + s.max, 0);
  const minTotal = min * segments.length;
  const aria = unit ? `${label} (${unit})` : label;

  function applyTotal(nextTotal: number) {
    const clamped = clampNumber(snapStep(nextTotal, step), minTotal, maxTotal);
    if (total <= 0) {
      const share = snapStep(clamped / segments.length, step);
      const next = segments.map(() => share);
      next[next.length - 1] = clamped - share * (segments.length - 1);
      onChange(next);
      return;
    }
    const next = segments.map((s) => snapStep((s.value / total) * clamped, step));
    const drift = clamped - next.reduce((sum, v) => sum + v, 0);
    next[next.length - 1] += drift;
    onChange(next);
  }

  return (
    <div className={cn("flex flex-col", open && "gap-2")}>
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
            label={open ? tx(PANEL_COPY.closePlayer(label), locale) : tx(PANEL_COPY.openPlayer(label), locale)}
            expanded={open}
            onClick={() => controller.setOpen(!open)}
            className={cn(
              "absolute top-0 right-full mr-1",
              !reduceMotion && "transition-opacity",
              open
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
            <SfSymbol name="playpause" className="size-5" />
          </FieldButton>
          <NumberField
            ariaLabel={aria}
            max={maxTotal}
            min={minTotal}
            onCommit={applyTotal}
            step={step}
            unit={unit}
            value={total}
          />
        </div>
      </div>
      <div
        className={cn(
          "grid",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          !reduceMotion && "transition-[grid-template-rows,opacity]",
        )}
        style={{
          opacity: open ? 1 : 0,
          ...(reduceMotion
            ? {}
            : {
                transitionDuration: open
                  ? `${SECTION_MS}ms`
                  : `${Math.round(SECTION_MS * 0.7)}ms`,
                transitionTimingFunction: EASE_OUT,
              }),
        }}
        inert={open ? undefined : true}
      >
        <div className="min-h-0 overflow-hidden">
          {open ? (
            <SettingPlayerOpen
              controller={controller}
              label={label}
              locale={locale}
              min={min}
              mode={mode}
              onChange={onChange}
              onMode={setMode}
              reduceMotion={reduceMotion}
              segments={segments}
              step={step}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SettingPlayerOpen({
  controller,
  label,
  locale,
  min,
  mode,
  onChange,
  onMode,
  reduceMotion,
  segments,
  step,
}: {
  controller: PlayerController;
  label: string;
  locale: PanelLocale;
  min: number;
  mode: "player" | "phases";
  onChange: (values: number[]) => void;
  onMode: (mode: "player" | "phases") => void;
  reduceMotion: boolean;
  segments: readonly PlayerSegment[];
  step: number;
}) {
  return (
    <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
      <SettingToggle
        label={tx(PANEL_COPY.playerMode, locale)}
        value={mode === "phases"}
        onChange={(next) => onMode(next ? "phases" : "player")}
        offLabel={tx(PANEL_COPY.player, locale)}
        onLabel={tx(PANEL_COPY.phases, locale)}
        control="segment"
        controlWidth={136}
        reduceMotion={reduceMotion}
      />
      {mode === "phases" ? (
        <PhasesTrack
          ariaLabel={tx(PANEL_COPY.playerPhases(label), locale)}
          segments={segments}
          min={min}
          step={step}
          onChange={onChange}
        />
      ) : (
        <SettingPlayerTransport
          controller={controller}
          label={label}
          locale={locale}
          reduceMotion={reduceMotion}
          segments={segments}
        />
      )}
    </div>
  );
}

function SettingPlayerTransport({
  controller,
  label,
  locale,
  reduceMotion,
  segments,
}: {
  controller: PlayerController;
  label: string;
  locale: PanelLocale;
  reduceMotion: boolean;
  segments: readonly PlayerSegment[];
}) {
  const state = usePlayerState(controller);
  return (
    <>
      <PlayerTrack
        ariaLabel={tx(PANEL_COPY.playerPosition(label), locale)}
        state={state}
        controller={controller}
        segments={segments}
      />
      <TransportRow
        label={label}
        state={state}
        controller={controller}
        segments={segments}
        locale={locale}
      />
      <SettingToggle
        label={tx(PANEL_COPY.scrollView, locale)}
        value={state.scrollView}
        onChange={(next) => controller.setScrollView(next)}
        onLabel={tx(PANEL_COPY.on, locale)}
        offLabel={tx(PANEL_COPY.off, locale)}
        reduceMotion={reduceMotion}
      />
    </>
  );
}
