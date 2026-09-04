"use client";

import {
  parseSkipCells,
  serializeSkipCells,
  SKIP_PATTERN_ROWS,
} from "../lib/skip-cells";
import { cn } from "../lib/utils";
import { FIELD, MUTED } from "./chrome";
import { RowLabel, SettingRow } from "./row";
import { SfSymbol } from "../sf-symbol";
import type { ResetDotProps } from "./types";

/**
 * Skip matrix: rows × columns of 16×16 cells. Filled = module, dashed = skip.
 */
export function SettingCells({
  label,
  columns,
  onChange,
  value,
  rows = SKIP_PATTERN_ROWS,
  ...dots
}: {
  label: string;
  columns: number;
  onChange: (value: string) => void;
  value: string;
  rows?: number;
} & ResetDotProps) {
  const grid = parseSkipCells(value, rows);
  const toggle = (row: number, col: number) => {
    const next = grid.map((cols) => [...cols]);
    const at = next[row].indexOf(col);
    if (at >= 0) {
      next[row].splice(at, 1);
    } else {
      next[row] = [...next[row], col].sort((a, b) => a - b);
    }
    onChange(serializeSkipCells(next));
  };
  return (
    <div
      className="group flex w-full items-start justify-between gap-2"
      data-setting-row=""
    >
      <RowLabel label={label} className="pt-[2px]" {...dots} />
      <div role="group" aria-label={label} className="flex shrink-0 flex-col gap-1">
        {grid.map((cols, row) => (
          <div key={row} className="flex gap-1">
            {Array.from({ length: Math.max(1, columns) }, (_, col) => {
              const off = cols.includes(col);
              return (
                <button
                  key={col}
                  type="button"
                  role="checkbox"
                  aria-checked={off}
                  aria-label={`${label}: row ${row + 1}, column ${col + 1}`}
                  title={off ? "Empty cell — click to restore" : "Click to skip"}
                  onClick={() => toggle(row, col)}
                  className={cn(
                    "size-4 shrink-0 rounded-[3px] border outline-none",
                    "transition-[border-color,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
                    off
                      ? "border-dashed border-[color:var(--sp-line-mid)] bg-transparent fine-hover:hover:border-[color:var(--sp-line-strong)]"
                      : "border-[color:var(--sp-line-mid)] fine-hover:hover:border-[color:var(--sp-line-strong)]",
                    "focus-visible:border-[color:var(--sp-line-focus)]",
                  )}
                  style={off ? undefined : { background: FIELD }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Replay 28 — Lucide `rotate-ccw`; used for a new skip seed. */
export function SettingSkipReplay({
  label,
  onShuffle,
  ...dots
}: {
  label: string;
  onShuffle: () => void;
} & ResetDotProps) {
  return (
    <SettingRow label={label} {...dots}>
      <button
        type="button"
        aria-label={`${label}: shuffle`}
        onClick={onShuffle}
        className="inline-flex size-[28px] shrink-0 items-center justify-center rounded border border-[color:var(--sp-line-mid)] outline-none transition-[border-color,background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] fine-hover:hover:border-[color:var(--sp-line-strong)] fine-hover:hover:bg-[color:var(--sp-fill-hover)] focus-visible:border-[color:var(--sp-line-focus)] focus-visible:ring-1 focus-visible:ring-[color:var(--sp-line-mid)] active:scale-[0.97]"
        style={{ background: FIELD, color: MUTED }}
      >
        <SfSymbol name="rotate-ccw" className="size-5" />
      </button>
    </SettingRow>
  );
}
