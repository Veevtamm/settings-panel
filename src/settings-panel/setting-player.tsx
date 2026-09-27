"use client";

import { useEffect, useState } from "react";
import {
  autoTotal,
  fitClipsToTotal,
  isTotalAuto,
  resolveTotal,
} from "../lib/player-clips";
import { SfSymbol } from "../sf-symbol";
import { clampNumber, cn } from "../lib/utils";
import { CHEVRON_MS, EASE_OUT, MUTED, SECTION_MS } from "./chrome";
import { AutoNumberField, FieldButton, NumberField, SettingToggle } from "./fields";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";
import { snapStep } from "./number";
import { PhaseLanes } from "./phase-lanes";
import {
  PlayerTrack,
  TransportRow,
  emitClips,
  layoutOf,
  segmentSpanMax,
  usePlayerOpen,
  usePlayerState,
  type PlayerClipsChange,
  type PlayerSegment,
} from "./player";
import { RowLabel, SectionCollapse } from "./row";
import type { PlayerController, ResetDotProps } from "./types";

export function SettingPlayer({
  label,
  segments,
  total,
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
  onIconChange,
  totalAuto = false,
}: {
  label: string;
  segments: readonly PlayerSegment[];
  /** Stored timeline length. ≤ 0 + `totalAuto` = Auto (max clip end). */
  total: number;
  min?: number;
  step?: number;
  unit?: string;
  controller: PlayerController;
  onChange: (next: PlayerClipsChange) => void;
  reduceMotion: boolean;
  locale?: PanelLocale;
  totalAuto?: boolean;
} & ResetDotProps) {
  const open = usePlayerOpen(controller);
  const [phasesOpen, setPhasesOpen] = useState(true);
  const layout = layoutOf(segments);
  const auto = totalAuto && isTotalAuto(total);
  const scale = resolveTotal(total, layout, min, totalAuto);
  const maxTotal = Math.max(
    scale,
    segments.reduce((sum, s) => sum + segmentSpanMax(s), 0),
  );
  const aria = unit ? `${label} (${unit})` : label;

  /** The ms field sets the timeline length; phases keep their times and only get trimmed if they no longer fit. */
  function applyTotal(nextTotal: number) {
    const clamped = clampNumber(snapStep(nextTotal, step), min, maxTotal);
    onChange(
      emitClips(fitClipsToTotal(layout, clamped, min), clamped, segments),
    );
  }

  function unlockTotal() {
    applyTotal(autoTotal(layout, min));
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
          onIconChange={onIconChange}
          locale={locale}
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
            <SfSymbol name="circle-play" className="size-5" />
          </FieldButton>
          {auto ? (
            <AutoNumberField
              ariaLabel={tx(PANEL_COPY.unlockTotal, locale)}
              label={tx(PANEL_COPY.totalAuto, locale)}
              onUnlock={unlockTotal}
            />
          ) : (
            <NumberField
              ariaLabel={aria}
              max={maxTotal}
              min={min}
              onCommit={applyTotal}
              step={step}
              unit={unit}
              value={scale}
            />
          )}
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
              phasesOpen={phasesOpen}
              onChange={onChange}
              onPhasesOpen={setPhasesOpen}
              reduceMotion={reduceMotion}
              segments={segments}
              step={step}
              stretch={auto}
              total={scale}
              unit={unit}
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
  phasesOpen,
  onChange,
  onPhasesOpen,
  reduceMotion,
  segments,
  step,
  stretch = false,
  total,
  unit,
}: {
  controller: PlayerController;
  label: string;
  locale: PanelLocale;
  min: number;
  phasesOpen: boolean;
  onChange: (next: PlayerClipsChange) => void;
  onPhasesOpen: (open: boolean) => void;
  reduceMotion: boolean;
  segments: readonly PlayerSegment[];
  step: number;
  stretch?: boolean;
  total: number;
  unit?: string;
}) {
  const layout = layoutOf(segments);
  const layoutKey = segments
    .map((segment) => `${segment.start ?? "p"}:${segment.value}`)
    .join("|");

  useEffect(() => {
    const solo = controller.getState().solo;
    if (solo == null || total <= 0) return;
    const clip = layout[solo.phase];
    if (!clip) {
      controller.setSolo(null);
      return;
    }
    const from = clip.start / total;
    const to = clip.end / total;
    if (
      Math.abs(from - solo.from) < 0.0005 &&
      Math.abs(to - solo.to) < 0.0005
    ) {
      return;
    }
    controller.setSolo({ phase: solo.phase, from, to });
  }, [controller, layout, layoutKey, total]);

  const phasesTitle = tx(PANEL_COPY.phases, locale);

  return (
    <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
      <SettingPlayerTransport
        controller={controller}
        label={label}
        locale={locale}
        reduceMotion={reduceMotion}
        segments={segments}
        total={total}
        unit={unit}
      />
      <div className="flex flex-col">
        <div className="flex h-[28px] items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onPhasesOpen(!phasesOpen)}
            aria-expanded={phasesOpen}
            className="flex min-w-0 flex-1 cursor-pointer items-center text-left outline-none"
          >
            <span
              className="truncate font-sans text-[15px] leading-[20px] select-none"
              style={{ color: MUTED }}
            >
              {phasesTitle}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onPhasesOpen(!phasesOpen)}
            aria-expanded={phasesOpen}
            aria-label={
              phasesOpen
                ? tx(PANEL_COPY.collapse(phasesTitle), locale)
                : tx(PANEL_COPY.expand(phasesTitle), locale)
            }
            className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center outline-none"
          >
            <SfSymbol
              name="chevron-up"
              className={cn(
                "size-5",
                !reduceMotion && "transition-transform",
                !phasesOpen && "rotate-180",
              )}
              style={
                reduceMotion
                  ? { color: MUTED }
                  : {
                      color: MUTED,
                      transitionDuration: `${CHEVRON_MS}ms`,
                      transitionTimingFunction: EASE_OUT,
                    }
              }
            />
          </button>
        </div>
        <SectionCollapse open={phasesOpen} reduceMotion={reduceMotion}>
          <div className="pt-1">
            <PhaseLanes
              ariaLabel={tx(PANEL_COPY.playerPhases(label), locale)}
              segments={segments}
              total={total}
              min={min}
              step={step}
              stretch={stretch}
              unit={unit}
              onChange={onChange}
              controller={controller}
              locale={locale}
            />
          </div>
        </SectionCollapse>
      </div>
    </div>
  );
}

function SettingPlayerTransport({
  controller,
  label,
  locale,
  reduceMotion,
  segments,
  total,
  unit,
  track = true,
}: {
  controller: PlayerController;
  label: string;
  locale: PanelLocale;
  reduceMotion: boolean;
  segments: readonly PlayerSegment[];
  total: number;
  unit?: string;
  track?: boolean;
}) {
  const state = usePlayerState(controller);
  return (
    <>
      {track ? (
        <PlayerTrack
          ariaLabel={tx(PANEL_COPY.playerPosition(label), locale)}
          state={state}
          controller={controller}
          total={total}
          unit={unit}
        />
      ) : null}
      <TransportRow
        label={label}
        state={state}
        controller={controller}
        segments={segments}
        total={total}
        locale={locale}
        unit={unit}
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
