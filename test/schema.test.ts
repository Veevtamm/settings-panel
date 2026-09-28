import { describe, expect, it } from "vitest";
import { L } from "../src/settings-panel/locale";
import { filterGroupsBySearch } from "../src/settings-panel/model";
import {
  defaultsOf,
  defineParams,
  param,
  rowsOf,
  type SettingsOf,
} from "../src/settings-panel/params";
import { lintSettingsSchema } from "../src/settings-panel/schema-lint";
import type { SettingsGroup } from "../src/settings-panel/types";

const P = defineParams({
  driftSpeed: param.number({
    label: L("Скорость", "Speed"),
    default: 100,
    min: 20,
    max: 250,
    step: 5,
    unit: "%",
    layer: "motion",
  }),
  rubberInvert: param.toggle({
    label: L("Инверсия", "Invert"),
    default: false,
    layer: "motion",
  }),
  backgroundColor: param.color({
    label: L("Фон", "Background"),
    default: "#000000",
    layer: "color",
  }),
});
type S = SettingsOf<typeof P>;
const DEFAULTS = defaultsOf(P);

const groups: SettingsGroup<S>[] = [
  {
    id: "motion",
    title: L("Движение", "Motion"),
    icon: "activity",
    sections: [
      {
        title: L("Лента", "Tape"),
        ...rowsOf(P, ["driftSpeed", "rubberInvert"]),
      },
    ],
  },
  {
    id: "color",
    title: L("Цвет", "Color"),
    icon: "palette",
    sections: [{ title: L("Фон", "Background"), untitled: true, colors: [P.backgroundColor] }],
  },
];

describe("defineParams", () => {
  it("builds defaults and rows from one record", () => {
    expect(DEFAULTS).toEqual({
      driftSpeed: 100,
      rubberInvert: false,
      backgroundColor: "#000000",
    });
    expect(P.driftSpeed.key).toBe("driftSpeed");
    const rows = rowsOf(P, ["driftSpeed", "rubberInvert"]);
    expect(rows.settings?.map((row) => row.key)).toEqual(["driftSpeed"]);
    expect(rows.toggles?.map((row) => row.key)).toEqual(["rubberInvert"]);
    expect(rows.colors).toBeUndefined();
  });
});

describe("lintSettingsSchema", () => {
  it("passes a canonical schema", () => {
    expect(
      lintSettingsSchema({
        groups,
        defaultSettings: DEFAULTS,
        defaultOpenSections: ["motion", "color"],
        params: P,
      }),
    ).toEqual([]);
  });

  it("flags wrong layer titles, unknown open ids and duplicate rows", () => {
    const broken: SettingsGroup<S>[] = [
      { ...groups[0]!, title: L("Анимации", "Animations") },
      {
        ...groups[1]!,
        sections: [
          ...groups[1]!.sections,
          { title: L("Ещё", "More"), colors: [P.backgroundColor] },
        ],
      },
    ];
    const codes = lintSettingsSchema({
      groups: broken,
      defaultSettings: DEFAULTS,
      defaultOpenSections: ["place"],
    }).map((issue) => issue.code);
    expect(codes).toContain("layer-title");
    expect(codes).toContain("unknown-open-section");
    expect(codes).toContain("duplicate-row");
  });

  it("flags params that never became a row", () => {
    const codes = lintSettingsSchema({
      groups: [groups[0]!],
      defaultSettings: DEFAULTS,
      params: P,
    }).map((issue) => issue.code);
    expect(codes).toContain("row-without-control");
  });
});

describe("filterGroupsBySearch", () => {
  it("keeps matching rows by label or key and drops empty groups", () => {
    const found = filterGroupsBySearch(groups, "скорость");
    expect(found.map((group) => group.id)).toEqual(["motion"]);
    expect(found[0]!.sections[0]!.settings?.map((row) => row.key)).toEqual([
      "driftSpeed",
    ]);
    expect(found[0]!.sections[0]!.toggles).toBeUndefined();
    const byKeyWord = filterGroupsBySearch(groups, "invert");
    expect(byKeyWord[0]!.sections[0]!.toggles?.[0]?.key).toBe("rubberInvert");
  });

  it("returns every group for an empty query", () => {
    expect(filterGroupsBySearch(groups, "  ")).toBe(groups);
  });
});
