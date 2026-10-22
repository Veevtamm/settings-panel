/** Inspector row drag: reorder phases and move them into or out of a group. */

export type TimelineGroup = { id: string; name: string; keys: string[] };

export type TreeDropSlot = {
  /** `null` inserts among root rows. A group id inserts among that group's phases. */
  parentGroupId: string | null;
  /** Index in the destination list after the dragged phases are taken out. */
  index: number;
};

export type TreeDropRow = {
  kind: "phase" | "group";
  id: string;
  parentGroupId: string | null;
  top: number;
  bottom: number;
  /** Group header: member phase ids, in order. */
  keys?: readonly string[];
};

export type TreeDropHit = TreeDropSlot & { lineY: number; depth: number };

/** Pointer x (from the list's left edge) at or past this stays nested. */
const NEST_X = 22;

type Block = {
  kind: "phase" | "group";
  id: string;
  keys: string[];
  top: number;
  bottom: number;
  children: { id: string; top: number; bottom: number }[];
};

function clampIndex(index: number, length: number) {
  return Math.min(length, Math.max(0, index));
}

function cloneGroups(groups: readonly TimelineGroup[]) {
  return groups.map((group) => ({ ...group, keys: [...group.keys] }));
}

/** One root block per phase, or one block per group (its keys stay together). */
function rootUnits(order: readonly string[], groups: readonly TimelineGroup[]) {
  const memberOf = new Map<string, TimelineGroup>();
  for (const group of groups) {
    for (const key of group.keys) memberOf.set(key, group);
  }
  const units: { keys: string[] }[] = [];
  const seen = new Set<string>();
  const emitGroup = (group: TimelineGroup) => {
    const keys = group.keys.filter((key) => !seen.has(key));
    if (keys.length === 0) return;
    for (const key of keys) seen.add(key);
    units.push({ keys });
  };
  for (const id of order) {
    if (seen.has(id)) continue;
    const group = memberOf.get(id);
    if (group) {
      emitGroup(group);
      continue;
    }
    seen.add(id);
    units.push({ keys: [id] });
  }
  for (const group of groups) emitGroup(group);
  return units;
}

export function sameTimelineTree(
  order: readonly string[],
  groups: readonly { id: string; keys: readonly string[] }[],
  next: { order: readonly string[]; groups: readonly { id: string; keys: readonly string[] }[] },
) {
  if (order.length !== next.order.length || order.some((id, index) => id !== next.order[index])) {
    return false;
  }
  if (groups.length !== next.groups.length) return false;
  return groups.every((group, index) => {
    const other = next.groups[index];
    return (
      group != null &&
      other != null &&
      group.id === other.id &&
      group.keys.length === other.keys.length &&
      group.keys.every((key, keyIndex) => key === other.keys[keyIndex])
    );
  });
}

/**
 * Move `movingIds` to `slot`. A drag of every key in one group keeps that
 * group and only changes where the block sits. A group with fewer than two
 * phases left is removed.
 */
export function applyTreeDrop(
  order: readonly string[],
  groups: readonly TimelineGroup[],
  movingIds: readonly string[],
  slot: TreeDropSlot,
): { order: string[]; groups: TimelineGroup[] } {
  const moving = movingIds.filter(
    (id, index) => order.includes(id) && movingIds.indexOf(id) === index,
  );
  if (moving.length === 0) {
    return { order: [...order], groups: cloneGroups(groups) };
  }
  const movingSet = new Set(moving);
  const carried = groups.find(
    (group) =>
      group.keys.length === moving.length &&
      group.keys.every((key) => movingSet.has(key)),
  );
  if (carried) {
    if (slot.parentGroupId != null) {
      return { order: [...order], groups: cloneGroups(groups) };
    }
    const units = rootUnits(
      order.filter((id) => !movingSet.has(id)),
      groups.filter((group) => group.id !== carried.id),
    );
    units.splice(clampIndex(slot.index, units.length), 0, {
      keys: carried.keys.filter((key) => movingSet.has(key)),
    });
    return { order: units.flatMap((unit) => unit.keys), groups: cloneGroups(groups) };
  }

  const nextGroups = cloneGroups(groups).map((group) => ({
    ...group,
    keys: group.keys.filter((key) => !movingSet.has(key)),
  }));
  let placedInGroup = false;
  if (slot.parentGroupId != null) {
    const host = nextGroups.find((group) => group.id === slot.parentGroupId);
    if (host) {
      const current = order.filter((id) => host.keys.includes(id));
      current.splice(clampIndex(slot.index, current.length), 0, ...moving);
      host.keys = current;
      placedInGroup = true;
    }
  }
  const kept = nextGroups.filter((group) => group.keys.length >= 2);
  const units = rootUnits(
    order.filter((id) => !movingSet.has(id)),
    kept,
  );
  if (!placedInGroup) {
    units.splice(clampIndex(slot.index, units.length), 0, { keys: moving });
  }
  return { order: units.flatMap((unit) => unit.keys), groups: kept };
}

