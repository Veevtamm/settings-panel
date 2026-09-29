import { describe, expect, it } from "vitest";
import {
  AXIS_POINTS_MAX,
  AXIS_POINTS_MIN,
  insertAxisMid,
  removeAxisBest,
  setAxisPointCount,
  type AxisPoint,
} from "../src/lib/axis-curve";

const THREE: AxisPoint[] = [
  [0, 0],
  [0.5, 0.4],
  [1, 1],
];

describe("setAxisPointCount", () => {
  it("inserts on the longest span until the count", () => {
    const next = setAxisPointCount(THREE, [], 5);
    expect(next.pts).toHaveLength(5);
    expect(next.handles).toHaveLength(5);
    expect(next.pts[0]).toEqual([0, 0]);
    expect(next.pts[next.pts.length - 1]).toEqual([1, 1]);
  });

  it("drops interior knots down to the floor", () => {
    const grown = setAxisPointCount(THREE, [], 6);
    const next = setAxisPointCount(grown.pts, grown.handles, AXIS_POINTS_MIN);
    expect(next.pts).toHaveLength(AXIS_POINTS_MIN);
    expect(next.pts[0]).toEqual([0, 0]);
    expect(next.pts[1]).toEqual([1, 1]);
  });

  it("clamps to 2…12", () => {
    expect(setAxisPointCount(THREE, [], 1).pts).toHaveLength(AXIS_POINTS_MIN);
    expect(setAxisPointCount(THREE, [], 99).pts).toHaveLength(AXIS_POINTS_MAX);
  });

  it("insertAxisMid returns null at the cap", () => {
    const maxed = setAxisPointCount(THREE, [], AXIS_POINTS_MAX);
    expect(insertAxisMid(maxed.pts, maxed.handles)).toBeNull();
    expect(removeAxisBest(THREE, [])).not.toBeNull();
    expect(removeAxisBest(THREE.slice(0, 2), [])).toBeNull();
  });
});
