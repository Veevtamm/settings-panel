"use client";

import { parseBezierInput } from "../lib/cubic-bezier";
import {
  easingForPreset,
  easingPresetOptions,
  presetCurvePath,
  type ExtraEasingPreset,
} from "../lib/easing-presets";
import { SfSymbol } from "../sf-symbol";

/** Panel / Icon 14×14 easing glyphs (`Symbol=Linear|Ease|…`). Custom bezier = 􃈟. */
export const PRESET_CURVE_D: Record<string, string> = {
  linear: "M0.75 14.75L14.75 0.75",
  ease: "M0.75 14.75C4.25 13.35 4.25 0.75 14.75 0.75",
  "ease-in": "M0.75 14.75C6.63 14.75 14.75 0.75 14.75 0.75",
  "ease-out": "M0.75 14.75C0.75 14.75 8.87 0.75 14.75 0.75",
  "ease-in-out": "M0.75 14.75C6.63 14.75 8.87 0.75 14.75 0.75",
  easeOutQuad: "M0.75 14.75C7.75 0.75 13.21 0.75 14.75 0.75",
  easeOutCubic: "M0.75 14.75C5.37 0.75 10.27 0.75 14.75 0.75",
  easeOutQuart: "M0.75 14.75C4.25 0.75 7.75 0.75 14.75 0.75",
  easeOutExpo: "M0.75 14.75C2.99 0.75 4.95 0.75 14.75 0.75",
  easeInOutQuart: "M0.75 14.75C11.39 14.75 4.11 0.75 14.75 0.75",
  easeInOutExpo: "M0.75 14.75C12.93 14.75 2.57 0.75 14.75 0.75",
  easeInOutBack: "M0.75 13.538C10.27 20.483 5.23 -4.983 14.75 1.962",
};

export function PresetCurveIcon({
  id,
  extras = [],
}: {
  id: string;
  extras?: readonly ExtraEasingPreset[];
}) {
  const stroke = {
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (id === "custom") {
    return (
      <span
        aria-hidden
        className="relative size-[14px] shrink-0 overflow-hidden"
      >
        <SfSymbol
          name="function-square"
          className="pointer-events-none absolute size-5"
          style={{ left: -2, top: -3 }}
        />
      </span>
    );
  }

  const extraEase = easingForPreset(id, extras);
  const extraCurve = extraEase ? parseBezierInput(extraEase) : null;
  const d =
    PRESET_CURVE_D[id] ?? (extraCurve ? presetCurvePath(extraCurve) : undefined);
  if (!d) return <span aria-hidden className="size-[14px] shrink-0" />;
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-[14px] shrink-0 overflow-hidden"
    >
      <path d={d} {...stroke} />
    </svg>
  );
}

export const PRESET_OPTIONS = easingPresetOptions();
