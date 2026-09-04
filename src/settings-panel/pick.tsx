"use client";

import type { ReactNode } from "react";
import { SfSymbol, type SfSymbolName } from "../sf-symbol";
import { cn } from "../lib/utils";
import { pickActive, pickEase, pickIdle, pickerChrome } from "./chrome";
import { isMember } from "./model";
import { SettingRow, RowLabel } from "./row";
import {
  ANCHOR_COPY,
  FRAME_ORIENT_COPY,
  TEXT_ALIGN_COPY,
  tx,
  type PanelLocale,
} from "./locale";
import {
  SETTING_ANCHORS,
  SETTING_FRAME_ORIENTS,
  SETTING_TEXT_ALIGNS,
  SETTING_X_ANCHORS,
  type ResetDotProps,
  type SettingAnchor,
  type SettingFrameOrient,
  type SettingTextAlign,
  type SettingXAnchor,
} from "./types";

const FIT_GLYPH: Record<(typeof SETTING_X_ANCHORS)[number], SfSymbolName> = {
  left: "align-start-vertical",
  center: "align-center-vertical",
  right: "align-end-vertical",
};
const TEXT_ALIGN_GLYPH: Record<SettingTextAlign, SfSymbolName> = {
  left: "align-left",
  center: "align-center",
  right: "align-right",
  justify: "align-justify",
};

function anchorLabel(anchor: SettingAnchor, locale: PanelLocale) {
  return tx(ANCHOR_COPY[anchor], locale);
}

/** 12 box, inset 1, filled weight 6, rx 1 — one path so corners do not double-paint. */
export const ANCHOR_GLYPH: Record<
  SettingAnchor,
  { type: "rect"; x: number; y: number; w: number; h: number } | { type: "path"; d: string }
> = {
  "top left": {
    type: "path",
    d: "M2 1H10A1 1 0 0 1 11 2V6A1 1 0 0 1 10 7H8A1 1 0 0 0 7 8V10A1 1 0 0 1 6 11H2A1 1 0 0 1 1 10V2A1 1 0 0 1 2 1Z",
  },
  top: { type: "rect", x: 1, y: 1, w: 10, h: 6 },
  "top right": {
    type: "path",
    d: "M2 1H10A1 1 0 0 1 11 2V10A1 1 0 0 1 10 11H6A1 1 0 0 1 5 10V8A1 1 0 0 0 4 7H2A1 1 0 0 1 1 6V2A1 1 0 0 1 2 1Z",
  },
  left: { type: "rect", x: 1, y: 1, w: 6, h: 10 },
  center: { type: "rect", x: 3, y: 3, w: 6, h: 6 },
  right: { type: "rect", x: 5, y: 1, w: 6, h: 10 },
  "bottom left": {
    type: "path",
    d: "M2 1H6A1 1 0 0 1 7 2V4A1 1 0 0 0 8 5H10A1 1 0 0 1 11 6V10A1 1 0 0 1 10 11H2A1 1 0 0 1 1 10V2A1 1 0 0 1 2 1Z",
  },
  bottom: { type: "rect", x: 1, y: 5, w: 10, h: 6 },
  "bottom right": {
    type: "path",
    d: "M6 1H10A1 1 0 0 1 11 2V10A1 1 0 0 1 10 11H2A1 1 0 0 1 1 10V6A1 1 0 0 1 2 5H4A1 1 0 0 0 5 4V2A1 1 0 0 1 6 1Z",
  },
};

export function AnchorGlyph({
  anchor,
  className,
}: {
  anchor: SettingAnchor;
  className?: string;
}) {
  const glyph = ANCHOR_GLYPH[anchor];
  return (
    <svg
      aria-hidden
      className={cn("pointer-events-none block size-3", className)}
      fill="currentColor"
      viewBox="0 0 12 12"
    >
      {glyph.type === "path" ? (
        <path d={glyph.d} />
      ) : (
        <rect x={glyph.x} y={glyph.y} width={glyph.w} height={glyph.h} rx="1" />
      )}
    </svg>
  );
}

export function isSettingAnchor(value: unknown): value is SettingAnchor {
  return isMember(value, SETTING_ANCHORS);
}

export function isSettingXAnchor(value: unknown): value is SettingXAnchor {
  return isMember(value, SETTING_X_ANCHORS);
}

export function isSettingTextAlign(value: unknown): value is SettingTextAlign {
  return isMember(value, SETTING_TEXT_ALIGNS);
}

export function isSettingFrameOrient(value: unknown): value is SettingFrameOrient {
  return isMember(value, SETTING_FRAME_ORIENTS);
}

export const FRAME_ORIENT_GLYPH: Record<SettingFrameOrient, SfSymbolName> = {
  square: "square",
  portrait: "rectangle-vertical",
  landscape: "rectangle-horizontal",
};

export function FrameOrientGlyph({
  orient,
  className,
}: {
  orient: SettingFrameOrient;
  className?: string;
}) {
  return (
    <SfSymbol
      name={FRAME_ORIENT_GLYPH[orient]}
      className={cn("pointer-events-none block size-5", className)}
    />
  );
}

