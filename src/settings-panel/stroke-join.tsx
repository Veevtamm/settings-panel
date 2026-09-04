"use client";

import { cn } from "../lib/utils";
import { pickerChrome } from "./chrome";
import { L, tx, type Copy, type PanelLocale } from "./locale";
import { PickRadioGroup } from "./pick";
import { SettingRow } from "./row";
import type { ResetDotProps } from "./types";

export const STROKE_JOINS = ["miter", "bevel", "round"] as const;
export type StrokeJoin = (typeof STROKE_JOINS)[number];

export const STROKE_JOIN_LABELS: Record<StrokeJoin, Copy> = {
  miter: L("Острый", "Miter"),
  bevel: L("Срез", "Bevel"),
  round: L("Круглый", "Round"),
};

export function isStrokeJoin(value: unknown): value is StrokeJoin {
  return (
    typeof value === "string" &&
    (STROKE_JOINS as readonly string[]).includes(value)
  );
}

/** Figma default. `1 / sin(28.96° / 2)` ≈ SVG `stroke-miterlimit` 4. */
export const DEFAULT_MITER_ANGLE = 28.96;

export function miterAngleToLimit(deg: number): number {
  const sine = Math.sin((deg * Math.PI) / 360);
  if (sine <= 1e-6) return 100;
  return Math.min(100, 1 / sine);
}

const JOIN_PATH: Record<StrokeJoin, string> = {
  miter: "M3 17V3h14v5H8v9H3Z",
  bevel: "M3 17V8.5L8.5 3H17v5H8.5V17H3Z",
  round: "M3 17V8.5A5.5 5.5 0 0 1 8.5 3H17v5H8.5V17H3Z",
};

function JoinGlyph({ join }: { join: StrokeJoin }) {
  return (
    <svg
      aria-hidden
      className="pointer-events-none block size-5"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path d={JOIN_PATH[join]} />
    </svg>
  );
}

export function SettingStrokeJoin({
  label,
  value,
  onChange,
  locale = "ru",
  ...dots
}: {
  label: string;
  value: StrokeJoin;
  onChange: (value: StrokeJoin) => void;
  locale?: PanelLocale;
} & ResetDotProps) {
  return (
    <SettingRow label={label} {...dots} locale={locale}>
      <PickRadioGroup
        label={label}
        className={cn(
          "grid h-[28px] w-[86px] shrink-0 grid-cols-[28px_1px_28px_1px_28px]",
          pickerChrome,
        )}
        options={STROKE_JOINS}
        selected={value}
        onChange={onChange}
        optionLabel={(join) => tx(STROKE_JOIN_LABELS[join], locale)}
        optionGlyph={(join) => <JoinGlyph join={join} />}
      />
    </SettingRow>
  );
}
