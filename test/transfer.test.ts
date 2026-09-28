import { describe, expect, it } from "vitest";
import {
  decodeSettingsToken,
  encodeSettingsToken,
  parseSettingsFile,
  sanitizeImported,
  settingsLinkUrl,
} from "../src/lib/settings-transfer";

describe("settings link", () => {
  it("round-trips values with unicode for the same panel", () => {
    const token = encodeSettingsToken("exp-7", { title: "Кегль", size: 160 });
    expect(token).not.toMatch(/[+/=]/);
    expect(decodeSettingsToken(token, "exp-7")).toEqual({
      title: "Кегль",
      size: 160,
    });
  });

  it("ignores tokens of another panel and garbage", () => {
    const token = encodeSettingsToken("exp-7", { size: 1 });
    expect(decodeSettingsToken(token, "exp-5")).toBeNull();
    expect(decodeSettingsToken("%%%", "exp-7")).toBeNull();
  });

  it("keeps other query params", () => {
    const url = settingsLinkUrl("https://a.localhost/7?moment=2#x", "abc");
    expect(url).toBe("https://a.localhost/7?moment=2&settings=abc#x");
  });
});

describe("sanitizeImported", () => {
  const reference = { size: 140, color: "#FFFFFF", on: false, easings: {} };
  const keys = Object.keys(reference) as (keyof typeof reference)[];

  it("drops foreign keys, wrong types and NaN", () => {
    expect(
      sanitizeImported(
        { size: "big", color: "#000000", on: true, other: 1, easings: null },
        keys,
        reference,
      ),
    ).toEqual({ color: "#000000", on: true });
    expect(sanitizeImported({ size: Number.NaN }, keys, reference)).toEqual({});
  });
});

describe("parseSettingsFile", () => {
  it("reads settings and slots", () => {
    const parsed = parseSettingsFile(
      JSON.stringify({ panelId: "p", settings: { a: 1 }, snapshots: [null] }),
    );
    expect(parsed).toEqual({ panelId: "p", settings: { a: 1 }, snapshots: [null] });
  });

  it("rejects files without settings", () => {
    expect(parseSettingsFile("{}")).toBeNull();
    expect(parseSettingsFile("not json")).toBeNull();
  });
});
