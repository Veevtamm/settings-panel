import { beforeEach, describe, expect, it } from "vitest";
import { createParamStore } from "../src/lib/param-store";
import { L } from "../src/settings-panel/locale";
import { defineParams, param } from "../src/settings-panel/params";

const memory = new Map<string, string>();
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => void memory.set(key, value),
    },
  },
});

const P = defineParams({
  size: param.number({ label: L("Кегль", "Size"), default: 140, min: 10, max: 400 }),
  speed: param.number({
    label: L("Скорость", "Speed"),
    default: 100,
    min: 20,
    max: 250,
    scrub: true,
  }),
  on: param.toggle({ label: L("Вкл", "On"), default: false }),
  bg: param.color({ label: L("Фон", "Background"), default: "#000000" }),
  mode: param.choice({
    label: L("Режим", "Mode"),
    default: "fit",
    options: [
      { value: "fit", label: L("Фит", "Fit") },
      { value: "fill", label: L("Филл", "Fill") },
    ],
  }),
  anchor: param.anchor({ label: L("Якорь", "Anchor"), default: "center" }),
  wght: param.range({
    label: L("Толщина", "Weight"),
    min: 200,
    max: 900,
    from: { key: "wghtMin", default: 200 },
    to: { key: "wghtMax", default: 900 },
  }),
  easings: param.value({ default: {} as Record<string, unknown> }),
});

const store = () =>
  createParamStore(P, {
    storageKey: "demo-scene-settings-v2",
    legacyKeys: ["demo-scene-settings"],
    migrate: (raw) => ("fontSize" in raw ? { ...raw, size: raw.fontSize } : raw),
  });

beforeEach(() => memory.clear());

describe("createParamStore", () => {
  it("returns defaults when nothing is stored", () => {
    expect(store().load()).toEqual(store().defaults);
  });

  it("checks every stored value against its param", () => {
    memory.set(
      "demo-scene-settings-v2",
      JSON.stringify({
        size: 9999,
        speed: 400,
        on: "yes",
        bg: "#abc",
        mode: "stretch",
        anchor: "nowhere",
        wghtMin: 950,
        wghtMax: 100,
        easings: [],
        stray: 1,
      }),
    );
    expect(store().load()).toEqual({
      size: 400,
      speed: 400,
      on: false,
      bg: "#AABBCC",
      mode: "fit",
      anchor: "center",
      wghtMin: 200,
      wghtMax: 900,
      easings: {},
    });
  });

  it("migrates the legacy key and writes only the new one", () => {
    memory.set("demo-scene-settings", JSON.stringify({ fontSize: 180 }));
    const s = store();
    const loaded = s.getSnapshot();
    expect(loaded.size).toBe(180);
    s.save({ ...loaded, on: true });
    expect(JSON.parse(memory.get("demo-scene-settings-v2")!)).toMatchObject({ size: 180, on: true });
    expect(JSON.parse(memory.get("demo-scene-settings")!)).toEqual({ fontSize: 180 });
    expect(s.getSnapshot().on).toBe(true);
  });

  it("survives broken JSON", () => {
    memory.set("demo-scene-settings-v2", "{nope");
    expect(store().load()).toEqual(store().defaults);
  });
});
