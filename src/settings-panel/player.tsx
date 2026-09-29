"use client";

import {
  useRef,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  captionsAtQ,
  layoutClips,
  momentMs,
  resolveTotal,
  staggerSpan,
  type ClipInput,
  type ClipStagger,
} from "../lib/player-clips";
import { pinNear } from "../lib/playhead";
import { clampNumber, cn } from "../lib/utils";
import { SfSymbol, type SfSymbolName } from "../sf-symbol";
import { MUTED, pickerChrome, pointerHeld } from "./chrome";
import { FieldButton } from "./fields";
import { useCopyFlash } from "./use-copy-flash";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";
import type {
  PlayerController,
  PlayerSetting,
  PlayerState,
} from "./types";

/** ×1 → ×3 → ×5 → ×10 → ×1: slow-down steps, click cycles. */
const PLAYER_SPEEDS = [1, 3, 5, 10] as const;
/**
 * Shared time scale for lanes + ruler (Figma `07 Timeline` `445:4349`).
 * 0 and total sit 3px in — same as the clip’s left/right, so adjacent clips touch.
 */
export const LANE_PAD_PX = 3;
/** q=0 and q=1 sit this far inside the Player Track field so the 1px border doesn't clip them. */
export const TRACK_PAD_PX = 2;


export type SegmentStagger = ClipStagger & {
  stepMax: number;
  /** Child lane label without the number. */
  caption: string;
};

export type PlayerSegment = {
  /** Stable id (phase setting key) — timeline row order. */
  id?: string;
  caption: string;
  kind: "phase" | "pause";
  /** Ceiling for one line (`value`), not for the staggered span. */
  max: number;
  /** Duration of the clip, or of one line when `stagger` is set. */
  value: number;
  start?: number;
  stagger?: SegmentStagger;
};

type SegmentTimes = {
  caption?: string;
  value: number;
  start?: number;
  kind?: "phase" | "pause";
  stagger?: ClipStagger;
};

export type PlayerClipsChange = {
  /** Clip duration, or one line's duration for a staggered phase. */
  durations: number[];
  starts: (number | undefined)[];
  /** Timeline length — unchanged unless the ms field was edited. */
  total: number;
  /** Stagger step per phase; `undefined` for plain phases. */
  steps?: (number | undefined)[];
};

export function inputsOf(segments: readonly SegmentTimes[]): ClipInput[] {
  return segments.map((segment) => {
    const duration = staggerSpan(segment.value, segment.stagger);
    return segment.start == null ? { duration } : { duration, start: segment.start };
  });
}

export function layoutOf(segments: readonly SegmentTimes[]) {
  return layoutClips(inputsOf(segments));
}

/** Longest a phase clip may get: line `max` plus the stagger offsets. */
export function segmentSpanMax(segment: PlayerSegment) {
  return staggerSpan(segment.max, segment.stagger);
}

/** Layout (spans) → stored values (line durations, starts, steps). `steps` overrides a phase's step. */
export function emitClips(
  layout: readonly { start: number; duration: number; packed: boolean }[],
  total: number,
  segments: readonly SegmentTimes[],
  steps?: readonly (number | undefined)[],
): PlayerClipsChange {
  const staggerAt = (i: number): ClipStagger | undefined => {
    const stagger = segments[i]?.stagger;
    if (stagger == null) return undefined;
    return { count: stagger.count, step: steps?.[i] ?? stagger.step };
  };
  return {
    durations: layout.map((clip, i) => {
      const stagger = staggerAt(i);
      return Math.max(0, clip.duration - staggerSpan(0, stagger));
    }),
    starts: layout.map((clip) => (clip.packed ? undefined : clip.start)),
    total,
    steps: segments.map((_, i) => staggerAt(i)?.step),
  };
}

