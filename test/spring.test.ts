import { describe, expect, it } from "vitest";
import {
  SPRING_REST,
  springLinearEasing,
  springSettleMs,
  springValue,
} from "../src/lib/spring";
import { changeModel } from "../src/settings-panel/change-model";

const bouncy = { stiffness: 170, damping: 12, mass: 1 };
const critical = { stiffness: 100, damping: 20, mass: 1 };
const heavy = { stiffness: 100, damping: 40, mass: 1 };

describe("springValue", () => {
  it("starts at 0 and ends at 1 in every damping regime", () => {
    for (const config of [bouncy, critical, heavy]) {
      expect(springValue(config, 0)).toBeCloseTo(0, 6);
      expect(springValue(config, 10)).toBeCloseTo(1, 4);
    }
  });

  it("overshoots only when underdamped", () => {
    const peak = (config: typeof bouncy) =>
      Math.max(...Array.from({ length: 2000 }, (_, i) => springValue(config, i / 1000)));
    expect(peak(bouncy)).toBeCloseTo(1 + Math.exp((-Math.PI * 0.46) / Math.sqrt(1 - 0.46 ** 2)), 2);
    expect(peak(critical)).toBeLessThanOrEqual(1);
    expect(peak(heavy)).toBeLessThanOrEqual(1);
  });
});

describe("springSettleMs", () => {
  it("is the last moment outside 0.1% of the target", () => {
    const ms = springSettleMs(bouncy);
    expect(Math.abs(1 - springValue(bouncy, ms / 1000))).toBeLessThanOrEqual(SPRING_REST);
    expect(ms).toBeGreaterThan(springSettleMs({ ...bouncy, damping: 26 }));
  });

  it("builds a CSS linear() that ends at 1", () => {
    expect(springLinearEasing(bouncy, 4)).toMatch(/^linear\(0, .*, 1\)$/);
  });
});

describe("changeModel springs", () => {
  it("counts changed spring targets once and keeps springs out of plot keys", () => {
    const defaults = { size: 1, springs: { card: bouncy, text: bouncy } };
    const model = changeModel({
      settings: { ...defaults, springs: { card: { ...bouncy, damping: 20 }, text: bouncy } },
      defaultSettings: defaults,
      groups: [],
      players: [],
      easingTargets: [],
      springTargets: [
        { id: "card", label: { ru: "Карточка", en: "Card" } },
        { id: "text", label: { ru: "Текст", en: "Text" } },
      ],
      hasCurveSection: true,
      sectionIcons: {},
    });
    expect(model.changedSpringTargets.map((target) => target.id)).toEqual(["card"]);
    expect(model.curveKeys).toEqual(["size"]);
    expect(model.changedCount).toBe(1);
  });
});
