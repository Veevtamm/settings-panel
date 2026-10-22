/** Visual order of scene-panel rows inside one subsection. */

export function orderPanelRows<T extends { id: string }>(
  rows: readonly T[],
  saved: readonly string[] | undefined,
): T[] {
  if (!saved?.length) return [...rows];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const used = new Set<string>();
  const next: T[] = [];
  for (const id of saved) {
    const row = byId.get(id);
    if (!row || used.has(id)) continue;
    used.add(id);
    next.push(row);
  }
  for (const row of rows) {
    if (!used.has(row.id)) next.push(row);
  }
  return next;
}

export function movePanelRow(ids: readonly string[], id: string, index: number) {
  const rest = ids.filter((item) => item !== id);
  const at = Math.max(0, Math.min(rest.length, index));
  const next = [...rest];
  next.splice(at, 0, id);
  return next;
}

export function samePanelRowOrder(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export type PanelRowBox = { id: string; top: number; bottom: number };

/** Drop index is among the rows left after the dragged one is taken out. */
export function panelRowSlot(
  rows: readonly PanelRowBox[],
  movingId: string,
  y: number,
): { index: number; lineY: number } | null {
  if (rows.length === 0) return null;
  const gaps: { y: number; index: number }[] = [];
  let index = 0;
  for (let i = 0; i <= rows.length; i += 1) {
    const before = i === 0 ? null : rows[i - 1].bottom;
    const after = i === rows.length ? null : rows[i].top;
    const lineY =
      before == null ? (after ?? 0) : after == null ? before : (before + after) / 2;
    gaps.push({ y: lineY, index });
    if (i < rows.length && rows[i].id !== movingId) index += 1;
  }
  let best = gaps[0];
  let bestDist = Math.abs(best.y - y);
  for (const gap of gaps) {
    const dist = Math.abs(gap.y - y);
    if (dist < bestDist) {
      best = gap;
      bestDist = dist;
    }
  }
  return { index: best.index, lineY: best.y };
}