export function SettingFrameOrient({
  label,
  onChange,
  value,
  locale = "ru",
  modified,
  onResetValue,
  info,
  icon,
  onIconChange,
}: {
  label: string;
  locale?: PanelLocale;
  onChange: (value: SettingFrameOrient) => void;
  value: string;
} & ResetDotProps) {
  const selected = isSettingFrameOrient(value) ? value : "square";
  return (
    <SettingRow
      label={label}
      modified={modified}
      onResetValue={onResetValue}
      info={info}
      icon={icon}
      onIconChange={onIconChange}
      locale={locale}
    >
      <PickRadioGroup
        label={label}
        className={cn(
          "grid h-[28px] w-[86px] shrink-0 grid-cols-[28px_1px_28px_1px_28px]",
          pickerChrome,
        )}
        options={SETTING_FRAME_ORIENTS}
        selected={selected}
        onChange={onChange}
        optionLabel={(orient) => tx(FRAME_ORIENT_COPY[orient], locale)}
        optionGlyph={(orient) => <FrameOrientGlyph orient={orient} />}
      />
    </SettingRow>
  );
}

export function PickRadioGroup<T extends string>({
  label,
  className,
  onChange,
  optionGlyph,
  optionLabel,
  options,
  selected,
}: {
  label: string;
  className: string;
  onChange: (value: T) => void;
  optionGlyph: (value: T) => ReactNode;
  optionLabel: (value: T) => string;
  options: readonly T[];
  selected: T;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={className}>
      {options.flatMap((option, index) => {
        const active = option === selected;
        const cell = (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={optionLabel(option)}
            onClick={() => onChange(option)}
            className={cn(
              "flex size-[28px] items-center justify-center outline-none",
              pickEase,
              active ? pickActive : pickIdle,
            )}
          >
            {optionGlyph(option)}
          </button>
        );
        if (index === options.length - 1) return [cell];
        return [
          cell,
          <div
            key={`rule-${option}`}
            aria-hidden
            className="bg-[color:var(--sp-fill-strong)]"
          />,
        ];
      })}
    </div>
  );
}

export function SettingXAnchor({
  label,
  onChange,
  value,
  locale = "ru",
  modified,
  onResetValue,
  info,
  icon,
  onIconChange,
}: {
  label: string;
  locale?: PanelLocale;
  onChange: (value: SettingXAnchor) => void;
  value: string;
} & ResetDotProps) {
  const selected = isSettingXAnchor(value) ? value : "center";
  return (
    <SettingRow
      label={label}
      modified={modified}
      onResetValue={onResetValue}
      info={info}
      icon={icon}
      onIconChange={onIconChange}
      locale={locale}
    >
      <PickRadioGroup
        label={label}
        className={cn(
          "grid h-[28px] w-[86px] shrink-0 grid-cols-[28px_1px_28px_1px_28px]",
          pickerChrome,
        )}
        options={SETTING_X_ANCHORS}
        selected={selected}
        onChange={onChange}
        optionLabel={(anchor) => anchorLabel(anchor, locale)}
        optionGlyph={(anchor) => (
          <SfSymbol
            name={FIT_GLYPH[anchor]}
            className="pointer-events-none block size-5"
          />
        )}
      />
    </SettingRow>
  );
}

export function SettingTextAlign({
  label,
  onChange,
  value,
  locale = "ru",
  modified,
  onResetValue,
  info,
  icon,
  onIconChange,
}: {
  label: string;
  locale?: PanelLocale;
  onChange: (value: SettingTextAlign) => void;
  value: string;
} & ResetDotProps) {
  const selected = isSettingTextAlign(value) ? value : "left";
  return (
    <SettingRow
      label={label}
      modified={modified}
      onResetValue={onResetValue}
      info={info}
      icon={icon}
      onIconChange={onIconChange}
      locale={locale}
    >
      <PickRadioGroup
        label={label}
        className={cn(
          "grid h-[28px] w-[115px] shrink-0 grid-cols-[28px_1px_28px_1px_28px_1px_28px]",
          pickerChrome,
        )}
        options={SETTING_TEXT_ALIGNS}
        selected={selected}
        onChange={onChange}
        optionLabel={(align) => tx(TEXT_ALIGN_COPY[align], locale)}
        optionGlyph={(align) => (
          <SfSymbol
            name={TEXT_ALIGN_GLYPH[align]}
            className="pointer-events-none block size-5"
          />
        )}
      />
    </SettingRow>
  );
}

export function SettingAnchor({
  label,
  onChange,
  value,
  locale = "ru",
  modified,
  onResetValue,
  info,
  icon,
  onIconChange,
}: {
  label: string;
  locale?: PanelLocale;
  onChange: (value: SettingAnchor) => void;
  value: string;
} & ResetDotProps) {
  const selected = isSettingAnchor(value) ? value : "center";
  return (
    <div
      className="group flex items-start justify-between gap-4"
      data-setting-row=""
    >
      <RowLabel
        label={label}
        className="pt-[5px]"
        modified={modified}
        onResetValue={onResetValue}
        info={info}
        icon={icon}
        onIconChange={onIconChange}
        locale={locale}
      />
      <div
        role="radiogroup"
        aria-label={label}
        className={cn(
          "grid h-[86px] w-[86px] shrink-0 grid-cols-[28px_1px_28px_1px_28px] grid-rows-[28px_1px_28px_1px_28px]",
          pickerChrome,
        )}
      >
        {Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: 5 }, (_, col) => {
            if (row % 2 === 1 || col % 2 === 1) {
              return (
                <div
                  key={`rule-${row}-${col}`}
                  aria-hidden
                  className="bg-[color:var(--sp-fill-strong)]"
                />
              );
            }
            const anchor = SETTING_ANCHORS[(row / 2) * 3 + col / 2];
            if (!anchor) return null;
            const active = anchor === selected;
            return (
              <button
                key={anchor}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={anchorLabel(anchor, locale)}
                onClick={() => onChange(anchor)}
                className={cn(
                  "flex size-[28px] items-center justify-center outline-none",
                  pickEase,
                  active ? pickActive : pickIdle,
                )}
              >
                <AnchorGlyph anchor={anchor} />
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
