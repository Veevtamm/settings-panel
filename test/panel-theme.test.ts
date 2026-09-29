import { describe, expect, it } from "vitest";
import { parsePanelSettingsObject } from "../src/lib/panel-theme";

describe("parsePanelSettingsObject", () => {
  it("reads chromeFloat for spring / bezier / axis", () => {
    const parsed = parsePanelSettingsObject(
      JSON.stringify({
        chromeFloat: {
          spring: { x: 40, y: 80 },
          axis: { x: 12, y: 12 },
          skip: { x: 1, y: 1 },
        },
      }),
    );
    expect(parsed.chromeFloat).toEqual({
      spring: { x: 40, y: 80 },
      axis: { x: 12, y: 12 },
    });
  });
});
