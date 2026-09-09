import { clamp01 } from "./cubic-bezier";
import type {
  PlayerController,
  PlayerSolo,
  PlayerState,
} from "../settings-panel/types";

/** Pins closer than this (in q) count as the same moment. */
export const PIN_EPSILON = 0.005;

function pinNear(pins: readonly number[], q: number) {
  return pins.some((pin) => Math.abs(pin - q) < PIN_EPSILON);
}

/** WAAPI tracks of one transition — all start at 0, the longest ends at `totalMs`. */
export type TransitionTracks = {
  animations: Animation[];
  /**
   * Phase index per animation. In solo, other tagged tracks freeze at `from`.
   * Omit (or a hole) = that clip always follows the playhead.
   */
  phases?: readonly (number | undefined)[];
  totalMs: number;
};

export type TransitionPlayerOptions = {
  /** Keys the `?moment=<id>:<q>` URL entry; unique per page (`reel`, `hover`, …). */
  id: string;
  build: () => TransitionTracks;
  /** Reverse runs at this fraction of forward timings (reel close = 0.8). */
  reverseTimeScale?: number;
  /** Instant seeks instead of runs (prefers-reduced-motion). */
  reduceMotion?: () => boolean;
  /** 1000 px of wheel travel = the whole transition. */
  scrollPxPerTransition?: number;
};

const EMPTY_TRACKS = (): TransitionTracks => ({ animations: [], totalMs: 0 });

/**
 * One transition as a playhead: paused WAAPI animations driven by `currentTime`.
 * The stand builds the tracks; the panel only asks for seek / run / speed.
 */
export class TransitionPlayer implements PlayerController {
  private tracks: TransitionTracks = EMPTY_TRACKS();
  private listeners = new Set<(state: PlayerState) => void>();
  private raf: number | null = null;
  private loopLast = 0;
  private state: PlayerState = {
    q: 0,
    playing: false,
    direction: 1,
    speed: 1,
    scrollView: false,
    open: false,
    pins: [],
    solo: null,
  };
  private readonly opts: Required<TransitionPlayerOptions>;
  readonly id: string;

  constructor(options: TransitionPlayerOptions) {
    this.id = options.id;
    this.opts = {
      reverseTimeScale: 1,
      reduceMotion: () => false,
      scrollPxPerTransition: 1000,
      ...options,
    };
  }

  getState = (): PlayerState => this.state;

