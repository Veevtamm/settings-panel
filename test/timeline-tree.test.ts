import { describe, expect, it } from "vitest";
import {
  applyTreeDrop,
  sameTimelineTree,
  treeDropSlot,
  type TimelineGroup,
  type TreeDropRow,
} from "../src/lib/timeline-tree";

const group = (id: string, keys: string[]): TimelineGroup => ({
  id,
  name: id,
  keys,
});

describe("applyTreeDrop", () => {
  it("reorders root phases", () => {
    const next = applyTreeDrop(["a", "b", "c"], [], ["c"], {
      parentGroupId: null,
      index: 0,
    });
    expect(next.order).toEqual(["c", "a", "b"]);
    expect(next.groups).toEqual([]);
  });

  it("pulls a phase out and dissolves a pair", () => {
    const next = applyTreeDrop(["a", "b", "c"], [group("g", ["a", "b"])], ["a"], {
      parentGroupId: null,
      index: 2,
    });
    expect(next.order).toEqual(["b", "c", "a"]);
    expect(next.groups).toEqual([]);
  });

  it("pulls one phase out and keeps the rest of the group", () => {
    const next = applyTreeDrop(
      ["a", "b", "c", "d"],
      [group("g", ["a", "b", "c"])],
      ["a"],
      { parentGroupId: null, index: 1 },
    );
    expect(next.groups).toEqual([group("g", ["b", "c"])]);
    expect(next.order).toEqual(["b", "c", "a", "d"]);
  });

  it("drops a root phase into a group", () => {
    const next = applyTreeDrop(["a", "b", "c"], [group("g", ["b", "c"])], ["a"], {
      parentGroupId: "g",
      index: 1,
    });
    expect(next.groups).toEqual([group("g", ["b", "a", "c"])]);
    expect(next.order).toEqual(["b", "a", "c"]);
  });

  it("reorders phases inside a group", () => {
    const next = applyTreeDrop(["a", "b", "c"], [group("g", ["a", "b", "c"])], ["c"], {
      parentGroupId: "g",
      index: 0,
    });
    expect(next.groups).toEqual([group("g", ["c", "a", "b"])]);
    expect(next.order).toEqual(["c", "a", "b"]);
  });

  it("moves a whole group without breaking it", () => {
    const groups = [group("g", ["b", "c"])];
    const next = applyTreeDrop(["a", "b", "c"], groups, ["b", "c"], {
      parentGroupId: null,
      index: 0,
    });
    expect(next.order).toEqual(["b", "c", "a"]);
    expect(next.groups).toEqual(groups);
  });

  it("does not nest a group inside a group", () => {
    const order = ["a", "b", "c"];
    const groups = [group("g", ["b", "c"])];
    const next = applyTreeDrop(order, groups, ["b", "c"], {
      parentGroupId: "g",
      index: 0,
    });
    expect(sameTimelineTree(order, groups, next)).toBe(true);
  });
});

describe("treeDropSlot", () => {
  const rows: TreeDropRow[] = [
    { kind: "group", id: "g", parentGroupId: null, top: 0, bottom: 28, keys: ["a", "b"] },
    { kind: "phase", id: "a", parentGroupId: "g", top: 32, bottom: 60 },
    { kind: "phase", id: "b", parentGroupId: "g", top: 64, bottom: 92 },
    { kind: "phase", id: "card", parentGroupId: null, top: 96, bottom: 124 },
  ];

  it("pulls a nested phase out when the pointer is at the left edge", () => {
    const hit = treeDropSlot(rows, ["a"], { x: 4, y: 20, listLeft: 0 });
    expect(hit).toMatchObject({ parentGroupId: null, index: 0, depth: 0 });
  });

  it("lands after the group when the pointer is lower, still at the root", () => {
    const hit = treeDropSlot(rows, ["a"], { x: 4, y: 70, listLeft: 0 });
    expect(hit).toMatchObject({ parentGroupId: null, index: 1, depth: 0 });
  });

  it("reorders inside the group when the pointer is indented", () => {
    const hit = treeDropSlot(rows, ["b"], { x: 40, y: 40, listLeft: 0 });
    expect(hit).toMatchObject({ parentGroupId: "g", index: 0, depth: 1 });
  });

  it("moves a whole group along the root", () => {
    const hit = treeDropSlot(rows, ["a", "b"], { x: 40, y: 110, listLeft: 0 });
    expect(hit).toMatchObject({ parentGroupId: null, depth: 0, index: 1 });
  });
});
