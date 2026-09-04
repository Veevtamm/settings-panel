"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { SfSymbol } from "../sf-symbol";
import { clampNumber, cn } from "../lib/utils";
import { FIELD, MUTED, fieldChrome } from "./chrome";
import { SettingRow } from "./row";
import type { ResetDotProps } from "./types";

const CHIP_STEP_PX = 32;
const CHIP_DRAG_PX = 6;

function parseChipList(raw: string, min: number, max: number): number[] {
  const nums: number[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    if (!part) continue;
    const n = Number.parseInt(part, 10);
    if (!Number.isFinite(n)) continue;
    nums.push(clampNumber(Math.round(n), min, max));
  }
  return nums;
}

/**
 * Chip list 28×28: drag to reorder, wheel / ↑↓ to change value,
 * × to remove (≥1), dashed plus to add.
 */
export function SettingChips({
  label,
  min,
  max,
  maxItems = 6,
  onChange,
  value,
  ...dots
}: {
  label: string;
  min: number;
  max: number;
  maxItems?: number;
  onChange: (value: string) => void;
  value: string;
} & ResetDotProps) {
  const values = parseChipList(value, min, max);
  const valuesRef = useRef(values);
  const listRef = useRef<HTMLDivElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragRef = useRef<{ index: number; startX: number; moved: boolean } | null>(
    null,
  );

  const commitRef = useRef(onChange);
  useEffect(() => {
    valuesRef.current = values;
    commitRef.current = onChange;
  });
  const commit = (next: number[]) => commitRef.current(next.join(", "));

  const stepChip = (index: number, delta: number) => {
    const current = valuesRef.current;
    if (index < 0 || index >= current.length) return;
    const next = [...current];
    next[index] = clampNumber(next[index] + delta, min, max);
    if (next[index] !== current[index]) commit(next);
  };

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onWheel = (event: WheelEvent) => {
      const chip = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-chip-index]",
      );
      if (!chip) return;
      event.preventDefault();
      if (event.deltaY === 0) return;
      stepChip(Number(chip.dataset.chipIndex), event.deltaY < 0 ? 1 : -1);
    };
    list.addEventListener("wheel", onWheel, { passive: false });
    return () => list.removeEventListener("wheel", onWheel);
  }, [max, min]);

  const onChipPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.button !== 0) return;
    dragRef.current = { index, startX: event.clientX, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onChipPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moved && Math.abs(event.clientX - drag.startX) < CHIP_DRAG_PX)
      return;
    drag.moved = true;
    const list = listRef.current;
    if (!list) return;
    const rect = list.getBoundingClientRect();
    const count = valuesRef.current.length;
    const target = clampNumber(
      Math.floor((event.clientX - rect.left) / CHIP_STEP_PX),
      0,
      count - 1,
    );
    if (target !== drag.index) {
      const next = [...valuesRef.current];
      const [moved] = next.splice(drag.index, 1);
      next.splice(target, 0, moved);
      drag.index = target;
      commit(next);
    }
    setDragIndex(drag.index);
  };

  const endChipDrag = () => {
    dragRef.current = null;
    setDragIndex(null);
  };

  const removeChip = (index: number) => {
    const current = valuesRef.current;
    if (current.length <= 1) return;
    commit(current.filter((_, i) => i !== index));
  };

  return (
    <SettingRow label={label} {...dots}>
      <div ref={listRef} className="flex shrink-0 items-center gap-1">
        {values.map((chipValue, index) => (
          <div key={index} className="group/chip relative">
            <button
              type="button"
              data-chip-index={index}
              aria-label={`${label}, chip ${index + 1}`}
              title="Drag to reorder; wheel or ↑↓ to change value"
              onPointerDown={(event) => onChipPointerDown(event, index)}
              onPointerMove={onChipPointerMove}
              onPointerUp={endChipDrag}
              onPointerCancel={endChipDrag}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                  event.preventDefault();
                  const step = event.shiftKey ? 10 : 1;
                  stepChip(index, event.key === "ArrowUp" ? step : -step);
                } else if (
                  event.key === "Backspace" ||
                  event.key === "Delete"
                ) {
                  event.preventDefault();
                  removeChip(index);
                }
              }}
              className={cn(
                "flex size-[28px] touch-none items-center justify-center rounded text-[14px] font-sans leading-[18px] select-none",
                "cursor-grab active:cursor-grabbing",
                fieldChrome,
                dragIndex === index &&
                  "border-[color:var(--sp-line-strong)] bg-[color:var(--sp-fill-strong)]",
              )}
              style={{
                background: dragIndex === index ? undefined : FIELD,
                color: MUTED,
              }}
            >
              {chipValue}
            </button>
            {values.length > 1 ? (
              <button
                type="button"
                aria-label={`${label}: remove chip ${index + 1}`}
                onClick={() => removeChip(index)}
                className="absolute top-0 right-0 z-[1] hidden size-[11px] items-center justify-center rounded-bl rounded-tr bg-[color:var(--sp-knob)] text-[10px] leading-none text-[color:var(--sp-field)] outline-none fine-hover:group-hover/chip:flex"
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
        {values.length < maxItems ? (
          <button
            type="button"
            aria-label={`${label}: add chip`}
            onClick={() =>
              commit([...valuesRef.current, valuesRef.current.at(-1) ?? min])
            }
            className={cn(
              "flex size-[28px] items-center justify-center rounded border border-dashed border-[color:var(--sp-line-mid)]",
              "text-[color:var(--sp-fg-dim)] transition-[border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
              "fine-hover:hover:border-[color:var(--sp-line-strong)] fine-hover:hover:text-[color:var(--sp-muted)]",
              "focus-visible:border-[color:var(--sp-line-focus)] focus-visible:outline-none",
            )}
          >
            <SfSymbol name="plus" className="size-5" />
          </button>
        ) : null}
      </div>
    </SettingRow>
  );
}
