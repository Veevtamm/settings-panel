"use client";

import { useRef, useState } from "react";
import { evalNumberExpression } from "../lib/eval-number-expression";

/** Number on a black row: underlined digits, unit at 50%. Same commit rules as the old field. */
export function NewNumberFace({
  value,
  unit,
  min,
  max,
  step = 1,
  onCommit,
}: {
  value: number;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  onCommit: (next: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const cancel = useRef(false);
  const shown = editing ? draft : String(value);

  function clamp(next: number) {
    const low = min ?? -Infinity;
    const high = max ?? Infinity;
    return Math.min(high, Math.max(low, next));
  }

  function emit(raw: string) {
    const parsed = evalNumberExpression(raw, value);
    if (parsed == null) return;
    onCommit(clamp(parsed));
  }

  function stepBy(dir: 1 | -1, times: number) {
    onCommit(clamp(Number((value + dir * step * times).toFixed(6))));
    setEditing(false);
  }

  return (
    <span className="relative inline-flex h-[18px] items-center gap-1 text-white">
      <span className="group/value relative inline-flex h-[18px] items-center">
        <span
          className={`text-[14px] leading-[18px] whitespace-nowrap decoration-1 underline-offset-[3px] group-hover/value:underline ${editing ? "underline" : ""}`}
        >
          {shown || "0"}
        </span>
        <input
          value={shown}
          aria-label={unit ? `${value} ${unit}` : String(value)}
          onFocus={(event) => {
            setDraft(String(value));
            setEditing(true);
            event.currentTarget.select();
          }}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => {
            const raw = event.currentTarget.value.trim();
            if (!cancel.current && raw !== "") emit(raw);
            cancel.current = false;
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            else if (event.key === "Escape") {
              cancel.current = true;
              setEditing(false);
              event.currentTarget.blur();
            } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              stepBy(event.key === "ArrowUp" ? 1 : -1, event.shiftKey ? 10 : 1);
            }
          }}
          className="absolute inset-0 h-full w-full appearance-none border-0 bg-transparent p-0 text-left text-[14px] leading-none text-transparent caret-white outline-none"
        />
      </span>
      {unit ? (
        <span className="text-[14px] leading-[18px] whitespace-nowrap text-white/50">
          {unit}
        </span>
      ) : null}
    </span>
  );
}
