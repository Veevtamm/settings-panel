import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayheadClock } from "../src/lib/playhead";

class Clock extends PlayheadClock {
  protected drive() {}
  protected spanMs() {
    return 800;
  }
  protected canPlay() {
    return true;
  }
}

let frames: FrameRequestCallback[] = [];
let clock = 0;

function frame(timestamp: number) {
  const pending = frames;
  frames = [];
  for (const callback of pending) callback(timestamp);
}

beforeEach(() => {
  frames = [];
  clock = 1000;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frames = [];
  });
  vi.spyOn(performance, "now").mockImplementation(() => clock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PlayheadClock run loop", () => {
  it("keeps reversing when the first frame starts before play()", () => {
    const player = new Clock("test");
    player.seek(1);
    player.play(-1);
    frame(clock - 4);
    expect(player.getState()).toMatchObject({ q: 1, playing: true });
    frame(clock + 400);
    expect(player.getState().playing).toBe(true);
    expect(player.getState().q).toBeLessThan(1);
  });

  it("keeps playing forward when the first frame has no elapsed time", () => {
    const player = new Clock("test");
    player.play(1);
    frame(clock);
    expect(player.getState()).toMatchObject({ q: 0, playing: true });
  });

  it("stops at the edge it runs toward", () => {
    const player = new Clock("test");
    player.seek(1);
    player.play(-1);
    for (let t = 16; t <= 1000; t += 16) frame(clock + t);
    expect(player.getState()).toMatchObject({ q: 0, playing: false });
  });
});
