"use client";

import { formatBezierInput, type CubicBezier } from "../lib/cubic-bezier";
import { cn } from "../lib/utils";
import { SfSymbol } from "../sf-symbol";
import { MUTED } from "./chrome";
import { FieldButton, NumberInput } from "./fields";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";
import { useCopyFlash } from "./use-copy-flash";

const KEYS = ["x1", "y1", "x2", "y2"] as const;

export function BezierCoordsRow({
  locale,
  onChange,
  storageLabel,
  value,
}: {
  locale: PanelLocale;
  onChange: (next: CubicBezier) => void;
  storageLabel: string;
  value: CubicBezier;
}) {
  const { copied, copy } = useCopyFlash();

  function patch(key: (typeof KEYS)[number], next: number) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="flex h-[28px] min-w-0 w-full items-center gap-1">
      <FieldButton
        label={tx(PANEL_COPY.copyBezier, locale)}
        onClick={() => {
          void copy(formatBezierInput(value));
        }}
      >
        <SfSymbol name={copied ? "check" : "file"} className="size-5" />
      </FieldButton>
      <div
        className={cn(
          "group/coords relative grid h-[28px] min-w-0 flex-1 overflow-hidden rounded",
          "grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)_1px_minmax(0,1fr)_1px_minmax(0,1fr)]",
          "bg-[color:var(--sp-field)]",
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded border border-[color:var(--sp-line-mid)]",
            "transition-[border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
            "fine-hover:group-hover/coords:border-[color:var(--sp-line-strong)]",
            "group-focus-within/coords:border-[color:var(--sp-line-focus)]",
          )}
        />
        {KEYS.map((key, index) => (
          <span key={key} className="contents">
            {index > 0 ? (
              <div aria-hidden className="bg-[color:var(--sp-fill-strong)]" />
            ) : null}
            <label
              className="flex h-[28px] min-w-0 items-center justify-between gap-0.5 px-1.5"
              style={{ color: MUTED }}
            >
              <NumberInput
                ariaLabel={`${storageLabel} ${key}`}
                min={key === "x1" || key === "x2" ? 0 : -99}
                max={key === "x1" || key === "x2" ? 1 : 99}
                step={0.01}
                value={value[key]}
                onCommit={(next) => {
                  const clamped =
                    key === "x1" || key === "x2"
                      ? Math.min(1, Math.max(0, next))
                      : next;
                  patch(key, clamped);
                }}
              />
              <span
                className="pointer-events-none shrink-0 font-sans text-[14px] leading-[18px] opacity-50"
                aria-hidden
              >
                {key}
              </span>
            </label>
          </span>
        ))}
      </div>
    </div>
  );
}
