import { describe, expect, it } from "vitest";
import {
  changeModel,
  formatDefaultsHandoff,
} from "../src/settings-panel/change-model";
import { L } from "../src/settings-panel/locale";
import type { SettingsGroup } from "../src/settings-panel/types";

type S = { speed: number; invert: boolean; hidden: number };
const DEFAULTS: S = { speed: 100, invert: false, hidden: 1 };
const groups: SettingsGroup<S>[] = [
  {
    id: "motion",
    title: L("Движение", "Motion"),
    icon: "activity",
    sections: [
      {
        title: L("Лента", "Tape"),
        settings: [{ key: "speed", label: L("Скорость", "Speed"), min: 0, max: 200 }],
        toggles: [{ key: "invert", label: L("Инверсия", "Invert") }],
      },
    ],
  },
];

const model = (settings: S) =>
  changeModel({
    settings,
    defaultSettings: DEFAULTS,
    groups,
    players: [],
    easingTargets: [],
    hasCurveSection: false,
    sectionIcons: {},
  });

describe("changeModel", () => {
  it("counts only keys that have a control", () => {
    const m = model({ speed: 150, invert: false, hidden: 5 });
    expect(m.listedChangedKeys).toEqual(["speed"]);
    expect(m.changedCount).toBe(1);
    expect(m.listedControlCount).toBe(2);
  });

  it("formats the agent hand-off as old → new", () => {
    const settings = { speed: 150, invert: true, hidden: 1 };
    const text = formatDefaultsHandoff({
      model: model(settings),
      settings,
      defaults: DEFAULTS,
      groups,
      players: [],
      subsectionOrder: {},
      sectionIcons: {},
      hasCurveSection: false,
      curveTitle: "Ось",
      easingTitle: "Кривая",
      storageLabel: "demo",
      locale: "ru",
    });
    expect(text).toContain("Скорость (speed): 100 → 150");
    expect(text).toContain("Инверсия (invert): false → true");
    expect(text.split("\n")[0]).toContain("demo");
  });
});
