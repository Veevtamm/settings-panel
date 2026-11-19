"use client";

import { useRef, useState } from "react";

const CELLS = 6;

/** Six black cells. The kit frame «Код» and the admin gate share this field. */
export function CodeField({ onChange }: { onChange?: (code: string) => void }) {
  const [digits, setDigits] = useState<string[]>(() => Array(CELLS).fill(""));
  const cells = useRef<(HTMLInputElement | null)[]>([]);

  function commit(next: string[]) {
    setDigits(next);
    onChange?.(next.join(""));
  }

  function write(index: number, raw: string) {
    const chars = raw.replace(/\D/g, "").slice(0, CELLS - index).split("");
    if (chars.length === 0) return;
    const next = [...digits];
    chars.forEach((char, offset) => {
      if (index + offset < CELLS) next[index + offset] = char;
    });
    commit(next);
    cells.current[Math.min(index + chars.length, CELLS - 1)]?.focus();
  }

  return (
    <span className="flex w-[284px] gap-1">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            cells.current[index] = node;
          }}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Цифра ${index + 1}`}
          value={digit}
          onChange={(event) => write(index, event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key === "Backspace") {
              event.preventDefault();
              const next = [...digits];
              if (next[index]) next[index] = "";
              else if (index > 0) next[index - 1] = "";
              commit(next);
              if (!digit && index > 0) cells.current[index - 1]?.focus();
            } else if (event.key === "ArrowLeft" && index > 0) {
              cells.current[index - 1]?.focus();
            } else if (event.key === "ArrowRight" && index < CELLS - 1) {
              cells.current[index + 1]?.focus();
            }
          }}
          className="font-areal-mono h-8 min-w-0 flex-1 rounded-lg bg-black text-center text-[14px] leading-8 text-white outline-none focus:inset-ring focus:inset-ring-white"
        />
      ))}
    </span>
  );
}
