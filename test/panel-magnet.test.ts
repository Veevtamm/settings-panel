import { describe, expect, it } from "vitest";
import { PANEL_MAGNET_PX, shouldMagnetPanel } from "../src/settings-panel/chrome";

const BAR = { x: 200, y: 12, w: 180, h: 44 };
const DOCKED = { x: 100, y: 64 };
const SIZE = { w: 348, h: 400 };

describe("shouldMagnetPanel", () => {
  it("stays docked within 28px of the home slot", () => {
    const panel = { ...DOCKED, ...SIZE, x: DOCKED.x + 20, y: DOCKED.y };
    expect(shouldMagnetPanel(panel, DOCKED, BAR)).toBe(true);
  });

  it("lets the scene slide parallel to the bar past 28px (docked gap is 8)", () => {
    const panel = {
      ...SIZE,
      x: DOCKED.x + PANEL_MAGNET_PX + 4,
      y: DOCKED.y,
    };
    expect(shouldMagnetPanel(panel, DOCKED, BAR)).toBe(false);
  });

  it("snaps when the scene overlaps the Dock Bar", () => {
    const panel = { ...SIZE, x: DOCKED.x + 80, y: BAR.y };
    expect(shouldMagnetPanel(panel, DOCKED, BAR)).toBe(true);
  });

  it("chrome windows ignore the bar and only magnet to their slot", () => {
    const panel = { ...SIZE, x: DOCKED.x + 80, y: BAR.y };
    expect(shouldMagnetPanel(panel, DOCKED, BAR, false)).toBe(false);
  });
});