  subscribe = (listener: (state: PlayerState) => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  get totalMs() {
    return this.tracks.totalMs;
  }

  /** Rebuild tracks (settings / viewport changed) keeping the playhead where it is. */
  rebuild() {
    const wasPlaying = this.state.playing;
    this.stopLoop();
    this.disposeTracks();
    this.tracks = this.opts.build();
    for (const anim of this.tracks.animations) anim.pause();
    this.applyTime(this.state.q * this.tracks.totalMs);
    if (wasPlaying) this.run(this.state.direction);
  }

  dispose() {
    this.stopLoop();
    this.disposeTracks();
    this.listeners.clear();
  }

  seek(q: number) {
    this.stopLoop();
    for (const anim of this.tracks.animations) anim.pause();
    const next = this.clampQ(q);
    this.applyTime(next * this.totalMs);
    this.set({ q: next, playing: false });
  }

  play(direction: 1 | -1) {
    this.stopLoop();
    if (this.opts.reduceMotion() || this.totalMs <= 0) {
      this.seek(direction > 0 ? this.rangeEnd() : this.rangeStart());
      return;
    }
    let from = this.state.q;
    const start = this.rangeStart();
    const end = this.rangeEnd();
    if (direction > 0 && from >= end - 1e-4) from = start;
    if (direction < 0 && from <= start + 1e-4) from = end;
    for (const anim of this.tracks.animations) anim.pause();
    this.applyTime(from * this.totalMs);
    this.set({ q: from });
    this.run(direction);
  }

  pause() {
    this.stopLoop();
    for (const anim of this.tracks.animations) anim.pause();
    const next = this.clampQ(this.state.q);
    this.applyTime(next * this.totalMs);
    this.set({ q: next, playing: false });
  }

  /** Space: run on; running → turn around; at an end → run back. */
  toggle() {
    if (this.state.playing) {
      this.play(this.state.direction > 0 ? -1 : 1);
      return;
    }
    this.play(this.state.q >= this.rangeEnd() ? -1 : 1);
  }

  setSpeed(speed: number) {
    this.set({ speed });
  }

  setScrollView(on: boolean) {
    if (on) this.pause();
    this.set({ scrollView: on });
  }

  /** Open always from q = 0. Close resets the viewing pose (playhead, pause, scroll-view). Pins stay. */
  setOpen(on: boolean) {
    this.stopLoop();
    for (const anim of this.tracks.animations) anim.pause();
    this.applyTime(0);
    this.set({
      q: 0,
      playing: false,
      direction: 1,
      scrollView: false,
      open: on,
      solo: null,
    });
  }

  setSolo(solo: PlayerSolo | null) {
    const next =
      solo != null && solo.to - solo.from < 0.0005
        ? null
        : solo;
    const q = this.clampQ(this.state.q, next);
    this.applyTime(q * this.totalMs);
    this.set({ solo: next, q });
  }

  togglePin() {
    const q = this.state.q;
    const pins = pinNear(this.state.pins, q)
      ? this.state.pins.filter((pin) => Math.abs(pin - q) >= PIN_EPSILON)
      : [...this.state.pins, q].sort((a, b) => a - b);
    this.set({ pins });
  }

  addPin(q: number) {
    const next = clamp01(q);
    if (pinNear(this.state.pins, next)) return;
    this.set({ pins: [...this.state.pins, next].sort((a, b) => a - b) });
  }

  /** Wheel in scroll-view: move the playhead by pixels. */
  nudgeByPixels(deltaPx: number) {
    if (this.totalMs <= 0) return;
    this.seek(this.state.q + deltaPx / this.opts.scrollPxPerTransition);
  }

  private rangeStart(solo = this.state.solo) {
    return solo?.from ?? 0;
  }

  private rangeEnd(solo = this.state.solo) {
    return solo?.to ?? 1;
  }

  private clampQ(q: number, solo = this.state.solo) {
    return Math.min(this.rangeEnd(solo), Math.max(this.rangeStart(solo), clamp01(q)));
  }

  private run(direction: 1 | -1) {
    this.set({ playing: true, direction });
    this.loopLast = performance.now();
    this.startLoop();
  }

  private applyTime(ms: number) {
    const solo = this.state.solo;
    const hold = solo != null ? solo.from * this.totalMs : ms;
    this.tracks.animations.forEach((anim, i) => {
      const phase = this.tracks.phases?.[i];
      const freeze =
        solo != null && phase != null && phase !== solo.phase;
      anim.currentTime = freeze ? hold : ms;
    });
  }

  private startLoop() {
    if (this.raf != null) return;
    const tick = (now: number) => {
      this.raf = null;
      if (!this.state.playing) return;
      const dt = Math.min(now - this.loopLast, 48);
      this.loopLast = now;
      const total = this.totalMs;
      if (total <= 0) {
        this.set({ playing: false });
        return;
      }
      const scale = this.state.direction < 0 ? this.opts.reverseTimeScale : 1;
      const rate = this.state.direction / this.state.speed / scale;
      let ms = this.state.q * total + dt * rate;
      const start = this.rangeStart() * total;
      const end = this.rangeEnd() * total;
      if (ms >= end) {
        this.applyTime(end);
        this.set({ q: end / total, playing: false });
        return;
      }
      if (ms <= start) {
        this.applyTime(start);
        this.set({ q: start / total, playing: false });
        return;
      }
      this.applyTime(ms);
      const q = this.clampQ(ms / total);
      this.set({ q });
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stopLoop() {
    if (this.raf != null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  private disposeTracks() {
    for (const anim of this.tracks.animations) anim.cancel();
    this.tracks = EMPTY_TRACKS();
  }

  private set(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }
}