/** One `PlayerSegment` per phase — dock, in-panel player and HUD read the same shape. */
export function playerSegments<TSettings>(
  player: PlayerSetting<TSettings>,
  settings: TSettings,
  locale: PanelLocale,
): PlayerSegment[] {
  return player.phases.map((phase) => ({
    id: String(phase.key),
    caption: tx(phase.caption, locale),
    kind: phase.kind,
    max: phase.max,
    value: Number(settings[phase.key]),
    start:
      phase.startKey != null ? Number(settings[phase.startKey]) : undefined,
    stagger:
      phase.stagger == null
        ? undefined
        : {
            count: phase.stagger.count,
            step: Number(settings[phase.stagger.stepKey]),
            stepMax: phase.stagger.stepMax ?? phase.max,
            caption: tx(
              phase.stagger.caption ?? PANEL_COPY.staggerLine,
              locale,
            ),
          },
  }));
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

/** `Reel · 651 ms — фаза 1` — HUD and copy share this line; URL is appended on copy. `total` = timeline ms. */
export function formatMoment(
  label: string,
  q: number,
  segments: readonly SegmentTimes[],
  total: number,
  unit = "ms",
) {
  const names = captionsAtQ(
    layoutOf(segments),
    segments.map((segment) =>
      segment.kind === "pause" ? "" : (segment.caption ?? ""),
    ),
    q,
    total,
  );
  const at = momentMs(total, q);
  return names.length
    ? `${label} · ${at} ${unit} — ${names.join(" + ")}`
    : `${label} · ${at} ${unit}`;
}

export function momentCopyText(
  label: string,
  playerId: string,
  q: number,
  segments: readonly SegmentTimes[],
  total: number,
  unit = "ms",
) {
  return `${formatMoment(label, q, segments, total, unit)}\n${momentUrl(playerId, q)}`;
}

export function usePlayerState(controller: PlayerController): PlayerState {
  return useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );
}

/** Boolean snapshot — q ticks while closed do not re-render the folded row. */
export function usePlayerOpen(controller: PlayerController) {
  return useSyncExternalStore(
    controller.subscribe,
    () => controller.getState().open,
    () => controller.getState().open,
  );
}

export function trackMarkerLeft(q: number, pad: number = TRACK_PAD_PX) {
  return `calc(${pad}px + (100% - ${pad * 2}px) * ${q})`;
}

export function trackQFromClientX(rect: DOMRect, clientX: number, pad: number) {
  const inner = rect.width - pad * 2;
  if (inner <= 0) return 0;
  return clampNumber((clientX - rect.left - pad) / inner, 0, 1);
}

export function trackX(rect: DOMRect, q: number, pad: number) {
  return rect.left + pad + q * (rect.width - pad * 2);
}

/** Patch `totalKey` + phase keys from a timeline/player edit. */
export function patchPlayerClips<TSettings>(
  player: {
    totalKey: keyof TSettings;
    phases: readonly {
      key: keyof TSettings;
      startKey?: keyof TSettings;
      stagger?: { stepKey: keyof TSettings };
    }[];
  },
  next: PlayerClipsChange,
): Partial<TSettings> {
  return Object.fromEntries(
    player.phases.flatMap((phase, i) => {
      const rows: [keyof TSettings, number][] = [[phase.key, next.durations[i]]];
      if (i === 0) rows.push([player.totalKey, next.total]);
      if (phase.startKey != null && next.starts[i] != null) {
        rows.push([phase.startKey, next.starts[i]]);
      }
      const step = next.steps?.[i];
      if (phase.stagger != null && step != null) {
        rows.push([phase.stagger.stepKey, step]);
      }
      return rows;
    }),
  ) as Partial<TSettings>;
}

export function phaseTimes<TSettings>(
  player: {
    phases: readonly {
      key: keyof TSettings;
      startKey?: keyof TSettings;
      stagger?: { count: number; stepKey: keyof TSettings };
    }[];
  },
  settings: TSettings,
): SegmentTimes[] {
  return player.phases.map((phase) => ({
    value: Number(settings[phase.key]),
    start:
      phase.startKey != null ? Number(settings[phase.startKey]) : undefined,
    stagger:
      phase.stagger == null
        ? undefined
        : {
            count: phase.stagger.count,
            step: Number(settings[phase.stagger.stepKey]),
          },
  }));
}

/** WAAPI / HUD length. When `totalAuto` and stored total ≤ 0, this is max(clip end). */
export function resolvePlayerTotal<TSettings>(
  player: {
    totalKey: keyof TSettings;
    phases: readonly {
      key: keyof TSettings;
      startKey?: keyof TSettings;
      stagger?: { count: number; stepKey: keyof TSettings };
    }[];
    min?: number;
    totalAuto?: boolean;
  },
  settings: TSettings,
): number {
  return resolveTotal(
    Number(settings[player.totalKey]),
    layoutOf(phaseTimes(player, settings)),
    player.min ?? 0,
    !!player.totalAuto,
  );
}

