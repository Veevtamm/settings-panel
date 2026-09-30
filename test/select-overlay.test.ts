import { describe, expect, it } from "vitest";
import { placeSelectOverlay } from "../src/lib/select-overlay";

describe("placeSelectOverlay", () => {
  it("opens below when the capped list fits under the trigger", () => {
    const place = placeSelectOverlay(100, 128, 800);
    expect(place.side).toBe("below");
    expect(place.listMaxPx).toBe(192);
  });

  it("opens above when the bottom of the viewport is too tight", () => {
    const place = placeSelectOverlay(700, 728, 800);
    expect(place.side).toBe("above");
    expect(place.listMaxPx).toBe(192);
    expect(place.bottom).toBe(72);
  });

  it("shrinks the list when neither side has a full 192px", () => {
    const place = placeSelectOverlay(80, 108, 120);
    expect(place.side).toBe("above");
    expect(place.listMaxPx).toBe(72);
  });
});
