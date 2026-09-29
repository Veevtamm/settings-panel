import { describe, expect, it } from "vitest";
import { parsePanelSettingsObject } from "../src/lib/panel-theme";

describe("parsePanelSettingsObject", () => {
  it("reads chromeFloat for settings / spring / bezier / axis", () => {
    const parsed = parsePanelSettingsObject(
      JSON.stringify({
        chromeFloat: {
          settings: { x: 8, y: 16 },
          spring: { x: 40, y: 80 },
          axis: { x: 12, y: 12 },
          skip: { x: 1, y: 1 },
        },
      }),
    );
    expect(parsed.chromeFloat).toEqual({
      settings: { x: 8, y: 16 },
      spring: { x: 40, y: 80 },
      axis: { x: 12, y: 12 },
    });
  });

  it("reads font system and ignores unknown values", () => {
    expect(
      parsePanelSettingsObject(JSON.stringify({ font: "system" })).font,
    ).toBe("system");
    expect(
      parsePanelSettingsObject(JSON.stringify({ font: "georgia" })).font,
    ).toBe("georgia");
    expect(parsePanelSettingsObject(JSON.stringify({ font: "comic" })).font).toBe(
      undefined,
    );
  });
});