export function PlayerTrack({
  ariaLabel,
  state,
  controller,
  total,
  viewStart = 0,
  viewEnd,
  unit = "ms",
}: {
  ariaLabel: string;
  state: PlayerState;
  controller: PlayerController;
  total: number;
  unit?: string;
  /** B4: visible window start (same unit as total). */
  viewStart?: number;
  viewEnd?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const span = Math.max((viewEnd ?? total) - viewStart, 1);

  function timeToQ(t: number) {
    return (t - viewStart) / span;
  }

  function qFromClientX(clientX: number) {
    const el = trackRef.current;
    if (!el) return state.q;
    const rect = el.getBoundingClientRect();
    const local = trackQFromClientX(rect, clientX, TRACK_PAD_PX);
    if (total <= 0) return 0;
    return clampNumber((viewStart + local * span) / total, 0, 1);
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
    if (!pointerHeld(event)) {
      draggingRef.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
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
      onLostPointerCapture={onPointerUp}
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
        "relative h-[28px] w-full cursor-ew-resize overflow-hidden touch-none select-none outline-none focus-visible:after:border-[color:var(--sp-line-focus)]",
        pickerChrome,
      )}
    >
      {state.solo ? (
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 h-[22px] -translate-y-1/2 rounded-[2px] bg-[color:var(--sp-fill-strong)]"
          style={{
            left: trackMarkerLeft(timeToQ(state.solo.from * total)),
            width: `calc((100% - ${TRACK_PAD_PX * 2}px) * ${Math.max(0, (state.solo.to - state.solo.from) * total / span)})`,
          }}
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-y-0 rounded-l bg-[color:var(--sp-fill)]"
          style={{
            left: trackMarkerLeft(timeToQ(0)),
            width: `calc((100% - ${TRACK_PAD_PX * 2}px) * ${Math.max(0, (state.q * total) / span)})`,
          }}
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 z-20 w-[2px] -translate-x-1/2 bg-[color:var(--sp-knob-off)]"
        style={{ left: trackMarkerLeft(timeToQ(state.q * total)) }}
      />
      {state.pins.map((pin) => {
        const pinLabel = `${momentMs(total, pin)} ${unit}`;
        return (
        <button
          key={pin}
          type="button"
          data-pin=""
          aria-label={pinLabel}
          title={pinLabel}
          onClick={() => controller.seek(pin)}
          className="absolute top-0 z-20 flex h-full w-[10px] -translate-x-1/2 items-center justify-center appearance-none border-0 bg-transparent p-0 outline-none"
          style={{ left: trackMarkerLeft(timeToQ(pin * total)) }}
        >
          <span
            aria-hidden
            className="block h-[12px] w-[2px] rounded-[1px] bg-[color:var(--sp-knob-off)]"
          />
        </button>
        );
      })}
    </div>
  );
}

export function TransportRow({
  label,
  state,
  controller,
  segments,
  total,
  locale,
  unit = "ms",
}: {
  label: string;
  state: PlayerState;
  controller: PlayerController;
  segments: readonly PlayerSegment[];
  total: number;
  locale: PanelLocale;
  unit?: string;
}) {
  const { copied, copy } = useCopyFlash();
  const pinned = pinNear(state.pins, state.q);

  function cycleSpeed() {
    const at = PLAYER_SPEEDS.findIndex((speed) => speed === state.speed);
    controller.setSpeed(PLAYER_SPEEDS[(at < 0 ? 0 : at + 1) % PLAYER_SPEEDS.length]);
  }

  function copyMoment() {
    void copy(
      momentCopyText(label, controller.id, state.q, segments, total, unit),
    );
  }

  const transport: { icon: SfSymbolName; label: string; active: boolean; run: () => void }[] = [
    {
      icon: "skip-back",
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
      icon: "skip-forward",
      label: tx(PANEL_COPY.forward, locale),
      active: state.playing && state.direction === 1,
      run: () => controller.play(1),
    },
  ];

  return (
    <div className="grid h-[28px] grid-cols-[1fr_auto_1fr] items-center">
      <div className="flex items-center gap-1 justify-self-start">
        <SfSymbol name="circle-gauge" className="size-5" style={{ color: MUTED }} />
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
            key={item.icon === "pause" ? "play" : item.icon}
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
          <SfSymbol name={pinned ? "pin-off" : "pin"} className="size-5" />
        </FieldButton>
        <FieldButton label={tx(PANEL_COPY.copyMoment, locale)} onClick={copyMoment}>
          <SfSymbol name={copied ? "check" : "file"} className="size-5" />
        </FieldButton>
      </div>
    </div>
  );
}
