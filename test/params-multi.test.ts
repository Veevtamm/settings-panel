import { describe, expect, it } from "vitest";
import { L } from "../src/settings-panel/locale";
import {
  defaultsOf,
  defineParams,
  param,
  rowsOf,
  type SettingsOf,
} from "../src/settings-panel/params";
import { lintSettingsSchema } from "../src/settings-panel/schema-lint";
import type {
  PlayerController,
  PlayerSetting,
  SettingsGroup,
} from "../src/settings-panel/types";

const P = defineParams({
  fontWght: param.range({
    label: L("Толщина", "Weight"),
    min: 200,
    max: 900,
    step: 10,
    from: { key: "fontWghtMin", default: 200 },
    to: { key: "fontWghtMax", default: 900 },
    layer: "type",
  }),
  pad: param.pair({
    label: L("Отступы", "Padding"),
    fields: [
      { key: "padX", default: 24, ariaLabel: L("По X", "X"), icon: "padX", min: 0, max: 200 },
      { key: "padY", default: 16, ariaLabel: L("По Y", "Y"), icon: "padY", min: 0, max: 200 },
    ],
    layer: "layout",
  }),
  reel: param.player({
    label: L("Лента", "Reel"),
    total: { key: "reelTotalMs", default: 1200 },
    phases: [
      { key: "reelInMs", default: 400, caption: L("вход", "in"), kind: "phase", max: 2000 },
      {
        key: "reelRowMs",
        default: 300,
        caption: L("строки", "rows"),
        kind: "phase",
        max: 2000,
        start: { key: "reelRowStartMs", default: 400 },
        stagger: { count: 3, step: { key: "reelRowStepMs", default: 60 } },
      },
    ],
    unit: "ms",
    layer: "timings",
  }),
  speed: param.number({
    label: L("Скорость", "Speed"),
    default: 100,
    min: 20,
    max: 250,
    layer: "motion",
  }),
});
type S = SettingsOf<typeof P>;

const typed: S = {
  fontWghtMin: 200,
  fontWghtMax: 900,
  padX: 24,
  padY: 16,
  reelTotalMs: 1200,
  reelInMs: 400,
  reelRowMs: 300,
  reelRowStartMs: 400,
  reelRowStepMs: 60,
  speed: 100,
};
// @ts-expect-error registry names of multi-key params are not settings keys
const noName: S["fontWght"] = 1;
void noName;

const controller = {} as PlayerController;
const reel: PlayerSetting<S> = { ...P.reel, controller };

describe("multi-key params", () => {
  it("expand defaults into every key they own", () => {
    expect(defaultsOf(P)).toEqual(typed);
  });

  it("place range and pair rows through rowsOf", () => {
    const rows = rowsOf(P, ["fontWght", "pad", "speed"]);
    expect(rows.ranges?.[0]).toMatchObject({ fromKey: "fontWghtMin", toKey: "fontWghtMax" });
    expect(rows.pairs?.[0]?.fields.map((field) => field.key)).toEqual(["padX", "padY"]);
    expect(rows.pairs?.[0]?.fields[0]).not.toHaveProperty("default");
    expect(rows.settings?.map((row) => row.key)).toEqual(["speed"]);
  });

  it("builds a player with start and stagger keys", () => {
    expect(reel.totalKey).toBe("reelTotalMs");
    expect(reel.phases[1]).toMatchObject({
      key: "reelRowMs",
      startKey: "reelRowStartMs",
      stagger: { count: 3, stepKey: "reelRowStepMs" },
    });
    expect(reel.phases[0]).not.toHaveProperty("startKey");
  });

  it("lint finds a range without a row and a player outside players", () => {
    const groups: SettingsGroup<S>[] = [
      {
        id: "motion",
        title: L("Движение", "Motion"),
        icon: "activity",
        sections: [{ title: L("Лента", "Tape"), ...rowsOf(P, ["speed", "pad"]) }],
      },
    ];
    const lint = (players: PlayerSetting<S>[]) =>
      lintSettingsSchema({ groups, players, defaultSettings: typed, params: P })
        .filter((issue) => issue.code === "row-without-control")
        .map((issue) => issue.message);
    expect(lint([])).toEqual([
      'param "fontWght" (range) has no row in groups',
      'param "reel" (player) is not in players',
    ]);
    expect(lint([reel])).toEqual(['param "fontWght" (range) has no row in groups']);
  });
});
