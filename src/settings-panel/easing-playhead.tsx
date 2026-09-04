"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function EasingPlayheadGate({
  durationMs,
  onReplay,
  reduceMotion,
  children,
}: {
  durationMs: number;
  onReplay?: () => void;
  reduceMotion: boolean;
  children: (playhead: number | null, replay: () => void) => ReactNode;
}) {
  const [playhead, setPlayhead] = useState<number | null>(null);
  const playGenRef = useRef(0);

  useEffect(() => {
    return () => {
      playGenRef.current += 1;
    };
  }, []);

  const startPreview = (ms: number) => {
    const gen = ++playGenRef.current;
    if (reduceMotion || ms <= 0) {
      setPlayhead(1);
      window.setTimeout(() => {
        if (gen === playGenRef.current) setPlayhead(null);
      }, 160);
      return;
    }
    const start = performance.now();
    setPlayhead(0);
    const tick = (now: number) => {
      if (gen !== playGenRef.current) return;
      const t = Math.min(1, (now - start) / ms);
      setPlayhead(t);
      if (t < 1) {
        requestAnimationFrame(tick);
        return;
      }
      window.setTimeout(() => {
        if (gen === playGenRef.current) setPlayhead(null);
      }, 220);
    };
    requestAnimationFrame(tick);
  };

  const replay = () => {
    startPreview(durationMs);
    onReplay?.();
  };

  return children(playhead, replay);
}
