import { PlayheadClock } from "./playhead";

export type ScrollPinRange = {
  /** Document scroll offset (px) where the pin starts (q = 0). */
  start: number;
  /** Pin length in px (q = 1 at `start + length`). */
  length: number;
};

export type ScrollPinPlayerOptions = {
  /** Keys the `?moment=<id>:<q>` URL entry; unique per page (`hero`, `portrait`, …). */
  id: string;
  /** Pin bounds in document px — read on every sync, so resize / rebuild need no extra call. */
  range: () => ScrollPinRange;
  /** Current scroll offset (Lenis `scroll`, or `window.scrollY`). */
  getScroll: () => number;
  /** Jump to an offset without smoothing (Lenis `scrollTo(px, { immediate: true })`). */
  scrollTo: (px: number) => void;
  /** Play: the whole pin passes in this many ms at ×1. Default 4000. */
  playMs?: number;
  /** Instant seeks instead of runs (prefers-reduced-motion). */
  reduceMotion?: () => boolean;
};

/**
 * A scroll pin as a playhead: q = progress through the pin. `seek` scrolls
 * the page, `play` drives the scroll with rAF, `sync()` reads the scroll back
 * — call it from the scene's scroll / Lenis handler. The dock renders phases
 * in `vh` (`PlayerSetting.unit`), the same chrome as ms.
 */
export class ScrollPinPlayer extends PlayheadClock {
  private readonly opts: Required<Omit<ScrollPinPlayerOptions, "id">>;

  constructor(options: ScrollPinPlayerOptions) {
    super(options.id);
    this.opts = {
      playMs: 4000,
      reduceMotion: () => false,
      range: options.range,
      getScroll: options.getScroll,
      scrollTo: options.scrollTo,
    };
  }

  /** Scroll moved (user, Lenis, anchor): read q back. No-op while `play` drives the scroll. */
  sync() {
    if (this.state.playing) return;
    const { start, length } = this.opts.range();
    if (length <= 0) return;
    const q = this.clampQ((this.opts.getScroll() - start) / length);
    if (Math.abs(q - this.state.q) < 1e-4) return;
    this.patch({ q });
  }

  dispose() {
    this.stopLoop();
    this.listeners.clear();
  }

  /** Wheel in scroll-view: move by pixels along the pin. */
  nudgeByPixels(deltaPx: number) {
    const { length } = this.opts.range();
    if (length <= 0) return;
    this.seek(this.state.q + deltaPx / length);
  }

  protected drive(q: number) {
    const { start, length } = this.opts.range();
    this.opts.scrollTo(start + q * length);
  }

  protected spanMs(_direction: 1 | -1) {
    return this.opts.playMs;
  }

  protected canPlay() {
    return !this.opts.reduceMotion() && this.opts.range().length > 0;
  }

  protected closeResetsQ() {
    return false;
  }
}