function blocksFrom(rows: readonly TreeDropRow[]) {
  const blocks: Block[] = [];
  const byId = new Map<string, Block>();
  for (const row of rows) {
    if (!row.id) continue;
    if (row.parentGroupId == null) {
      const block: Block = {
        kind: row.kind,
        id: row.id,
        keys: row.kind === "group" ? [...(row.keys ?? [])] : [row.id],
        top: row.top,
        bottom: row.bottom,
        children: [],
      };
      blocks.push(block);
      if (row.kind === "group") byId.set(row.id, block);
      continue;
    }
    const parent = byId.get(row.parentGroupId);
    if (!parent || row.kind !== "phase") continue;
    parent.children.push({ id: row.id, top: row.top, bottom: row.bottom });
    parent.bottom = Math.max(parent.bottom, row.bottom);
    if (!parent.keys.includes(row.id)) parent.keys.push(row.id);
  }
  return blocks;
}

function isLifted(block: Block, moving: ReadonlySet<string>) {
  if (block.kind === "phase") return moving.has(block.id);
  return block.keys.length > 0 && block.keys.every((key) => moving.has(key));
}

function gapLine(before: number | null, after: number | null) {
  if (before == null) return after ?? 0;
  if (after == null) return before;
  return (before + after) / 2;
}

function closestGap(gaps: { y: number; index: number }[], y: number) {
  let best = gaps[0];
  let bestDist = Math.abs(best.y - y);
  for (const gap of gaps) {
    const dist = Math.abs(gap.y - y);
    if (dist < bestDist) {
      best = gap;
      bestDist = dist;
    }
  }
  return best;
}

function rootHit(blocks: readonly Block[], moving: ReadonlySet<string>, y: number): TreeDropHit {
  const gaps: { y: number; index: number }[] = [];
  let index = 0;
  for (let i = 0; i <= blocks.length; i += 1) {
    const before = i === 0 ? null : blocks[i - 1].bottom;
    const after = i === blocks.length ? null : blocks[i].top;
    gaps.push({ y: gapLine(before, after), index });
    if (i < blocks.length && !isLifted(blocks[i], moving)) index += 1;
  }
  const gap = closestGap(gaps, y);
  return { parentGroupId: null, index: gap.index, lineY: gap.y, depth: 0 };
}

function innerHit(host: Block, moving: ReadonlySet<string>, y: number): TreeDropHit {
  const kids = host.children;
  if (kids.length === 0) {
    const rest = host.keys.filter((key) => !moving.has(key)).length;
    const index = y < host.top + (host.bottom - host.top) / 2 ? 0 : rest;
    return { parentGroupId: host.id, index, lineY: host.bottom, depth: 1 };
  }
  const gaps: { y: number; index: number }[] = [];
  let index = 0;
  for (let i = 0; i <= kids.length; i += 1) {
    const before = i === 0 ? null : kids[i - 1].bottom;
    const after = i === kids.length ? null : kids[i].top;
    gaps.push({ y: gapLine(before, after), index });
    if (i < kids.length && !moving.has(kids[i].id)) index += 1;
  }
  const gap = closestGap(gaps, y);
  return { parentGroupId: host.id, index: gap.index, lineY: gap.y, depth: 1 };
}

/** Where a dragged inspector row lands. `listLeft` is the column's left edge. */
export function treeDropSlot(
  rows: readonly TreeDropRow[],
  movingIds: readonly string[],
  point: { x: number; y: number; listLeft: number },
): TreeDropHit | null {
  if (rows.length === 0 || movingIds.length === 0) return null;
  const moving = new Set(movingIds);
  const blocks = blocksFrom(rows);
  if (blocks.length === 0) return null;
  const wholeGroup = blocks.some(
    (block) =>
      block.kind === "group" &&
      block.keys.length === moving.size &&
      block.keys.length > 0 &&
      block.keys.every((key) => moving.has(key)),
  );
  const wantInner = !wholeGroup && point.x - point.listLeft >= NEST_X;
  if (wantInner) {
    const host = blocks.find(
      (block) =>
        block.kind === "group" &&
        !isLifted(block, moving) &&
        point.y >= block.top &&
        point.y <= block.bottom,
    );
    if (host) return innerHit(host, moving, point.y);
  }
  return rootHit(blocks, moving, point.y);
}
