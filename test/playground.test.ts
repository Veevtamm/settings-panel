import { describe, expect, it } from "vitest";
import { lintSettingsSchema } from "../src/settings-panel/schema-lint";
import type { PlayerController } from "../src/settings-panel/types";
import { DEFAULTS, P } from "../playground/params";
import { EASING_TARGETS, SPRING_TARGETS, groups } from "../playground/schema";

describe("playground schema", () => {
  it("passes the full schema lint", () => {
    expect(
      lintSettingsSchema({
        groups,
        players: [{ ...P.reel, controller: {} as PlayerController }],
        defaultSettings: DEFAULTS,
        defaultOpenSections: ["card", "title", "bars"],
        easingTargets: EASING_TARGETS,
        springTargets: SPRING_TARGETS,
        params: P,
      }),
    ).toEqual([]);
  });
});
