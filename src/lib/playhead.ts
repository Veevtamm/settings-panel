import { clamp01 } from "./cubic-bezier";
import type {
  PlayerController,
  PlayerSolo,
  PlayerState,
} from "../settings-panel/types";

/** Pins closer than this (in q) count as the same moment. */
export const PIN_EPSILON = 0.005;

export function pinNear(pins: readonly number[], q: number) {
  return pins.some((pin) => Math.abs(pin - q) < PIN_EPSILON);
}

const INITIAL_STATE: PlayerState = {
  q: 0,
  playing: false,
  direction: 1,
  speed: 1,
  scrollView: false,
  open: false,
  pins: [],
  solo: null,
};

/**
 * Shared rAF playhead: pins, solo, speed, wrap-at-edges. Subclasses only
 * say how long 0→1 takes and where to write q (WAAPI vs scroll).
 */
export abstract class PlayheadClock implements PlayerController {
  readonly id: string;
  protected listeners = new Set<(state: PlayerState) => void>();
  protected raf: number | null = null;
  protected loopLast = 0;
  protected state: PlayerState = { ...INITIAL_STATE };

  constructor(id: string) {
    this.id = id;
  }

  getState = (): PlayerState => this.state;

  subscribe = (listener: (state: PlayerState) => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Paint this q (WAAPI currentTime, window.scrollTo, …). */
  protected abstract drive(q: number): void;
  /** Wall-clock ms for q 0→1 at ×1 in this direction. */
  protected abstract spanMs(direction: 1 | -1): number;
  protected abstract canPlay(): boolean;
  /** Transition close jumps to 0; a scroll pin keeps the page where it is. */
  protected closeResetsQ() {
    return true;
  }
  /** Transition pause re-clamps and paints; scroll just stops the rAF. */
  protected clampOnPause() {
    return false;
  }
  /** Pause underlying animations / extra halt work. */
  protected onHalt() {}

  seek(q: number) {
    this.stopLoop();
    this.onHalt();
    const next = this.clampQ(q);
    this.drive(next);
    this.patch({ q: next, playing: false });
  }

  play(direction: 1 | -1) {
    this.stopLoop();
    if (!this.canPlay()) {
      this.seek(direction > 0 ? this.rangeEnd() : this.rangeStart());
      return;
    }
    let from = this.state.q;
    const start = this.rangeStart();
    const end = this.rangeEnd();
    if (direction > 0 && from >= end - 1e-4) from = start;
    if (direction < 0 && from <= start + 1e-4) from = end;
    this.onHalt();
    this.drive(from);
    this.patch({ q: from, playing: true, direction });
    this.loopLast = performance.now();
    this.startLoop();
  }

  pause() {
    this.stopLoop();
    this.onHalt();
    if (this.clampOnPause()) {
      const next = this.clampQ(this.state.q);
      this.drive(next);
      this.patch({ q: next, playing: false });
      return;
    }
    this.patch({ playing: false });
  }

  toggle() {
    if (this.state.playing) {
      this.play(this.state.direction > 0 ? -1 : 1);
      return;
    }
    this.play(this.state.q >= this.rangeEnd() ? -1 : 1);
  }

  setSpeed(speed: number) {
    this.patch({ speed });
  }

  setScrollView(on: boolean) {
    if (on) this.pause();
    this.patch({ scrollView: on });
  }

  setOpen(on: boolean) {
    this.stopLoop();
    this.onHalt();
    const reset = on || this.closeResetsQ();
    const q = reset ? 0 : this.state.q;
    if (reset) this.drive(q);
    this.patch({
      q,
      playing: false,
      direction: 1,
      scrollView: false,
      open: on,
      solo: null,
    });
  }

  setSolo(solo: PlayerSolo | null) {
    const next = solo != null && solo.to - solo.from < 0.0005 ? null : solo;
    const q = this.clampQ(this.state.q, next);
    this.drive(q);
    this.patch({ solo: next, q });
  }

  togglePin() {
    const q = this.state.q;
    const pins = pinNear(this.state.pins, q)
      ? this.state.pins.filter((pin) => Math.abs(pin - q) >= PIN_EPSILON)
      : [...this.state.pins, q].sort((a, b) => a - b);
    this.patch({ pins });
  }

  protected rangeStart(solo = this.state.solo) {
    return solo?.from ?? 0;
  }

  protected rangeEnd(solo = this.state.solo) {
    return solo?.to ?? 1;
  }

  protected clampQ(q: number, solo = this.state.solo) {
    return Math.min(
      this.rangeEnd(solo),
      Math.max(this.rangeStart(solo), clamp01(q)),
    );
  }

  protected startLoop() {
    if (this.raf != null) return;
    const tick = (now: number) => {
      this.raf = null;
      if (!this.state.playing) return;
      const dt = Math.min(now - this.loopLast, 48);
      this.loopLast = now;
      const span = this.spanMs(this.state.direction);
      if (span <= 0) {
        this.patch({ playing: false });
        return;
      }
      const rate = this.state.direction / this.state.speed / span;
      const q = this.state.q + dt * rate;
      const start = this.rangeStart();
      const end = this.rangeEnd();
      if (q >= end || q <= start) {
        const stop = q >= end ? end : start;
        this.drive(stop);
        this.patch({ q: stop, playing: false });
        return;
      }
      this.drive(q);
      this.patch({ q: this.clampQ(q) });
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  protected stopLoop() {
    if (this.raf != null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  protected patch(next: Partial<PlayerState>) {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener(this.state);
  }
}
