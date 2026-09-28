import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import { PANEL_VERSION } from "../src/version";

describe("PANEL_VERSION", () => {
  it("matches package.json", () => {
    expect(PANEL_VERSION).toBe(pkg.version);
  });
});
