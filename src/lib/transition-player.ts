import { clamp01 } from "./cubic-bezier";
import type { PlayerController, PlayerState } from "../settings-panel/types";

/** Pins closer than this (in q) count as the same moment. */
export const PIN_EPSILON = 0.005;

function pinNear(pins: readonly number[], q: number) {
  return pins.some((pin) => Math.abs(pin - q) < PIN_EPSILON);
}

/** WAAPI tracks of one transition — all start at 0, the longest ends at `totalMs`. */
export type TransitionTracks = {
  animations: Animation[];
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
  private state: PlayerState = {
    q: 0,
    playing: false,
    direction: 1,
    speed: 1,
    scrollView: false,
    open: false,
    pins: [],
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
    const next = clamp01(q);
    this.applyTime(next * this.totalMs);
    this.set({ q: next, playing: false });
  }

  play(direction: 1 | -1) {
    if (this.opts.reduceMotion() || this.totalMs <= 0) {
      this.seek(direction > 0 ? 1 : 0);
      return;
    }
    // Tracks can drift from the HUD q (finished, rebuilt while parked, seeked before mount).
    let from = this.state.q;
    if (direction > 0 && from >= 1) from = 0;
    if (direction < 0 && from <= 0) from = 1;
    for (const anim of this.tracks.animations) anim.pause();
    this.applyTime(from * this.totalMs);
    this.set({ q: from });
    this.run(direction);
  }

  pause() {
    this.seek(this.readQ());
  }

  /** Space: run on; running → turn around; at an end → run back. */
  toggle() {
    if (this.state.playing) {
      this.play(this.state.direction > 0 ? -1 : 1);
      return;
    }
    this.play(this.state.q >= 1 ? -1 : 1);
  }

  setSpeed(speed: number) {
    this.set({ speed });
    if (this.state.playing) this.applyRate();
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
    });
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

  private run(direction: 1 | -1) {
    this.set({ playing: true, direction });
    this.applyRate();
    for (const anim of this.tracks.animations) anim.play();
    this.startLoop();
  }

  private applyRate() {
    const scale = this.state.direction < 0 ? this.opts.reverseTimeScale : 1;
    const rate = (this.state.direction / this.state.speed) / scale;
    for (const anim of this.tracks.animations) anim.playbackRate = rate;
  }

  private applyTime(ms: number) {
    for (const anim of this.tracks.animations) anim.currentTime = ms;
  }

  private readQ() {
    const { animations, totalMs } = this.tracks;
    if (totalMs <= 0) return this.state.q;
    const t = Number(animations[0]?.currentTime ?? this.state.q * totalMs);
    return clamp01(t / totalMs);
  }

  private startLoop() {
    if (this.raf != null) return;
    const tick = () => {
      this.raf = null;
      const q = this.readQ();
      const anims = this.tracks.animations;
      const done =
        anims.length === 0 ||
        anims.every((anim) => anim.playState === "finished") ||
        (this.state.direction > 0 && q >= 1) ||
        (this.state.direction < 0 && q <= 0);
      if (done) {
        const end = this.state.direction > 0 ? 1 : 0;
        for (const anim of anims) anim.pause();
        this.applyTime(end * this.totalMs);
        this.set({ q: end, playing: false });
        return;
      }
      if (q !== this.state.q) this.set({ q });
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
