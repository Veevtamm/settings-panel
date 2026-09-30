import { describe, expect, it } from "vitest";
import {
  isHideDockKey,
  isPhysicalKey,
  SCENE_PANEL_CODES,
  UNDO_CODES,
} from "../src/lib/hotkeys";

describe("isPhysicalKey", () => {
  it("matches the cap, not the layout letter", () => {
    expect(isPhysicalKey({ code: "KeyZ" }, UNDO_CODES)).toBe(true);
    expect(isPhysicalKey({ code: "KeyM" }, SCENE_PANEL_CODES)).toBe(true);
    expect(isPhysicalKey({ code: "KeyY" }, UNDO_CODES)).toBe(false);
  });
});

describe("isHideDockKey", () => {
  it("accepts ANSI and ISO backslash caps", () => {
    expect(isHideDockKey({ code: "Backslash", key: "]" })).toBe(true);
    expect(isHideDockKey({ code: "IntlBackslash", key: "<" })).toBe(true);
  });

  it("accepts the key that types a backslash on this layout", () => {
    expect(isHideDockKey({ code: "Digit7", key: "\\" })).toBe(true);
    expect(isHideDockKey({ code: "Slash", key: "/" })).toBe(false);
  });
});
