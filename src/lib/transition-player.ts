import { clamp01 } from "./cubic-bezier";
import { PlayheadClock, pinNear } from "./playhead";

export { PIN_EPSILON, pinNear } from "./playhead";

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
export class TransitionPlayer extends PlayheadClock {
  private tracks: TransitionTracks = EMPTY_TRACKS();
  private readonly opts: Required<Omit<TransitionPlayerOptions, "id">>;

  constructor(options: TransitionPlayerOptions) {
    super(options.id);
    this.opts = {
      reverseTimeScale: 1,
      reduceMotion: () => false,
      scrollPxPerTransition: 1000,
      build: options.build,
    };
  }

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
    this.drive(this.state.q);
    if (wasPlaying) {
      this.patch({ playing: true });
      this.loopLast = performance.now();
      this.startLoop();
    }
  }

  dispose() {
    this.stopLoop();
    this.disposeTracks();
    this.listeners.clear();
  }

  addPin(q: number) {
    const next = clamp01(q);
    if (pinNear(this.state.pins, next)) return;
    this.patch({
      pins: [...this.state.pins, next].sort((a, b) => a - b),
    });
  }

  /** Wheel in scroll-view: move the playhead by pixels. */
  nudgeByPixels(deltaPx: number) {
    if (this.totalMs <= 0) return;
    this.seek(this.state.q + deltaPx / this.opts.scrollPxPerTransition);
  }

  protected drive(q: number) {
    const ms = q * this.totalMs;
    const solo = this.state.solo;
    const hold = solo != null ? solo.from * this.totalMs : ms;
    this.tracks.animations.forEach((anim, i) => {
      const phase = this.tracks.phases?.[i];
      const freeze = solo != null && phase != null && phase !== solo.phase;
      anim.currentTime = freeze ? hold : ms;
    });
  }

  protected spanMs(direction: 1 | -1) {
    return this.totalMs * (direction < 0 ? this.opts.reverseTimeScale : 1);
  }

  protected canPlay() {
    return !this.opts.reduceMotion() && this.totalMs > 0;
  }

  protected clampOnPause() {
    return true;
  }

  protected onHalt() {
    for (const anim of this.tracks.animations) anim.pause();
  }

  private disposeTracks() {
    for (const anim of this.tracks.animations) anim.cancel();
    this.tracks = EMPTY_TRACKS();
  }
}
