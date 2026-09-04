/** How many pattern rows the skip matrix holds before repeating. */
export const SKIP_PATTERN_ROWS = 4;

/** "2 | 4, 5 | -" (1-based) → 0-based off columns per pattern row. */
export function parseSkipCells(
  raw: string,
  rows: number = SKIP_PATTERN_ROWS,
): number[][] {
  const parts = String(raw).split("|");
  return Array.from({ length: Math.max(1, rows) }, (_, r) => {
    const cols = new Set<number>();
    for (const token of (parts[r] ?? "").split(/[,;\s]+/)) {
      const n = Number.parseInt(token, 10);
      if (Number.isFinite(n) && n >= 1) cols.add(n - 1);
    }
    return [...cols].sort((a, b) => a - b);
  });
}

/** 0-based off columns per row → the stored "2 | 4 | -" string. */
export function serializeSkipCells(
  rows: readonly (readonly number[])[],
): string {
  return rows
    .map((cols) => (cols.length ? cols.map((c) => c + 1).join(", ") : "-"))
    .join(" | ");
}
