import { describe, expect, it } from "vitest";
import {
  movePanelRow,
  orderPanelRows,
  panelRowSlot,
  samePanelRowOrder,
} from "../src/lib/panel-rows";

describe("orderPanelRows", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("keeps schema order without a saved list", () => {
    expect(orderPanelRows(rows, undefined).map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  it("applies a saved order and appends new rows", () => {
    expect(orderPanelRows(rows, ["c", "a", "gone"]).map((row) => row.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
});

describe("movePanelRow", () => {
  it("inserts after the dragged row is removed", () => {
    expect(movePanelRow(["a", "b", "c"], "a", 2)).toEqual(["b", "c", "a"]);
    expect(samePanelRowOrder(["a", "b"], movePanelRow(["a", "b"], "a", 0))).toBe(true);
  });
});

describe("panelRowSlot", () => {
  const rows = [
    { id: "a", top: 0, bottom: 28 },
    { id: "b", top: 36, bottom: 64 },
  ];

  it("moves the lower row above the first", () => {
    expect(panelRowSlot(rows, "b", 10)).toMatchObject({ index: 0 });
  });

  it("keeps a row when the pointer stays on it", () => {
    expect(panelRowSlot(rows, "b", 50)?.index).toBe(1);
  });
});
